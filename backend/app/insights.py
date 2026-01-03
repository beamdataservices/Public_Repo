import io
import os
import json
import math
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.figure_factory as ff
from openai import OpenAI
from fastapi import HTTPException
from azure.storage.blob import BlobServiceClient
from app.config import get_settings

settings = get_settings()


# -------------------------
# Helpers: make payload JSON-safe
# -------------------------
def _clean_df(df: pd.DataFrame) -> pd.DataFrame:
    # Convert +/-inf to NaN so we handle consistently
    return df.replace([np.inf, -np.inf], np.nan)


def _json_safe(obj):
    """
    Recursively convert NaN/Inf to None so FastAPI's JSON encoding never fails.
    (Starlette JSONResponse is strict and will throw on NaN/Inf.)
    """
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    return obj


# -------------------------
# AI Summary
# -------------------------
def generate_ai_summary(df: pd.DataFrame) -> str:
    API_KEY = os.getenv("OPENAI_API_KEY")
    if not API_KEY:
        return "AI summary unavailable (missing OPENAI_API_KEY)."

    client = OpenAI(api_key=API_KEY)

    # Keep it small and safe
    sample = df.head(20).to_csv(index=False)
    prompt = f"""
You are a data analyst. Explain the main patterns in the dataset below.
Dataset sample:
{sample}
"""

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
    )

    return response.choices[0].message.content


# -------------------------
# Load file from Azure Blob
# -------------------------
def load_file_from_blob(blob_path: str) -> pd.DataFrame:
    try:
        blob_service = BlobServiceClient.from_connection_string(
            settings.AZURE_BLOB_CONNSTRING
        )
        container = blob_service.get_container_client(settings.BLOB_CONTAINER)

        blob = container.get_blob_client(blob_path)
        data = blob.download_blob().readall()

        path = blob_path.lower()

        if path.endswith(".csv"):
            # More resilient CSV read (encoding surprises are common)
            try:
                df = pd.read_csv(io.BytesIO(data))
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(data), encoding="latin-1")
        elif path.endswith(".xlsx") or path.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(data))
        else:
            raise HTTPException(400, "Unsupported file type")

        return _clean_df(df)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Blob load failed: {e}")


# -------------------------
# Compute KPIs
# -------------------------
def compute_kpis(df: pd.DataFrame) -> dict:
    kpis = {"Total Rows": int(len(df))}

    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        mean_val = df[col].mean(skipna=True)
        kpis[f"Average {col}"] = None if pd.isna(mean_val) else round(float(mean_val), 2)

    return kpis


# -------------------------
# Build Chart Objects
# -------------------------
def safe_fig(fig):
    # This yields a dict with lots of numbers; we will sanitize later.
    return json.loads(fig.to_json())


def build_charts(df: pd.DataFrame) -> dict:
    charts = {}

    numeric_cols = df.select_dtypes(include=[np.number]).columns
    cat_cols = df.select_dtypes(include=["object"]).columns

    # Histogram (drop NaNs to prevent NaNs from propagating into plotly JSON)
    if len(numeric_cols) > 0:
        col = numeric_cols[0]
        dff = df.dropna(subset=[col])
        if len(dff) > 0:
            fig = px.histogram(dff, x=col, title=f"Distribution of {col}")
            charts["histogram"] = safe_fig(fig)

    # Bar chart
    if len(cat_cols) > 0:
        col = cat_cols[0]
        counts = df[col].dropna().value_counts().reset_index()
        counts.columns = [col, "count"]
        if len(counts) > 0:
            fig = px.bar(counts, x=col, y="count", title=f"{col} Counts")
            charts["bar_chart"] = safe_fig(fig)

    # Correlation heatmap
    if len(numeric_cols) >= 2:
        dff = df[list(numeric_cols)].dropna()
        if len(dff) > 1:
            corr = dff.corr()
            fig = ff.create_annotated_heatmap(
                z=corr.to_numpy(),
                x=list(corr.columns),
                y=list(corr.index),
                colorscale="Viridis",
                showscale=True,
            )
            charts["correlation_matrix"] = safe_fig(fig)

    return charts


# -------------------------
# Extract Filters
# -------------------------
def extract_filters(df: pd.DataFrame) -> dict:
    filters = {}
    cat_cols = df.select_dtypes(include=["object"]).columns

    for col in cat_cols:
        unique_vals = sorted(df[col].dropna().unique().tolist())
        if len(unique_vals) <= 50:
            filters[col] = unique_vals

    return filters


# -------------------------
# Apply Filters
# -------------------------
def apply_filters(df: pd.DataFrame, filters: dict) -> pd.DataFrame:
    filtered_df = df.copy()

    for key, val in (filters or {}).items():
        if key not in filtered_df.columns:
            continue

        # ignore "all"/empty/null
        if val in [None, "", "all"]:
            continue

        filtered_df = filtered_df[filtered_df[key] == val]

    return filtered_df


# -------------------------
# Full Insights Pipeline
# -------------------------
def generate_insights(blob_path: str, filters: dict = None) -> dict:
    df = load_file_from_blob(blob_path)
    if filters:
        df = apply_filters(df, filters)

    result = {
        "kpis": compute_kpis(df),
        "charts": build_charts(df),
        "filters": extract_filters(df),
        "ai_summary": generate_ai_summary(df),
    }

    # Critical: prevent JSONResponse crash on NaN/Infinity anywhere in payload
    return _json_safe(result)
