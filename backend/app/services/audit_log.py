import json

from sqlalchemy.orm import Session

from app.models import AuditLog


def add_audit_log(
    db: Session,
    *,
    tenant_id: str,
    action: str,
    target_type: str,
    actor_user_id: str | None = None,
    target_id: str | None = None,
    details: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details_json=json.dumps(details or {}),
    )
    db.add(entry)
    return entry
