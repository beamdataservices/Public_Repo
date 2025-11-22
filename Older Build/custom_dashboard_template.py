from dash import Dash, dcc, html, Input, Output
import pandas as pd
import plotly.express as px

# -------------------------------------------------
# 1. Initialise Dash (FIXED)
# -------------------------------------------------
app = Dash(
    __name__,
    external_stylesheets=["https://codepen.io/chriddyp/pen/bWLwgP.css"],
    assets_folder="assets"
)

# -------------------------------------------------
# 2. Load data
# -------------------------------------------------
df = pd.read_csv("final_data.csv")

# BMI if missing
if "BMI" not in df.columns and {"Weight (kg)", "Height (m)"}.issubset(df.columns):
    df["BMI"] = df["Weight (kg)"] / (df["Height (m)"] ** 2)

# -------------------------------------------------
# 3. Theme constants
# -------------------------------------------------
NAVY       = "#002B5B"
TEAL       = "#00A3E0"   # Brand
GREEN      = "#00C897"   # Used only for underlines
WHITE      = "#FFFFFF"
LIGHT      = "#F5F7FA"
PLOT_BG    = "#F8FAFC"
DARK_TEXT  = "#1F2A44"
LIGHT_TEXT = "#FFFFFF"

# Softer pastel palette for all charts
PASTEL = px.colors.qualitative.Pastel

# -------------------------------------------------
# 4. Custom CSS
# -------------------------------------------------
custom_css = f"""
html, body, #root {{ margin:0; padding:0; width:100%; height:100%; }}
* {{ box-sizing:border-box; font-family: 'Segoe UI', sans-serif; }}

.dash-dropdown .Select-control {{ 
    background:{NAVY}; 
    border:1px solid {TEAL}; 
    color:{LIGHT_TEXT};
}}
.dash-dropdown .Select-value-label {{ color:{LIGHT_TEXT}; }}
.dash-dropdown .Select-menu-outer {{ 
    background:{WHITE}; 
    border:1px solid {TEAL}; 
}}
.dash-dropdown .Select-option {{ 
    background:{WHITE}; 
    color:{DARK_TEXT}; 
}}
.dash-dropdown .Select-option.is-focused {{ 
    background:{TEAL}; 
    color:{LIGHT_TEXT}; 
}}

select::-webkit-scrollbar {{ width:8px; }}
select::-webkit-scrollbar-thumb {{ background:{TEAL}; border-radius:4px; }}
"""
app.index_string = f"""
<!DOCTYPE html>
<html>
<head>
    {{%metas%}}
    <title>BEAM Lifestyle Power Dashboard</title>
    {{%favicon%}}
    {{%css%}}
    <style>{custom_css}</style>
</head>
<body>
    {{%app_entry%}}
    <footer>{{%config%}}{{%scripts%}}{{%renderer%}}</footer>
</body>
</html>
"""

# -------------------------------------------------
# 5. Helper – section
# -------------------------------------------------
def make_section(title: str, *graphs):
    return html.Div(
        [
            html.H3(
                title,
                style={
                    "color": TEAL,
                    "margin": "30px 0 15px",
                    "fontWeight": "600",
                    "fontSize": "1.5rem",
                    "borderBottom": f"3px solid {GREEN}",
                    "paddingBottom": "8px",
                    "width": "fit-content",
                },
            ),
            html.Div(
                [html.Div([g], style={"width": "50%", "padding": "10px"}) for g in graphs],
                style={
                    "display": "flex",
                    "flexWrap": "wrap",
                    "justifyContent": "space-between",
                },
            ),
        ],
        style={"marginBottom": "50px"},
    )

# -------------------------------------------------
# 6. Layout
# -------------------------------------------------
app.layout = html.Div(
    id="root",
    style={
        "margin": "0",
        "padding": "0",
        "width": "100%",
        "height": "100vh",
        "fontFamily": "'Segoe UI', sans-serif",
        "display": "flex",
        "flexDirection": "column",
        "backgroundColor": NAVY,
    },
    children=[
        # ---------- Header ----------
        html.Div(
            [
                html.Img(
                    src=app.get_asset_url("beam_logo.png"),
                    style={"height": "48px", "margin": "15px 20px"}
                ),
                html.H1(
                    "Lifestyle Power Dashboard",
                    style={
                        "display": "inline-block",
                        "color": LIGHT_TEXT,
                        "margin": "0 20px",
                        "fontSize": "2rem",
                        "verticalAlign": "middle",
                        "fontWeight": "500",
                    },
                ),
            ],
            style={
                "backgroundColor": NAVY,
                "padding": "10px 0",
                "borderBottom": f"4px solid {TEAL}",
                "display": "flex",
                "alignItems": "center",
            },
        ),

        # ---------- Main Row ----------
        html.Div(
            style={"display": "flex", "flex": "1", "overflow": "hidden"},
            children=[
                # ----- Sidebar -----
                html.Div(
                    [
                        html.Label("Gender", style={"color": TEAL, "margin": "10px", "fontWeight": "500"}),
                        dcc.Dropdown(
                            id="gender-dropdown",
                            options=[{"label": g, "value": g} for g in df["Gender"].unique()],
                            multi=True,
                            placeholder="Select Gender",
                            style={"margin": "10px"},
                        ),
                        html.Label("Workout Type", style={"color": TEAL, "margin": "10px", "fontWeight": "500"}),
                        dcc.Dropdown(
                            id="workout-dropdown",
                            options=[{"label": w, "value": w} for w in df["Workout_Type"].unique()],
                            multi=True,
                            placeholder="Select Workout",
                            style={"margin": "10px"},
                        ),
                        html.Label("Experience Level", style={"color": TEAL, "margin": "10px", "fontWeight": "500"}),
                        dcc.Dropdown(
                            id="experience-dropdown",
                            options=[{"label": e, "value": e} for e in df["Experience_Level"].unique()],
                            multi=True,
                            placeholder="Select Experience",
                            style={"margin": "10px"},
                        ),
                    ],
                    style={
                        "width": "260px",
                        "backgroundColor": "#001F3F",
                        "padding": "20px",
                        "borderRight": f"1px solid {TEAL}",
                        "height": "100%",
                        "overflowY": "auto",
                    },
                ),

                # ----- Right Panel -----
                html.Div(
                    style={"flex": "1", "display": "flex", "flexDirection": "column"},
                    children=[
                        # ---- KPI Section (Navy) ----
                        html.Div(
                            [
                                # BIGGER HEADER
                                html.H4(
                                    "Key Insights at a Glance",
                                    style={
                                        "color": LIGHT_TEXT,
                                        "textAlign": "center",
                                        "margin": "30px 0 20px",
                                        "fontSize": "1.8rem",   # Increased
                                        "fontWeight": "600",
                                    },
                                ),
                                # KPIs in BLACK
                                html.Div(
                                    [
                                        html.Div(id="kpi-calories", style={"fontSize": "1.3rem", "color": DARK_TEXT, "fontWeight": "bold"}),
                                        html.Div(id="kpi-bmi", style={"fontSize": "1.3rem", "color": DARK_TEXT, "fontWeight": "bold"}),
                                        html.Div(id="kpi-water", style={"fontSize": "1.3rem", "color": DARK_TEXT, "fontWeight": "bold"}),
                                        html.Div(id="kpi-sessions", style={"fontSize": "1.3rem", "color": DARK_TEXT, "fontWeight": "bold"}),
                                    ],
                                    style={
                                        "display": "grid",
                                        "gridTemplateColumns": "repeat(4, 1fr)",
                                        "gap": "15px",
                                        "padding": "25px",
                                        "backgroundColor": LIGHT,
                                        "borderRadius": "12px",
                                        "margin": "0 20px 20px",
                                        "boxShadow": "0 4px 12px rgba(0,0,0,0.1)",
                                        "textAlign": "center",
                                    },
                                ),
                            ],
                            style={"backgroundColor": NAVY, "padding": "20px 0"},
                        ),

                        # ---- White Content Area ----
                        html.Div(
                            [
                                make_section(
                                    "Demographics: Who's Participating?",
                                    dcc.Graph(id="experience-distribution"),
                                    dcc.Graph(id="experience-by-gender"),
                                ),
                                make_section(
                                    "Performance: Effort to Outcomes",
                                    dcc.Graph(id="calories-by-workout"),
                                    dcc.Graph(id="calories-box"),
                                ),
                                make_section(
                                    "Health: Progress and Metrics",
                                    dcc.Graph(id="bmi-by-experience"),
                                    dcc.Graph(id="correlation-heatmap"),
                                ),
                                make_section(
                                    "Nutrition: Fueling the Lifestyle",
                                    dcc.Graph(id="meal-distribution"),
                                    dcc.Graph(id="water-vs-calories"),
                                ),
                            ],
                            style={
                                "backgroundColor": WHITE,
                                "color": DARK_TEXT,
                                "padding": "20px",
                                "flex": "1",
                                "overflowY": "auto",
                            },
                        ),
                    ],
                ),
            ],
        ),
    ],
)

# -------------------------------------------------
# 7. Callback
# -------------------------------------------------
@app.callback(
    [
        Output("calories-by-workout", "figure"),
        Output("experience-by-gender", "figure"),
        Output("bmi-by-experience", "figure"),
        Output("meal-distribution", "figure"),
        Output("experience-distribution", "figure"),
        Output("calories-box", "figure"),
        Output("correlation-heatmap", "figure"),
        Output("water-vs-calories", "figure"),
        Output("kpi-calories", "children"),
        Output("kpi-bmi", "children"),
        Output("kpi-water", "children"),
        Output("kpi-sessions", "children"),
    ],
    [
        Input("gender-dropdown", "value"),
        Input("workout-dropdown", "value"),
        Input("experience-dropdown", "value"),
    ],
)
def update_all(genders, workouts, experiences):
    filt = df.copy()
    if genders:
        filt = filt[filt["Gender"].isin(genders)]
    if workouts:
        filt = filt[filt["Workout_Type"].isin(workouts)]
    if experiences:
        filt = filt[filt["Experience_Level"].isin(experiences)]

    # KPIs (BLACK text)
    cal = filt["Calories_Burned"].mean()
    bmi = filt["BMI"].mean()
    wat = filt.get("Water_Intake (liters)", pd.Series([0])).mean()
    ses = len(filt)

    kpi_cal = f"Avg Calories Burned: {cal:,.0f}"
    kpi_bmi = f"Avg BMI: {bmi:.1f}"
    kpi_wat = f"Avg Water Intake: {wat:.2f} L"
    kpi_ses = f"Total Sessions: {ses:,}"

    def style(fig):
        fig.update_layout(
            paper_bgcolor=WHITE,
            plot_bgcolor=PLOT_BG,
            font_color=DARK_TEXT,
            title_font_color=TEAL,
            title_font_size=16,
            margin=dict(l=40, r=40, t=50, b=40),
            legend_title_font_color=DARK_TEXT,
        )
        return fig

    # SOFTER CHARTS
    fig1 = style(px.bar(
        filt.groupby(["Workout_Type", "Experience_Level"], as_index=False)["Calories_Burned"].mean(),
        x="Workout_Type", y="Calories_Burned", color="Experience_Level", barmode="group",
        color_discrete_sequence=PASTEL,
        title="Avg Calories Burned by Workout & Experience"
    ))

    fig2 = style(px.bar(
        filt.groupby(["Gender", "Experience_Level"]).size().reset_index(name="Count"),
        x="Gender", y="Count", color="Experience_Level", barmode="stack",
        color_discrete_sequence=PASTEL,
        title="Experience Levels by Gender"
    ))

    order = ["Beginner", "Intermediate", "Advanced"]
    bmi_df = filt.groupby("Experience_Level", as_index=False)["BMI"].mean() \
                 .sort_values(by="Experience_Level", key=lambda s: s.map({v: i for i, v in enumerate(order)}))
    fig3 = style(px.line(
        bmi_df, x="Experience_Level", y="BMI", markers=True,
        color_discrete_sequence=[TEAL], title="Avg BMI Progression by Experience"
    ))

    fig4 = style(px.sunburst(
        filt, path=["Gender", "meal_type"],
        color_discrete_sequence=PASTEL,
        title="Meal Type Distribution by Gender"
    ))

    fig5 = style(px.bar(
        filt["Experience_Level"].value_counts().reset_index(),
        x="Experience_Level", y="count",
        color_discrete_sequence=PASTEL,
        title="Overall Experience Distribution"
    ))

    fig6 = style(px.box(
        filt, x="Workout_Type", y="Calories_Burned", color="Workout_Type",
        color_discrete_sequence=PASTEL,
        title="Calories Burned Distribution"
    ))

    corr = filt[["Calories_Burned", "BMI", "Water_Intake (liters)", "Session_Duration (hours)",
                 "Avg_BPM", "Weight (kg)", "Height (m)"]].corr()
    fig7 = style(px.imshow(
        corr, text_auto=True, color_continuous_scale="Blues", title="Correlation Heatmap"
    ))

    fig8 = style(px.scatter(
        filt, x="Water_Intake (liters)", y="Calories_Burned", color="meal_type",
        color_discrete_sequence=PASTEL,
        title="Water Intake vs Calories Burned"
    ))

    return (
        fig1, fig2, fig3, fig4, fig5, fig6, fig7, fig8,
        kpi_cal, kpi_bmi, kpi_wat, kpi_ses
    )

# -------------------------------------------------
# 8. Run
# -------------------------------------------------
if __name__ == "__main__":
    print("BEAM Lifestyle Power Dashboard → http://127.0.0.1:8050")
    app.run_server(debug=True, port=8050)
