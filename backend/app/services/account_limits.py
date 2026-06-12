from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AccountBilling, AccountMembership, File, LLMUsageEvent, Tenant, TenantPlan, User, UserInvite, UserRole


settings = get_settings()


def is_premium_plan(tenant: Tenant | None) -> bool:
    return bool(tenant and tenant.plan == TenantPlan.standard)


def plan_label(tenant: Tenant | None) -> str:
    return "Premium" if is_premium_plan(tenant) else "Demo"


def bytes_to_mb(value: int | None) -> float:
    return round(float(value or 0) / (1024 * 1024), 2)


def get_tenant(db: Session, tenant_id: str) -> Tenant | None:
    return db.query(Tenant).filter(Tenant.id == tenant_id).first()


def get_billing(db: Session, tenant_id: str) -> AccountBilling | None:
    return db.query(AccountBilling).filter(AccountBilling.tenant_id == tenant_id).first()


def get_or_create_billing(db: Session, tenant_id: str, billing_email: str | None = None) -> AccountBilling:
    billing = get_billing(db, tenant_id)
    if billing:
        if billing_email and not billing.billing_email:
            billing.billing_email = billing_email
        return billing
    billing = AccountBilling(
        tenant_id=tenant_id,
        billing_email=billing_email,
        status="none",
    )
    db.add(billing)
    db.flush()
    return billing


def file_usage(db: Session, tenant_id: str) -> dict[str, int]:
    count = db.query(File).filter(File.tenant_id == tenant_id).count()
    total_bytes = (
        db.query(func.coalesce(func.sum(File.size_bytes), 0))
        .filter(File.tenant_id == tenant_id)
        .scalar()
        or 0
    )
    return {"count": int(count), "bytes": int(total_bytes)}


def invite_usage(db: Session, tenant_id: str) -> dict[str, int]:
    now = datetime.utcnow()
    active_members = (
        db.query(AccountMembership)
        .filter(
            AccountMembership.tenant_id == tenant_id,
            AccountMembership.is_active == True,
            AccountMembership.role.notin_([UserRole.owner, UserRole.admin]),
        )
        .count()
    )
    pending_invites = (
        db.query(UserInvite)
        .filter(
            UserInvite.tenant_id == tenant_id,
            UserInvite.accepted_at.is_(None),
            UserInvite.revoked_at.is_(None),
            UserInvite.expires_at > now,
        )
        .count()
    )
    return {"active_members": int(active_members), "pending_invites": int(pending_invites), "used": int(active_members + pending_invites)}


def _success_cost_sum(query) -> Decimal:
    value = query.filter(LLMUsageEvent.status == "success").scalar() or Decimal("0")
    return Decimal(str(value))


def demo_ai_usage(db: Session, tenant_id: str, user_id: str) -> Decimal:
    return _success_cost_sum(
        db.query(func.coalesce(func.sum(LLMUsageEvent.estimated_cost), 0)).filter(
            LLMUsageEvent.tenant_id == tenant_id,
            LLMUsageEvent.user_id == user_id,
        )
    )


def premium_ai_usage(db: Session, tenant_id: str, billing: AccountBilling | None) -> Decimal:
    query = db.query(func.coalesce(func.sum(LLMUsageEvent.estimated_cost), 0)).filter(
        LLMUsageEvent.tenant_id == tenant_id,
    )
    if billing and billing.current_period_start:
        query = query.filter(LLMUsageEvent.created_at >= billing.current_period_start)
    if billing and billing.current_period_end:
        query = query.filter(LLMUsageEvent.created_at < billing.current_period_end)
    return _success_cost_sum(query)


def ensure_upload_allowed(db: Session, user: User, file_size_bytes: int) -> None:
    tenant = get_tenant(db, str(user.tenant_id))
    premium = is_premium_plan(tenant)
    max_file_bytes = settings.PREMIUM_FILE_MAX_BYTES if premium else settings.DEMO_FILE_MAX_BYTES
    if file_size_bytes > max_file_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large for your {plan_label(tenant)} account. Maximum upload size is {bytes_to_mb(max_file_bytes):g} MB.",
        )

    if premium:
        return

    usage = file_usage(db, str(user.tenant_id))
    if usage["count"] >= settings.DEMO_LIFETIME_UPLOADS:
        raise HTTPException(
            status_code=402,
            detail="Your Demo account has reached its lifetime upload limit. Upgrade to Premium to continue uploading files.",
        )
    if usage["bytes"] + file_size_bytes > settings.DEMO_LIFETIME_UPLOAD_BYTES:
        raise HTTPException(
            status_code=402,
            detail="This upload would exceed the Demo account lifetime storage limit. Upgrade to Premium to continue uploading files.",
        )


def ensure_invite_allowed(db: Session, user: User) -> None:
    tenant = get_tenant(db, str(user.tenant_id))
    if is_premium_plan(tenant):
        return
    usage = invite_usage(db, str(user.tenant_id))
    if usage["used"] >= settings.DEMO_EXTRA_USERS:
        raise HTTPException(
            status_code=402,
            detail="Demo accounts can add one additional user. Upgrade to Premium to invite more users.",
        )


def ai_limit_message(db: Session, user: User) -> str | None:
    tenant = get_tenant(db, str(user.tenant_id))
    if is_premium_plan(tenant):
        billing = get_billing(db, str(user.tenant_id))
        if premium_ai_usage(db, str(user.tenant_id), billing) >= Decimal(str(settings.PREMIUM_AI_MONTHLY_USD)):
            return "This account has reached its included monthly AI usage. Please contact the account owner or try again next billing period."
        return None

    if demo_ai_usage(db, str(user.tenant_id), str(user.id)) >= Decimal(str(settings.DEMO_AI_USER_LIFETIME_USD)):
        return "Your Demo AI usage has reached its limit. Upgrade to Premium to continue using AI features."
    return None


def visible_limits_summary(db: Session, user: User) -> dict[str, Any]:
    tenant = get_tenant(db, str(user.tenant_id))
    billing = get_billing(db, str(user.tenant_id))
    premium = is_premium_plan(tenant)
    files = file_usage(db, str(user.tenant_id))
    invites = invite_usage(db, str(user.tenant_id))

    summary: dict[str, Any] = {
        "plan": "premium" if premium else "demo",
        "plan_label": plan_label(tenant),
        "subscription_status": billing.status if billing else "none",
        "files": {
            "lifetime_uploads": files["count"],
            "lifetime_upload_limit": None if premium else settings.DEMO_LIFETIME_UPLOADS,
            "lifetime_bytes": files["bytes"],
            "lifetime_mb": bytes_to_mb(files["bytes"]),
            "lifetime_mb_limit": None if premium else bytes_to_mb(settings.DEMO_LIFETIME_UPLOAD_BYTES),
            "per_file_mb_limit": bytes_to_mb(settings.PREMIUM_FILE_MAX_BYTES if premium else settings.DEMO_FILE_MAX_BYTES),
        },
        "users": {
            "active_extra_users": invites["active_members"],
            "pending_invites": invites["pending_invites"],
            "used": invites["used"],
            "extra_user_limit": None if premium else settings.DEMO_EXTRA_USERS,
        },
        "ai": {
            "premium_monthly_included": premium,
        },
    }
    if premium:
        summary["ai"]["period_status"] = "available" if not ai_limit_message(db, user) else "limit_reached"
    else:
        used = demo_ai_usage(db, str(user.tenant_id), str(user.id))
        limit = Decimal(str(settings.DEMO_AI_USER_LIFETIME_USD))
        summary["ai"].update(
            {
                "demo_user_spend": float(round(used, 4)),
                "demo_user_limit": float(limit),
                "demo_remaining": float(round(max(Decimal("0"), limit - used), 4)),
            }
        )
    return summary
