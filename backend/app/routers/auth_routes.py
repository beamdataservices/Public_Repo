from datetime import datetime, timedelta
import re
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    create_account_selection_token,
    create_refresh_token,
    decode_account_selection_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.config import get_settings
from app.deps import get_db
from app.models import AccountMembership, Tenant, TenantPlan, User, UserRole
from app.services.email_sender import send_email
from app.services.email_templates import welcome_email


settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    tenant_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AccountOut(BaseModel):
    membership_id: str
    account_id: str
    account_name: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    requires_account_selection: bool = False
    account_selection_token: str | None = None
    accounts: list[AccountOut] = []


class LoginSelectionResponse(BaseModel):
    requires_account_selection: bool
    account_selection_token: str | None = None
    accounts: list[AccountOut] = []
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"


class SelectAccountRequest(BaseModel):
    account_selection_token: str
    membership_id: str


class SwitchAccountRequest(BaseModel):
    membership_id: str


class RefreshRequest(BaseModel):
    refresh_token: str


def generate_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "personal"


def unique_tenant_slug(db: Session, name: str) -> str:
    slug = generate_slug(name)
    if not db.query(Tenant).filter(Tenant.slug == slug).first():
        return slug
    return f"{slug}-{str(uuid4())[:8]}"


def _active_memberships(db: Session, user: User) -> list[tuple[AccountMembership, Tenant]]:
    rows = (
        db.query(AccountMembership, Tenant)
        .join(Tenant, AccountMembership.tenant_id == Tenant.id)
        .filter(
            AccountMembership.user_id == user.id,
            AccountMembership.is_active == True,
            Tenant.is_active == True,
        )
        .order_by(AccountMembership.last_accessed_at.desc(), Tenant.name.asc())
        .all()
    )
    return rows


def _account_out(membership: AccountMembership, tenant: Tenant) -> AccountOut:
    return AccountOut(
        membership_id=str(membership.id),
        account_id=str(tenant.id),
        account_name=tenant.name,
        role=membership.role.value,
    )


def _issue_tokens(user: User, membership: AccountMembership, db: Session) -> TokenResponse:
    membership.last_accessed_at = datetime.utcnow()
    db.commit()
    return TokenResponse(
        access_token=create_access_token(user, membership),
        refresh_token=create_refresh_token(user, membership),
    )


def _login_response(user: User, db: Session) -> LoginSelectionResponse:
    memberships = _active_memberships(db, user)
    if not memberships:
        raise HTTPException(
            status_code=403,
            detail="Your account access has been deactivated. Please contact your account owner for assistance.",
        )
    if len(memberships) == 1:
        tokens = _issue_tokens(user, memberships[0][0], db)
        return LoginSelectionResponse(
            requires_account_selection=False,
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            token_type=tokens.token_type,
            accounts=[_account_out(memberships[0][0], memberships[0][1])],
        )
    return LoginSelectionResponse(
        requires_account_selection=True,
        account_selection_token=create_account_selection_token(user),
        accounts=[_account_out(membership, tenant) for membership, tenant in memberships],
    )


def _send_welcome_email(email: str, account_name: str) -> None:
    dashboard_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/dashboard"
    plain_text, html = welcome_email(account_name, dashboard_url)
    try:
        send_email(email, "Welcome to BEAM Analytics", plain_text, html)
    except Exception:
        pass


@router.post("/register", response_model=LoginSelectionResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = str(payload.email).lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    tenant_name = (payload.tenant_name or "").strip() or email.split("@", 1)[0]
    tenant = Tenant(
        name=tenant_name,
        slug=unique_tenant_slug(db, tenant_name),
        plan=TenantPlan.demo,
        trial_ends_at=datetime.utcnow() + timedelta(days=settings.TRIAL_DAYS),
    )
    db.add(tenant)
    db.flush()

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        tenant_id=tenant.id,
        role=UserRole.admin,
    )
    db.add(user)
    db.flush()

    membership = AccountMembership(
        user_id=user.id,
        tenant_id=tenant.id,
        role=UserRole.owner,
        is_active=True,
        ai_enabled=True,
        confirm_file_delete=True,
        recycle_bin_retention_days=30,
        theme_preference="light",
    )
    db.add(membership)
    db.flush()
    response = _login_response(user, db)
    _send_welcome_email(email, tenant.name)
    return response


@router.post("/login", response_model=LoginSelectionResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == str(payload.email).lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your login has been deactivated. Please contact an account owner for assistance.",
        )
    return _login_response(user, db)


@router.post("/select-account", response_model=TokenResponse)
def select_account(payload: SelectAccountRequest, db: Session = Depends(get_db)):
    user = decode_account_selection_token(payload.account_selection_token, db)
    membership = (
        db.query(AccountMembership)
        .join(Tenant, AccountMembership.tenant_id == Tenant.id)
        .filter(
            AccountMembership.id == payload.membership_id,
            AccountMembership.user_id == user.id,
            AccountMembership.is_active == True,
            Tenant.is_active == True,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Account access not found.")
    return _issue_tokens(user, membership, db)


@router.post("/switch-account", response_model=TokenResponse)
def switch_account(
    payload: SwitchAccountRequest,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    membership = (
        db.query(AccountMembership)
        .join(Tenant, AccountMembership.tenant_id == Tenant.id)
        .filter(
            AccountMembership.id == payload.membership_id,
            AccountMembership.user_id == current.id,
            AccountMembership.is_active == True,
            Tenant.is_active == True,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Account access not found.")
    return _issue_tokens(current.user, membership, db)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload_data = jwt.decode(
            payload.refresh_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload_data.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload_data.get("sub")
    membership_id = payload_data.get("membership_id")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    membership = (
        db.query(AccountMembership)
        .join(Tenant, AccountMembership.tenant_id == Tenant.id)
        .filter(
            AccountMembership.id == membership_id,
            AccountMembership.user_id == user_id,
            AccountMembership.is_active == True,
            Tenant.is_active == True,
        )
        .first()
    )
    if not user or not membership:
        raise HTTPException(status_code=401, detail="Account access not found")
    return _issue_tokens(user, membership, db)


@router.get("/accounts", response_model=list[AccountOut])
def accounts(current=Depends(get_current_user), db: Session = Depends(get_db)):
    return [_account_out(membership, tenant) for membership, tenant in _active_memberships(db, current.user)]


@router.get("/me")
def me(current=Depends(get_current_user), db: Session = Depends(get_db)):
    accounts = [_account_out(membership, tenant) for membership, tenant in _active_memberships(db, current.user)]
    return {
        "id": str(current.id),
        "email": current.email,
        "tenant_id": str(current.tenant_id),
        "role": current.role.value,
        "ai_enabled": current.ai_enabled,
        "active_account": {
            "membership_id": str(current.membership.id),
            "account_id": str(current.tenant.id),
            "account_name": current.tenant.name,
            "role": current.role.value,
        },
        "available_accounts": [item.model_dump() for item in accounts],
    }
