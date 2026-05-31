from datetime import datetime, timedelta
import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.config import get_settings
from app.deps import get_db
from app.models import PasswordResetToken, User
from app.services.audit_log import add_audit_log
from app.services.email_sender import send_email
from app.services.email_templates import password_reset_email


settings = get_settings()
router = APIRouter(prefix="/auth/password-reset", tags=["auth"])


class RequestPasswordResetIn(BaseModel):
    email: EmailStr


class ConfirmPasswordResetIn(BaseModel):
    token: str = Field(..., min_length=20)
    password: str = Field(..., min_length=8, max_length=128)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.post("/request", response_model=dict[str, str])
def request_password_reset(payload: RequestPasswordResetIn, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .filter(func.lower(User.email) == payload.email.lower(), User.is_active == True)
        .first()
    )
    if user:
        cutoff = datetime.utcnow() - timedelta(hours=1)
        recent_count = (
            db.query(PasswordResetToken)
            .filter(PasswordResetToken.user_id == user.id, PasswordResetToken.created_at >= cutoff)
            .count()
        )
        if recent_count < settings.PASSWORD_RESET_MAX_PER_HOUR:
            db.query(PasswordResetToken).filter(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at.is_(None),
            ).update({"used_at": datetime.utcnow()})
            token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)
            reset = PasswordResetToken(
                user_id=user.id,
                token_hash=_token_hash(token),
                expires_at=expires_at,
            )
            db.add(reset)
            add_audit_log(
                db,
                tenant_id=str(user.tenant_id),
                actor_user_id=str(user.id),
                action="password_reset.requested",
                target_type="user",
                target_id=str(user.id),
                details={"email": user.email},
            )
            db.commit()
            reset_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?token={token}"
            plain_text, html = password_reset_email(reset_url, expires_at)
            try:
                send_email(
                    user.email,
                    "Reset your BEAM Analytics password",
                    plain_text,
                    html,
                )
            except Exception:
                pass

    return {"detail": "If an active account matches that email, a password reset link has been sent."}


@router.post("/confirm", response_model=dict[str, str])
def confirm_password_reset(payload: ConfirmPasswordResetIn, db: Session = Depends(get_db)):
    reset = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == _token_hash(payload.token),
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not reset:
        raise HTTPException(status_code=400, detail="This password reset link is invalid or has expired.")

    user = db.query(User).filter(User.id == reset.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=400, detail="This password reset link is invalid or has expired.")

    user.password_hash = hash_password(payload.password)
    reset.used_at = datetime.utcnow()
    add_audit_log(
        db,
        tenant_id=str(user.tenant_id),
        actor_user_id=str(user.id),
        action="password_reset.completed",
        target_type="user",
        target_id=str(user.id),
        details={"email": user.email},
    )
    db.commit()
    return {"detail": "Password updated. You can now sign in."}
