from fastapi import APIRouter, Depends, HTTPException
from app.models import User, File
from app.auth import get_current_user
from app.deps import get_db
from sqlalchemy.orm import Session
from app.insights import generate_insights,load_file_from_blob, generate_ai_summary

router = APIRouter(prefix="/api/files", tags=["insights"])

@router.post("/{file_id}/insights")
async def get_file_insights(
    file_id: str,
    payload: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file = (
        db.query(File)
        .filter(File.id == file_id, File.tenant_id == user.tenant_id)
        .first()
    )

    if not file:
        raise HTTPException(404, "File not found")

    filters = payload.get("filters", {})

    return generate_insights(file.blob_path, filters)

@router.post("/{file_id}/ai-summary")
def regenerate_ai_summary(
    file_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file = (
        db.query(File)
        .filter(File.id == file_id, File.tenant_id == user.tenant_id)
        .first()
    )
    if not file:
        raise HTTPException(404, "File not found")

    df = load_file_from_blob(file.blob_path)
    summary = generate_ai_summary(df)
    return {"summary": summary}
