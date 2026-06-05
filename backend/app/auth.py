from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import get_settings
from .deps import get_db
from .models import AccountMembership, Tenant, TenantPlan, User, UserRole


settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + expires_delta
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


@dataclass
class CurrentAccount:
    user: User
    membership: AccountMembership
    tenant: Tenant

    @property
    def id(self):
        return self.user.id

    @property
    def email(self) -> str:
        return self.user.email

    @property
    def tenant_id(self):
        return self.membership.tenant_id

    @property
    def role(self) -> UserRole:
        return self.membership.role

    @property
    def ai_enabled(self) -> bool:
        return bool(self.membership.ai_enabled)

    @property
    def confirm_file_delete(self) -> bool:
        return bool(self.membership.confirm_file_delete)

    @property
    def recycle_bin_retention_days(self) -> int:
        return int(self.membership.recycle_bin_retention_days or 30)

    @property
    def theme_preference(self) -> str:
        return self.membership.theme_preference or "light"


def create_access_token(user: User, membership: AccountMembership) -> str:
    return create_token(
        {
            "sub": str(user.id),
            "membership_id": str(membership.id),
            "tenant_id": str(membership.tenant_id),
            "role": membership.role.value,
            "type": "access",
        },
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user: User, membership: AccountMembership) -> str:
    return create_token(
        {
            "sub": str(user.id),
            "membership_id": str(membership.id),
            "tenant_id": str(membership.tenant_id),
            "role": membership.role.value,
            "type": "refresh",
        },
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def create_account_selection_token(user: User) -> str:
    return create_token(
        {"sub": str(user.id), "type": "account_selection"},
        timedelta(minutes=15),
    )


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _current_account_from_payload(payload: dict, db: Session) -> CurrentAccount:
    user_id = payload.get("sub")
    membership_id = payload.get("membership_id")
    if not user_id or not membership_id:
        raise _credentials_exception()

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise _credentials_exception()

    membership = (
        db.query(AccountMembership)
        .filter(
            AccountMembership.id == membership_id,
            AccountMembership.user_id == user.id,
            AccountMembership.is_active == True,
        )
        .first()
    )
    if not membership:
        raise _credentials_exception()

    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id, Tenant.is_active == True).first()
    if not tenant:
        raise HTTPException(status_code=403, detail="Account inactive or missing")

    return CurrentAccount(user=user, membership=membership, tenant=tenant)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> CurrentAccount:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise _credentials_exception()
    except JWTError:
        raise _credentials_exception()
    return _current_account_from_payload(payload, db)


def get_current_tenant(current_user: CurrentAccount = Depends(get_current_user)) -> Tenant:
    tenant = current_user.tenant
    if tenant.plan == TenantPlan.demo and tenant.trial_ends_at and tenant.trial_ends_at < datetime.utcnow():
        raise HTTPException(status_code=402, detail="Trial expired. Please upgrade your plan.")
    return tenant


def admin_required(current_user: CurrentAccount = Depends(get_current_user)) -> CurrentAccount:
    if current_user.role not in (UserRole.owner, UserRole.admin):
        raise HTTPException(status_code=403, detail="Account owner privileges required")
    return current_user


def decode_account_selection_token(token: str, db: Session) -> User:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "account_selection":
            raise _credentials_exception()
        user_id = payload.get("sub")
        if not user_id:
            raise _credentials_exception()
    except JWTError:
        raise _credentials_exception()
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise _credentials_exception()
    return user
