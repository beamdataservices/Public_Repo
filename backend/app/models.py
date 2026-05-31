# backend/app/models.py
from sqlalchemy import (
    Column, String, DateTime, ForeignKey, BigInteger, Boolean, Enum, Text,
    Integer, Numeric
)
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.sql import func
import uuid
import enum

from .db import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class TenantPlan(str, enum.Enum):
    demo = "demo"
    standard = "standard"


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    name = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, nullable=False)

    plan = Column(Enum(TenantPlan), nullable=False, server_default="demo")
    trial_ends_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, nullable=False, server_default="1")
    ai_enabled = Column(Boolean, nullable=False, server_default="1")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())


class User(Base):
    __tablename__ = "users"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    tenant_id = Column(UNIQUEIDENTIFIER, ForeignKey("tenants.id"), nullable=False)

    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)

    display_name = Column(String(255))
    role = Column(Enum(UserRole), nullable=False, server_default="user")
    is_active = Column(Boolean, nullable=False, server_default="1")
    ai_enabled = Column(Boolean, nullable=False, server_default="1")
    confirm_file_delete = Column(Boolean, nullable=False, server_default="1")
    recycle_bin_retention_days = Column(Integer, nullable=False, server_default="30")
    theme_preference = Column(String(10), nullable=False, server_default="light")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())


class UserInvite(Base):
    __tablename__ = "user_invites"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    tenant_id = Column(UNIQUEIDENTIFIER, ForeignKey("tenants.id"), nullable=False)
    email = Column(String(255), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True)
    invited_by = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True))
    revoked_at = Column(DateTime(timezone=True))
    last_sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    tenant_id = Column(UNIQUEIDENTIFIER, ForeignKey("tenants.id"), nullable=False)
    actor_user_id = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(String(255))
    details_json = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())


class File(Base):
    __tablename__ = "files"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    tenant_id = Column(UNIQUEIDENTIFIER, ForeignKey("tenants.id"), nullable=False)
    uploaded_by = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), nullable=False)

    original_name = Column(String(255), nullable=False)
    blob_path = Column(String(500), nullable=False)
    file_type = Column(String(20), nullable=False)
    size_bytes = Column(BigInteger)
    status = Column(String(30), nullable=False, server_default="uploaded")

    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())
    deleted_at = Column(DateTime(timezone=True))
    deleted_by = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"))
    purge_after = Column(DateTime(timezone=True))
    restore_blob_path = Column(String(500))


class SavedReport(Base):
    __tablename__ = "saved_reports"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    tenant_id = Column(UNIQUEIDENTIFIER, ForeignKey("tenants.id"), nullable=False)
    file_id = Column(UNIQUEIDENTIFIER, ForeignKey("files.id"), nullable=False)
    created_by = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"), nullable=False)

    name = Column(String(200), nullable=False)
    description = Column(String(1000))
    chart_configs_json = Column(Text, nullable=False)
    filters_json = Column(Text, nullable=False)
    sheet_name = Column(String(255))

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.sysutcdatetime(),
        onupdate=func.sysutcdatetime(),
    )


class LLMPricing(Base):
    __tablename__ = "llm_pricing"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    model = Column(String(100), nullable=False)
    input_price_per_1m = Column(Numeric(12, 6), nullable=False)
    output_price_per_1m = Column(Numeric(12, 6), nullable=False)
    effective_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())
    is_active = Column(Boolean, nullable=False, server_default="1")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())


class LLMUsageEvent(Base):
    __tablename__ = "llm_usage_events"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    tenant_id = Column(UNIQUEIDENTIFIER, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey("users.id"))
    file_id = Column(UNIQUEIDENTIFIER, ForeignKey("files.id"))

    operation = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, nullable=False, server_default="0")
    completion_tokens = Column(Integer, nullable=False, server_default="0")
    total_tokens = Column(Integer, nullable=False, server_default="0")
    estimated_cost = Column(Numeric(18, 8), nullable=False, server_default="0")
    status = Column(String(30), nullable=False, server_default="success")
    error_message = Column(String(1000))

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())
