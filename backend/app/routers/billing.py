from __future__ import annotations

from datetime import datetime
from typing import Any

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.auth import CurrentAccount, admin_required, get_current_user
from app.config import get_settings
from app.deps import get_db
from app.models import AccountBilling, AccountMembership, Tenant, TenantPlan, User, UserRole
from app.services.account_limits import get_or_create_billing, visible_limits_summary
from app.services.email_sender import send_email
from app.services.email_templates import premium_subscription_email


settings = get_settings()
router = APIRouter(tags=["billing"])


class CheckoutSessionIn(BaseModel):
    billing_email: EmailStr | None = None


def _stripe_configured() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured yet. Add STRIPE_SECRET_KEY to the backend environment.")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    stripe.api_version = "2026-02-25.clover"


def _billing_configured() -> None:
    _stripe_configured()
    if not settings.STRIPE_PREMIUM_PRICE_ID:
        raise HTTPException(status_code=503, detail="Stripe Premium price is not configured yet. Add STRIPE_PREMIUM_PRICE_ID.")


def _dt(timestamp: Any) -> datetime | None:
    try:
        return datetime.utcfromtimestamp(int(timestamp)) if timestamp else None
    except Exception:
        return None


def _is_premium_status(status: str | None) -> bool:
    return status in {"active", "trialing"}


def _is_downgrade_status(status: str | None) -> bool:
    return status in {"canceled", "unpaid", "incomplete_expired", "paused"}


def _update_plan_for_status(tenant: Tenant | None, status: str | None) -> None:
    if not tenant:
        return
    if _is_premium_status(status):
        tenant.plan = TenantPlan.standard
    elif _is_downgrade_status(status):
        tenant.plan = TenantPlan.demo


def _subscription_price_id(subscription: Any) -> str | None:
    try:
        items = subscription.get("items", {}).get("data", [])
        if items:
            return items[0].get("price", {}).get("id")
    except Exception:
        return None
    return None


def _find_billing_for_subscription(db: Session, subscription: Any) -> AccountBilling | None:
    metadata = subscription.get("metadata", {}) or {}
    tenant_id = metadata.get("tenant_id")
    if tenant_id:
        billing = db.query(AccountBilling).filter(AccountBilling.tenant_id == tenant_id).first()
        if billing:
            return billing
    subscription_id = subscription.get("id")
    customer_id = subscription.get("customer")
    query = db.query(AccountBilling)
    if subscription_id:
        billing = query.filter(AccountBilling.stripe_subscription_id == subscription_id).first()
        if billing:
            return billing
    if customer_id:
        return query.filter(AccountBilling.stripe_customer_id == customer_id).first()
    return None


def _apply_subscription(db: Session, subscription: Any, billing: AccountBilling | None = None) -> AccountBilling | None:
    billing = billing or _find_billing_for_subscription(db, subscription)
    if not billing:
        return None

    billing.stripe_subscription_id = subscription.get("id")
    billing.stripe_customer_id = subscription.get("customer") or billing.stripe_customer_id
    billing.stripe_price_id = _subscription_price_id(subscription) or billing.stripe_price_id
    billing.status = subscription.get("status") or "unknown"
    billing.current_period_start = _dt(subscription.get("current_period_start"))
    billing.current_period_end = _dt(subscription.get("current_period_end"))
    billing.cancel_at_period_end = bool(subscription.get("cancel_at_period_end") or False)

    tenant = db.query(Tenant).filter(Tenant.id == billing.tenant_id).first()
    _update_plan_for_status(tenant, billing.status)
    return billing


def _billing_email_recipient(db: Session, billing: AccountBilling) -> str | None:
    if billing.billing_email:
        return billing.billing_email
    owner = (
        db.query(User)
        .join(AccountMembership, AccountMembership.user_id == User.id)
        .filter(
            AccountMembership.tenant_id == billing.tenant_id,
            AccountMembership.role.in_([UserRole.owner, UserRole.admin]),
            AccountMembership.is_active == True,
        )
        .order_by(AccountMembership.created_at.asc())
        .first()
    )
    return owner.email if owner else None


def _send_premium_thank_you_if_needed(db: Session, billing: AccountBilling) -> None:
    if billing.premium_welcome_sent_at or not _is_premium_status(billing.status):
        return
    recipient = _billing_email_recipient(db, billing)
    if not recipient:
        return
    tenant = db.query(Tenant).filter(Tenant.id == billing.tenant_id).first()
    account_name = tenant.name if tenant else "your account"
    account_billing_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/dashboard/account-billing"
    plain_text, html = premium_subscription_email(account_name, account_billing_url)
    try:
        if send_email(recipient, "Thank you for upgrading to BEAM Analytics Premium", plain_text, html):
            billing.premium_welcome_sent_at = datetime.utcnow()
    except Exception:
        pass


def _sync_customer_subscription(db: Session, billing: AccountBilling) -> AccountBilling:
    _stripe_configured()
    if not billing.stripe_customer_id:
        return billing

    subscriptions = stripe.Subscription.list(
        customer=billing.stripe_customer_id,
        status="all",
        limit=10,
    )
    candidates = subscriptions.get("data", [])
    candidates = sorted(
        candidates,
        key=lambda item: int(item.get("created") or 0),
        reverse=True,
    )
    for subscription in candidates:
        if subscription.get("status") in {"active", "trialing", "past_due", "unpaid", "canceled", "incomplete_expired", "paused"}:
            applied = _apply_subscription(db, subscription, billing)
            if applied:
                return applied
    return billing


@router.get("/api/account/limits")
def account_limits(db: Session = Depends(get_db), user: CurrentAccount = Depends(get_current_user)):
    return visible_limits_summary(db, user)


@router.get("/api/billing/account")
def account_billing(db: Session = Depends(get_db), user: CurrentAccount = Depends(admin_required)):
    billing = get_or_create_billing(db, str(user.tenant_id), user.email)
    db.commit()
    return {
        "tenant_id": str(user.tenant_id),
        "account_name": user.tenant.name,
        "plan": "premium" if user.tenant.plan == TenantPlan.standard else "demo",
        "plan_label": "Premium" if user.tenant.plan == TenantPlan.standard else "Demo",
        "subscription_status": billing.status,
        "billing_email": billing.billing_email,
        "current_period_end": billing.current_period_end,
        "cancel_at_period_end": bool(billing.cancel_at_period_end),
        "has_customer": bool(billing.stripe_customer_id),
        "limits": visible_limits_summary(db, user),
    }


@router.post("/api/billing/sync")
def sync_account_billing(db: Session = Depends(get_db), user: CurrentAccount = Depends(admin_required)):
    billing = get_or_create_billing(db, str(user.tenant_id), user.email)
    billing = _sync_customer_subscription(db, billing)
    _send_premium_thank_you_if_needed(db, billing)
    db.commit()
    db.refresh(billing)
    return {
        "subscription_status": billing.status,
        "current_period_end": billing.current_period_end,
        "plan": "premium" if user.tenant.plan == TenantPlan.standard else "demo",
    }


@router.post("/api/billing/checkout-session")
def create_checkout_session(
    payload: CheckoutSessionIn,
    db: Session = Depends(get_db),
    user: CurrentAccount = Depends(admin_required),
):
    _billing_configured()
    billing = get_or_create_billing(db, str(user.tenant_id), payload.billing_email or user.email)

    if not billing.stripe_customer_id:
        customer = stripe.Customer.create(
            email=payload.billing_email or user.email,
            name=user.tenant.name,
            metadata={"tenant_id": str(user.tenant_id)},
        )
        billing.stripe_customer_id = customer["id"]

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            ui_mode="embedded",
            customer=billing.stripe_customer_id,
            line_items=[{"price": settings.STRIPE_PREMIUM_PRICE_ID, "quantity": 1}],
            return_url=f"{settings.FRONTEND_BASE_URL.rstrip('/')}/dashboard/account-billing?checkout=complete",
            client_reference_id=str(user.tenant_id),
            metadata={"tenant_id": str(user.tenant_id)},
            subscription_data={"metadata": {"tenant_id": str(user.tenant_id)}},
        )
    except stripe.StripeError as ex:
        db.rollback()
        message = getattr(ex, "user_message", None) or str(ex)
        raise HTTPException(status_code=502, detail=f"Stripe checkout could not be started: {message}")
    except Exception as ex:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Checkout could not be started: {ex}")

    billing.stripe_checkout_session_id = session["id"]
    billing.billing_email = payload.billing_email or billing.billing_email or user.email
    db.commit()
    return {"client_secret": session["client_secret"]}


@router.post("/api/billing/portal-session")
def create_portal_session(db: Session = Depends(get_db), user: CurrentAccount = Depends(admin_required)):
    _stripe_configured()
    billing = db.query(AccountBilling).filter(AccountBilling.tenant_id == user.tenant_id).first()
    if not billing or not billing.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer exists for this account yet.")

    session = stripe.billing_portal.Session.create(
        customer=billing.stripe_customer_id,
        return_url=f"{settings.FRONTEND_BASE_URL.rstrip('/')}/dashboard/account-billing",
    )
    return {"url": session["url"]}


@router.post("/api/stripe/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    _stripe_configured()
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook secret is not configured.")

    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, signature, settings.STRIPE_WEBHOOK_SECRET)
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"Invalid Stripe webhook: {ex}")

    event_type = event.get("type")
    data = event.get("data", {}).get("object", {})

    try:
        if event_type == "checkout.session.completed":
            tenant_id = (data.get("metadata") or {}).get("tenant_id") or data.get("client_reference_id")
            if tenant_id:
                billing = get_or_create_billing(db, tenant_id, data.get("customer_details", {}).get("email"))
                billing.stripe_customer_id = data.get("customer") or billing.stripe_customer_id
                billing.stripe_subscription_id = data.get("subscription") or billing.stripe_subscription_id
                billing.stripe_checkout_session_id = data.get("id") or billing.stripe_checkout_session_id
                if billing.stripe_subscription_id:
                    subscription = stripe.Subscription.retrieve(billing.stripe_subscription_id)
                    _apply_subscription(db, subscription, billing)

        elif event_type in {"customer.subscription.created", "customer.subscription.updated"}:
            _apply_subscription(db, data)

        elif event_type == "customer.subscription.deleted":
            billing = _apply_subscription(db, data)
            if billing:
                tenant = db.query(Tenant).filter(Tenant.id == billing.tenant_id).first()
                if tenant:
                    tenant.plan = TenantPlan.demo

        elif event_type in {"invoice.payment_succeeded", "invoice.payment_failed"}:
            subscription_id = data.get("subscription")
            if subscription_id:
                subscription = stripe.Subscription.retrieve(subscription_id)
                _apply_subscription(db, subscription)

        if event_type in {
            "checkout.session.completed",
            "customer.subscription.created",
            "customer.subscription.updated",
            "invoice.payment_succeeded",
        }:
            subscription_id = data.get("subscription") or data.get("id")
            customer_id = data.get("customer")
            billing = None
            if subscription_id:
                billing = db.query(AccountBilling).filter(AccountBilling.stripe_subscription_id == subscription_id).first()
            if not billing and customer_id:
                billing = db.query(AccountBilling).filter(AccountBilling.stripe_customer_id == customer_id).first()
            if billing:
                _send_premium_thank_you_if_needed(db, billing)

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"received": True}
