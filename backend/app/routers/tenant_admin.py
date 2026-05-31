from datetime import datetime
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import admin_required
from app.deps import get_db
from app.models import AuditLog, Tenant, User
from app.services.audit_log import add_audit_log


router = APIRouter(prefix="/api/admin/tenant", tags=["admin-tenant"])


class DeactivateTenantIn(BaseModel):
    confirmation: str = Field(..., min_length=1)


class AuditLogOut(BaseModel):
    id: str
    action: str
    target_type: str
    target_id: str | None
    details: dict
    created_at: datetime


@router.get("/audit-log", response_model=list[AuditLogOut])
def list_audit_log(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(admin_required),
):
    entries = (
        db.query(AuditLog)
        .filter(AuditLog.tenant_id == user.tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        AuditLogOut(
            id=str(entry.id),
            action=entry.action,
            target_type=entry.target_type,
            target_id=entry.target_id,
            details=json.loads(entry.details_json or "{}"),
            created_at=entry.created_at,
        )
        for entry in entries
    ]


@router.delete("", response_model=dict[str, str])
@router.delete("/", response_model=dict[str, str])
def deactivate_tenant(
    payload: DeactivateTenantIn,
    db: Session = Depends(get_db),
    user: User = Depends(admin_required),
):
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")
    if payload.confirmation.strip() != tenant.name:
        raise HTTPException(status_code=400, detail="Tenant name confirmation does not match.")

    add_audit_log(
        db,
        tenant_id=str(tenant.id),
        actor_user_id=str(user.id),
        action="tenant.deactivated",
        target_type="tenant",
        target_id=str(tenant.id),
        details={"tenant_name": tenant.name},
    )
    tenant.is_active = False
    db.query(User).filter(User.tenant_id == tenant.id).update({"is_active": False})
    db.commit()
    return {"detail": "Tenant access deactivated. Data remains preserved for administrative recovery."}
