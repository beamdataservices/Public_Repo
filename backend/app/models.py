# backend/app/models.py
from sqlalchemy import Column, String, DateTime, ForeignKey, BigInteger
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.sql import func
import uuid
from .db import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.sysutcdatetime())


class User(Base):
    __tablename__ = "users"

    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid_str)
    tenant_id = Column(UNIQUEIDENTIFIER, ForeignKey("tenants.id"), nullable=False)
    email = Column(String(255), nullable=False)
    display_name = Column(String(255))
    role = Column(String(50), nullable=False, server_default="user")
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
