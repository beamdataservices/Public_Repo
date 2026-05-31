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


class FileSettingsIn(BaseModel):
    confirm_file_delete: bool | None = None
    recycle_bin_retention_days: int | None = Field(default=None)


def _settings_out(user: User) -> FileSettingsOut:
    return FileSettingsOut(
        confirm_file_delete=bool(user.confirm_file_delete),
        recycle_bin_retention_days=int(user.recycle_bin_retention_days or 30),
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
    db.commit()
    db.refresh(user)
    return _settings_out(user)
