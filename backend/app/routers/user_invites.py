from datetime import datetime, timedelta
import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import admin_required, hash_password
from app.config import get_settings
from app.deps import get_db
from app.models import AuditLog, Tenant, User, UserInvite, UserRole
from app.services.audit_log import add_audit_log
from app.services.email_sender import send_email


settings = get_settings()
admin_router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])
public_router = APIRouter(prefix="/auth/invitations", tags=["auth"])


class TenantUserOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class UserInviteOut(BaseModel):
    id: str
    email: str
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime


class TenantUsersOut(BaseModel):
    tenant_name: str
    users: list[TenantUserOut]
    pending_invites: list[UserInviteOut]


class CreateInviteIn(BaseModel):
    email: EmailStr


class CreateInviteOut(UserInviteOut):
    email_sent: bool
    invite_url: str | None = None


class AcceptInviteIn(BaseModel):
    token: str = Field(..., min_length=20)
    password: str = Field(..., min_length=8, max_length=128)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _invite_url(token: str) -> str:
    return f"{settings.FRONTEND_BASE_URL.rstrip('/')}/accept-invite?token={token}"


def _send_invite_email(email: str, invite_url: str, expires_at: datetime) -> bool:
    return send_email(
        email,
        "You have been invited to BEAM Analytics",
        "You have been invited to join a BEAM Analytics tenant.\n\n"
        f"Create your account: {invite_url}\n\n"
        f"This invitation expires at {expires_at.isoformat()} UTC.",
    )


def _invite_out(invite: UserInvite) -> UserInviteOut:
    return UserInviteOut(
        id=str(invite.id),
        email=invite.email,
        expires_at=invite.expires_at,
        accepted_at=invite.accepted_at,
        created_at=invite.created_at,
    )


def _enforce_invite_rate_limit(db: Session, user: User) -> None:
    cutoff = datetime.utcnow() - timedelta(hours=1)
    count = (
        db.query(AuditLog)
        .filter(
            AuditLog.actor_user_id == user.id,
            AuditLog.action.in_(["invitation.created", "invitation.resent"]),
            AuditLog.created_at >= cutoff,
        )
        .count()
    )
    if count >= settings.INVITE_MAX_PER_HOUR:
        raise HTTPException(status_code=429, detail="Invitation rate limit reached. Please try again later.")


def _deliver_invite(invite: UserInvite, token: str) -> CreateInviteOut:
    invite_url = _invite_url(token)
    try:
        email_sent = _send_invite_email(invite.email, invite_url, invite.expires_at)
    except Exception:
        email_sent = False
    return CreateInviteOut(
        **_invite_out(invite).model_dump(),
        email_sent=email_sent,
        invite_url=None if email_sent else invite_url,
    )


@admin_router.get("", response_model=TenantUsersOut)
@admin_router.get("/", response_model=TenantUsersOut)
def list_tenant_users(db: Session = Depends(get_db), user: User = Depends(admin_required)):
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    users = db.query(User).filter(User.tenant_id == user.tenant_id).order_by(User.created_at.asc()).all()
    invites = (
        db.query(UserInvite)
        .filter(
            UserInvite.tenant_id == user.tenant_id,
            UserInvite.accepted_at.is_(None),
            UserInvite.revoked_at.is_(None),
            UserInvite.expires_at > datetime.utcnow(),
        )
        .order_by(UserInvite.created_at.desc())
        .all()
    )
    return TenantUsersOut(
        tenant_name=tenant.name if tenant else "",
        users=[
            TenantUserOut(
                id=str(item.id),
                email=item.email,
                role=item.role.value,
                is_active=bool(item.is_active),
                created_at=item.created_at,
            )
            for item in users
        ],
        pending_invites=[_invite_out(item) for item in invites],
    )


@admin_router.post("/invitations", response_model=CreateInviteOut, status_code=status.HTTP_201_CREATED)
def create_user_invite(payload: CreateInviteIn, db: Session = Depends(get_db), user: User = Depends(admin_required)):
    _enforce_invite_rate_limit(db, user)
    email = payload.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="A user with this email already has an account.")

    existing = (
        db.query(UserInvite)
        .filter(
            UserInvite.tenant_id == user.tenant_id,
            func.lower(UserInvite.email) == email,
            UserInvite.accepted_at.is_(None),
            UserInvite.revoked_at.is_(None),
            UserInvite.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="An active invitation already exists for this email.")

    token = secrets.token_urlsafe(32)
    invite = UserInvite(
        tenant_id=user.tenant_id,
        email=email,
        token_hash=_token_hash(token),
        invited_by=user.id,
        expires_at=datetime.utcnow() + timedelta(hours=settings.INVITE_EXPIRE_HOURS),
        last_sent_at=datetime.utcnow(),
    )
    db.add(invite)
    db.flush()
    add_audit_log(
        db,
        tenant_id=str(user.tenant_id),
        actor_user_id=str(user.id),
        action="invitation.created",
        target_type="invitation",
        target_id=str(invite.id),
        details={"email": email},
    )
    db.commit()
    db.refresh(invite)
    return _deliver_invite(invite, token)


@admin_router.post("/invitations/{invite_id}/resend", response_model=CreateInviteOut)
def resend_user_invite(invite_id: str, db: Session = Depends(get_db), user: User = Depends(admin_required)):
    _enforce_invite_rate_limit(db, user)
    invite = (
        db.query(UserInvite)
        .filter(
            UserInvite.id == invite_id,
            UserInvite.tenant_id == user.tenant_id,
            UserInvite.accepted_at.is_(None),
            UserInvite.revoked_at.is_(None),
        )
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Pending invitation not found.")

    token = secrets.token_urlsafe(32)
    invite.token_hash = _token_hash(token)
    invite.expires_at = datetime.utcnow() + timedelta(hours=settings.INVITE_EXPIRE_HOURS)
    invite.last_sent_at = datetime.utcnow()
    add_audit_log(
        db,
        tenant_id=str(user.tenant_id),
        actor_user_id=str(user.id),
        action="invitation.resent",
        target_type="invitation",
        target_id=str(invite.id),
        details={"email": invite.email},
    )
    db.commit()
    db.refresh(invite)
    return _deliver_invite(invite, token)


@admin_router.delete("/invitations/{invite_id}", response_model=dict[str, str])
def revoke_user_invite(invite_id: str, db: Session = Depends(get_db), user: User = Depends(admin_required)):
    invite = (
        db.query(UserInvite)
        .filter(
            UserInvite.id == invite_id,
            UserInvite.tenant_id == user.tenant_id,
            UserInvite.accepted_at.is_(None),
            UserInvite.revoked_at.is_(None),
        )
        .first()
    )
    if not invite:
        raise HTTPException(status_code=404, detail="Pending invitation not found.")
    invite.revoked_at = datetime.utcnow()
    add_audit_log(
        db,
        tenant_id=str(user.tenant_id),
        actor_user_id=str(user.id),
        action="invitation.revoked",
        target_type="invitation",
        target_id=str(invite.id),
        details={"email": invite.email},
    )
    db.commit()
    return {"detail": "Invitation revoked."}


@admin_router.delete("/{target_user_id}", response_model=dict[str, str])
def deactivate_user(target_user_id: str, db: Session = Depends(get_db), user: User = Depends(admin_required)):
    target = db.query(User).filter(User.id == target_user_id, User.tenant_id == user.tenant_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.id == user.id or target.role == UserRole.admin:
        raise HTTPException(status_code=400, detail="Tenant admins cannot be deactivated here.")
    target.is_active = False
    add_audit_log(
        db,
        tenant_id=str(user.tenant_id),
        actor_user_id=str(user.id),
        action="user.deactivated",
        target_type="user",
        target_id=str(target.id),
        details={"email": target.email},
    )
    db.commit()
    return {"detail": "User deactivated."}


@admin_router.post("/{target_user_id}/reactivate", response_model=dict[str, str])
def reactivate_user(target_user_id: str, db: Session = Depends(get_db), user: User = Depends(admin_required)):
    target = db.query(User).filter(User.id == target_user_id, User.tenant_id == user.tenant_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.role == UserRole.admin:
        raise HTTPException(status_code=400, detail="Tenant admins cannot be changed here.")
    target.is_active = True
    add_audit_log(
        db,
        tenant_id=str(user.tenant_id),
        actor_user_id=str(user.id),
        action="user.reactivated",
        target_type="user",
        target_id=str(target.id),
        details={"email": target.email},
    )
    db.commit()
    return {"detail": "User reactivated."}


@public_router.post("/accept", response_model=dict[str, str])
def accept_user_invite(payload: AcceptInviteIn, db: Session = Depends(get_db)):
    invite = (
        db.query(UserInvite)
        .filter(
            UserInvite.token_hash == _token_hash(payload.token),
            UserInvite.accepted_at.is_(None),
            UserInvite.revoked_at.is_(None),
            UserInvite.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not invite:
        raise HTTPException(status_code=400, detail="This invitation is invalid or has expired.")
    if db.query(User).filter(func.lower(User.email) == invite.email.lower()).first():
        raise HTTPException(status_code=409, detail="An account already exists for this email.")

    new_user = User(
        tenant_id=invite.tenant_id,
        email=invite.email,
        password_hash=hash_password(payload.password),
        role=UserRole.user,
        is_active=True,
    )
    db.add(new_user)
    db.flush()
    invite.accepted_at = datetime.utcnow()
    add_audit_log(
        db,
        tenant_id=str(invite.tenant_id),
        action="invitation.accepted",
        target_type="user",
        target_id=str(new_user.id),
        details={"email": invite.email},
    )
    db.commit()
    return {"detail": "Account created. You can now sign in."}
