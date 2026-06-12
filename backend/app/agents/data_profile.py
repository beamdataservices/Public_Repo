"""
Server-side data snapshot for the AI assistant.

The chat specialists previously only saw whatever context the frontend
happened to pass (health summary if that tab was visited, column names).
This module profiles the actual dataframe so the assistant can answer
questions about the data itself: real values, ranges, top categories,
and sample rows.

The output is plain text bounded to a predictable size so prompt cost
stays controlled regardless of file size.
"""

from __future__ import annotations

import pandas as pd

MAX_PROFILE_COLUMNS = 25
SAMPLE_ROW_COUNT = 5
MAX_CELL_CHARS = 40
TOP_VALUE_COUNT = 3


def _fmt_number(v) -> str:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    if f != f or f in (float("inf"), float("-inf")):
        return "n/a"
    if f == int(f) and abs(f) < 1e15:
        return f"{int(f):,}"
    return f"{f:,.2f}"


def _truncate(value, limit: int = MAX_CELL_CHARS) -> str:
    if value is None or (isinstance(value, float) and value != value):
        return "(empty)"
    if isinstance(value, float):
        s = _fmt_number(value)
    else:
        s = str(value)
    return s if len(s) <= limit else s[: limit - 3] + "..."


def _column_line(df: pd.DataFrame, col: str) -> str:
    series = df[col]
    n_rows = len(df)
    null_pct = (series.isna().sum() / n_rows * 100) if n_rows else 0.0
    null_part = f"{null_pct:.0f}% missing" if null_pct >= 0.5 else "no missing values"

    if pd.api.types.is_numeric_dtype(series):
        clean = series.dropna()
        if clean.empty:
            return f"  - {col} (number): all values missing"
        return (
            f"  - {col} (number): {null_part}, "
            f"min {_fmt_number(clean.min())}, max {_fmt_number(clean.max())}, "
            f"avg {_fmt_number(clean.mean())}"
        )

    if pd.api.types.is_datetime64_any_dtype(series):
        clean = series.dropna()
        if clean.empty:
            return f"  - {col} (date): all values missing"
        return f"  - {col} (date): {null_part}, from {clean.min()} to {clean.max()}"

    n_distinct = series.nunique(dropna=True)
    tops = series.value_counts().head(TOP_VALUE_COUNT)
    top_part = ", ".join(f"{_truncate(v, 25)} ({c:,})" for v, c in tops.items())
    return (
        f"  - {col} (text): {null_part}, {n_distinct:,} distinct values"
        + (f", most common: {top_part}" if top_part else "")
    )


def build_data_profile(df: pd.DataFrame) -> str:
    """Return a compact plain-text snapshot of the dataframe for prompts."""
    n_rows, n_cols = df.shape
    cols = list(df.columns)[:MAX_PROFILE_COLUMNS]

    col_lines = [_column_line(df, c) for c in cols]
    if n_cols > MAX_PROFILE_COLUMNS:
        col_lines.append(f"  ... and {n_cols - MAX_PROFILE_COLUMNS} more columns")

    sample = df[cols].head(SAMPLE_ROW_COUNT)
    header = " | ".join(_truncate(c, 25) for c in cols)
    sample_lines = [f"  {header}"]
    for _, row in sample.iterrows():
        sample_lines.append("  " + " | ".join(_truncate(v) for v in row.tolist()))

    return (
        f"ROWS: {n_rows:,}  COLUMNS: {n_cols}\n\n"
        f"COLUMN DETAILS:\n" + "\n".join(col_lines) + "\n\n"
        f"SAMPLE ROWS (first {min(SAMPLE_ROW_COUNT, n_rows)}):\n" + "\n".join(sample_lines)
    )
