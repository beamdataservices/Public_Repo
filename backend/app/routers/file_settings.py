from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.deps import get_db
from app.models import User


router = APIRouter(prefix="/api/file-settings", tags=["file-settings"])


class FileSettingsOut(BaseModel):
    confirm_file_delete: bool
    recycle_bin_retention_days: int
    theme_preference: str


class FileSettingsIn(BaseModel):
    confirm_file_delete: bool | None = None
    recycle_bin_retention_days: int | None = Field(default=None)
    theme_preference: str | None = None


def _settings_out(user: User) -> FileSettingsOut:
    return FileSettingsOut(
        confirm_file_delete=bool(user.confirm_file_delete),
        recycle_bin_retention_days=int(user.recycle_bin_retention_days or 30),
        theme_preference=user.theme_preference or "light",
    )


@router.get("", response_model=FileSettingsOut)
@router.get("/", response_model=FileSettingsOut)
def get_file_settings(user: User = Depends(get_current_user)):
    return _settings_out(user)


@router.put("/me", response_model=FileSettingsOut)
def update_file_settings(
    payload: FileSettingsIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.confirm_file_delete is not None:
        user.confirm_file_delete = payload.confirm_file_delete
    if payload.recycle_bin_retention_days is not None:
        if payload.recycle_bin_retention_days not in (30, 60, 90):
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="Recycle bin retention must be 30, 60, or 90 days.")
        user.recycle_bin_retention_days = payload.recycle_bin_retention_days
    if payload.theme_preference is not None:
        if payload.theme_preference not in ("light", "dark"):
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="Theme must be light or dark.")
        user.theme_preference = payload.theme_preference
    db.commit()
    db.refresh(user)
    return _settings_out(user)
