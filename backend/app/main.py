from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers.auth_routes import router as auth_router
from .routers import files
from .routers.insights_routes import router as insights_router


# ------------------------
# Create FastAPI application
# ------------------------
app = FastAPI(
    title="BEAM Analytics Backend",
    version="0.1.0",
)


# ------------------------
# CORS Middleware
# ------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # TODO: lock down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------
# Startup DB initialization
# ------------------------
@app.on_event("startup")
def on_startup():
    init_db()


# ------------------------
# Health Check
# ------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


# ------------------------
# Routers
# ------------------------
app.include_router(auth_router)                                   # /auth/*
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(insights_router)                               # /api/files/{id}/insights
