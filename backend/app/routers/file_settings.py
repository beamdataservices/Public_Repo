from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.deps import get_db


router = APIRouter(prefix="/api/file-settings", tags=["file-settings"])


class FileSettingsOut(BaseModel):
    confirm_file_delete: bool
    recycle_bin_retention_days: int
    theme_preference: str


class FileSettingsIn(BaseModel):
    confirm_file_delete: bool | None = None
    recycle_bin_retention_days: int | None = Field(default=None)
    theme_preference: str | None = None


def _settings_out(current) -> FileSettingsOut:
    return FileSettingsOut(
        confirm_file_delete=current.confirm_file_delete,
        recycle_bin_retention_days=current.recycle_bin_retention_days,
        theme_preference=current.theme_preference,
    )


@router.get("", response_model=FileSettingsOut)
@router.get("/", response_model=FileSettingsOut)
def get_file_settings(current=Depends(get_current_user)):
    return _settings_out(current)


@router.put("/me", response_model=FileSettingsOut)
def update_file_settings(
    payload: FileSettingsIn,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    membership = current.membership
    if payload.confirm_file_delete is not None:
        membership.confirm_file_delete = payload.confirm_file_delete
    if payload.recycle_bin_retention_days is not None:
        if payload.recycle_bin_retention_days not in (30, 60, 90):
            raise HTTPException(status_code=422, detail="Recycle bin retention must be 30, 60, or 90 days.")
        membership.recycle_bin_retention_days = payload.recycle_bin_retention_days
    if payload.theme_preference is not None:
        if payload.theme_preference not in ("light", "dark"):
            raise HTTPException(status_code=422, detail="Theme must be light or dark.")
        membership.theme_preference = payload.theme_preference
    db.commit()
    db.refresh(membership)
    return _settings_out(current)
