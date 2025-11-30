# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .auth_routes import router as auth_router
from .routers import files

app = FastAPI(
    title="BEAM Analytics Backend",
    version="0.1.0",
)

# --- CORS (required for frontend calls) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # later restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DB initialization ---
@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


# --- Routes ---
app.include_router(auth_router)                      # /auth/*
app.include_router(files.router, prefix="/api/files", tags=["files"])
