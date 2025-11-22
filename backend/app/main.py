# backend/app/main.py
from fastapi import FastAPI
from .db import init_db
from .routers import files

app = FastAPI(
    title="BEAM Analytics Backend",
    version="0.1.0",
)

# Initialize DB tables at startup
@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(files.router, prefix="/api/files", tags=["files"])
