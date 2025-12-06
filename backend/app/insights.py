import io
import json
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.figure_factory as ff
import plotly.graph_objs as go

from fastapi import HTTPException
from azure.storage.blob import BlobServiceClient
from app.config import get_settings
settings = get_settings()


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

        # Determine file format
        if blob_path.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(data))
        elif blob_path.lower().endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(data))
        else:
            raise HTTPException(400, "Unsupported file type")

        return df

    except Exception as e:
        raise HTTPException(500, f"Blob load failed: {e}")


# -------------------------
# Compute KPIs
# -------------------------
def compute_kpis(df: pd.DataFrame) -> dict:
    kpis = {
        "Total Rows": len(df),
    }

    # Add numeric KPIs
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        kpis[f"Average {col}"] = round(df[col].mean(), 2)

    return kpis


# -------------------------
# Build Chart Objects
# -------------------------
def build_charts(df: pd.DataFrame) -> dict:
    charts = {}

    # Histogram for first numeric column
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        col = numeric_cols[0]
        fig = px.histogram(df, x=col, title=f"Distribution of {col}")
        charts["histogram"] = fig.to_dict()

    # Bar chart for first categorical column
    cat_cols = df.select_dtypes(include=["object"]).columns
    if len(cat_cols) > 0:
        col = cat_cols[0]
        fig = px.bar(
            df[col].value_counts().reset_index(),
            x="index",
            y=col,
            title=f"{col} Counts",
        )
        charts["bar_chart"] = fig.to_dict()

    # Correlation heatmap
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols].corr()
        fig = ff.create_annotated_heatmap(
            z=corr.values,
            x=list(corr.columns),
            y=list(corr.index),
            colorscale="Viridis",
            showscale=True,
        )
        charts["correlation_matrix"] = fig.to_dict()

    return charts


# -------------------------
# Extract Filters
# -------------------------
def extract_filters(df: pd.DataFrame) -> dict:
    filters = {}
    cat_cols = df.select_dtypes(include=["object"]).columns

    for col in cat_cols:
        unique_vals = sorted(df[col].dropna().unique().tolist())
        if len(unique_vals) <= 50:  # avoid huge dropdowns
            filters[col] = unique_vals

    return filters


# -------------------------
# Apply Filters
# -------------------------
def apply_filters(df: pd.DataFrame, filters: dict) -> pd.DataFrame:
    filtered_df = df.copy()

    for key, val in filters.items():
        if val not in [None, "", "all"] and key in filtered_df.columns:
            filtered_df = filtered_df[filtered_df[key] == val]

    return filtered_df


# -------------------------
# Full Insights Pipeline
# -------------------------
def generate_insights(blob_path: str, filters: dict = None) -> dict:
    df = load_file_from_blob(blob_path)

    if filters:
        df = apply_filters(df, filters)

    return {
        "kpis": compute_kpis(df),
        "charts": build_charts(df),
        "filters": extract_filters(df),
    }
