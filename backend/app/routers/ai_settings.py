from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import admin_required, get_current_user
from app.deps import get_db
from app.models import Tenant


router = APIRouter(prefix="/api/ai-settings", tags=["ai-settings"])


class AISettingsOut(BaseModel):
    tenant_ai_enabled: bool
    user_ai_enabled: bool
    effective_ai_enabled: bool


class UserAISettingsIn(BaseModel):
    ai_enabled: bool


class TenantAISettingsIn(BaseModel):
    ai_enabled: bool


def _settings_out(current) -> AISettingsOut:
    tenant_enabled = bool(current.tenant.ai_enabled)
    user_enabled = bool(current.membership.ai_enabled)
    return AISettingsOut(
        tenant_ai_enabled=tenant_enabled,
        user_ai_enabled=user_enabled,
        effective_ai_enabled=tenant_enabled and user_enabled,
    )


@router.get("", response_model=AISettingsOut)
@router.get("/", response_model=AISettingsOut)
def get_ai_settings(current=Depends(get_current_user)):
    return _settings_out(current)


@router.put("/me", response_model=AISettingsOut)
def update_my_ai_settings(
    payload: UserAISettingsIn,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    current.membership.ai_enabled = payload.ai_enabled
    db.commit()
    db.refresh(current.membership)
    return _settings_out(current)


@router.put("/tenant", response_model=AISettingsOut)
def update_tenant_ai_settings(
    payload: TenantAISettingsIn,
    db: Session = Depends(get_db),
    current=Depends(admin_required),
):
    tenant = db.query(Tenant).filter(Tenant.id == current.tenant_id).first()
    tenant.ai_enabled = payload.ai_enabled
    db.commit()
    db.refresh(tenant)
    current.tenant.ai_enabled = tenant.ai_enabled
    return _settings_out(current)
