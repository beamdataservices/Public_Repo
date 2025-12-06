📘 BEAM Analytics – Insights Engine Developer Guide
How to Build Custom Dashboards, KPIs, Filters & Visuals for Uploaded Tenant Files
🚀 Overview

BEAM Analytics provides a complete ingestion → storage → insights pipeline.

When a tenant uploads a CSV/XLSX file, the system:

Stores file in Azure Blob
Registers file metadata in Postgres
Displays file in UI sidebar
Requests insights from backend
Renders dashboards dynamically


You (the analytics developer) only need to modify one place to build new dashboards:

backend/app/insights.py


This is the plugin interface for new dashboards, charts, KPIs, and filter logic.

1. 🧠 Architecture Summary
Frontend → Backend → Azure Blob → Insights → Dashboard

User uploads a file

Backend saves it to blob storage under:

tenant_<tenantId>/file_<fileId>/raw/<original_filename>


User clicks a file in the left sidebar

Frontend calls:

POST /api/files/{file_id}/insights


Backend:

Loads file into Pandas

Applies filters

Computes KPIs

Generates Plotly charts

Frontend dynamically renders:

KPI cards

Filter dropdowns

Chart components

This architecture allows new analytics features without touching the frontend.

2. 🔧 Backend Structure
backend/
  app/
    insights.py        ← You modify this
    routers/
      insights_routes.py
    models.py
    auth.py
    deps.py
    config.py


Your entry point for all dashboard logic:

generate_insights()

3. 📁 How File Loading Works

Each file has a stored blob path, e.g.:

tenant_123/file_456/raw/data.xlsx


Inside generate_insights(), we call:

df = load_file_from_blob(blob_path)


This gives you a Pandas DataFrame for analysis.

Supported types:

.csv

.xlsx

4. 📊 Insight Output Format (VERY IMPORTANT)

Your insight function must return JSON in this structure:

{
  "kpis": {
    "Total Rows": 1000,
    "Average Age": 27.4
  },
  "filters": {
    "country": ["USA", "CANADA", "UK"],
    "gender": ["M", "F"]
  },
  "charts": {
    "age_distribution": { "data": [...], "layout": {...} },
    "country_counts":    { "data": [...], "layout": {...} }
  }
}


This is exactly what the frontend expects.

5. ➕ How to Add New KPIs

Modify compute_kpis(df):

def compute_kpis(df):
    kpis = {
        "Total Rows": len(df),
        "Unique Users": df["user_id"].nunique() if "user_id" in df else None,
    }

    # Example numeric KPIs
    for col in df.select_dtypes(include=[np.number]).columns:
        kpis[f"Mean {col}"] = df[col].mean()

    return kpis


Add any KPI you want — the frontend will render it automatically.

6. 🧩 How to Add Filters

Filters appear as dropdowns.

Modify extract_filters(df):

def extract_filters(df):
    filters = {}
    for col in df.select_dtypes(include=["object"]).columns:
        unique = sorted(df[col].dropna().unique().tolist())
        if len(unique) <= 50:
            filters[col] = unique
    return filters


The frontend renders a dropdown for each filter key.

7. 🔍 How Filters Are Applied

User-selected filters are passed as:

{
  "filters": {
    "country": "USA",
    "product": null
  }
}


Backend applies them in:

df = apply_filters(df, filters)


Example logic:

if filters.get("country"):
    df = df[df["country"] == filters["country"]]


You may extend this for ranges, multi-select, numeric filters, etc.

8. 📈 How to Add New Charts

Modify build_charts(df):

Example charts
Histogram
fig = px.histogram(df, x="age")
charts["age_distribution"] = fig.to_dict()

Bar Chart
fig = px.bar(df["country"].value_counts().reset_index(), x="index", y="country")
charts["country_counts"] = fig.to_dict()

Correlation Heatmap
corr = df.corr()
fig = ff.create_annotated_heatmap(z=corr.values, x=corr.columns, y=corr.index)
charts["correlation_matrix"] = fig.to_dict()


The frontend automatically renders each chart in a card.

9. 🧱 Multi-Dashboard Support (Optional but Easy)

You can create multiple dashboard templates:

insights_sales.py
insights_finance.py
insights_marketing.py


Then route dynamically:

if "revenue" in file_name.lower():
    return insights_finance.compute(df)

if "leads" in file_name.lower():
    return insights_marketing.compute(df)

return insights_general.compute(df)

10. 🤖 Future Extensions (Supported by Platform)

You can expand the insight engine into:

AI-driven summaries

Anomaly detection

Predictive analytics

Cohort analysis

Time-series forecasting

Root-cause analysis

Recommendations engine

Tenant-specific dashboards

All without frontend changes.

11. 🚀 Example: Full Insight Pipeline Template
def generate_insights(blob_path, filters=None):
    df = load_file_from_blob(blob_path)

    if filters:
        df = apply_filters(df, filters)

    return {
        "kpis": compute_kpis(df),
        "charts": build_charts(df),
        "filters": extract_filters(df),
    }


This is the heart of the system.