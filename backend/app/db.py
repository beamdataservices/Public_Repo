# backend/app/db.py
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import get_settings

settings = get_settings()


class Base(DeclarativeBase):
    pass


engine = create_engine(
    settings.sqlalchemy_database_uri,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    # For now, create tables automatically. Later we'll do proper migrations.
    from . import models  # noqa
    Base.metadata.create_all(bind=engine)
    _ensure_feature_columns()


def _ensure_feature_columns():
    statements = [
        """
        IF COL_LENGTH('tenants', 'ai_enabled') IS NULL
        BEGIN
            ALTER TABLE tenants ADD ai_enabled BIT NOT NULL CONSTRAINT DF_tenants_ai_enabled DEFAULT 1
        END
        """,
        """
        IF COL_LENGTH('users', 'ai_enabled') IS NULL
        BEGIN
            ALTER TABLE users ADD ai_enabled BIT NOT NULL CONSTRAINT DF_users_ai_enabled DEFAULT 1
        END
        """,
        """
        IF COL_LENGTH('users', 'confirm_file_delete') IS NULL
        BEGIN
            ALTER TABLE users ADD confirm_file_delete BIT NOT NULL CONSTRAINT DF_users_confirm_file_delete DEFAULT 1
        END
        """,
        """
        IF COL_LENGTH('users', 'recycle_bin_retention_days') IS NULL
        BEGIN
            ALTER TABLE users ADD recycle_bin_retention_days INT NOT NULL CONSTRAINT DF_users_recycle_bin_retention_days DEFAULT 30
        END
        """,
        """
        IF COL_LENGTH('users', 'theme_preference') IS NULL
        BEGIN
            ALTER TABLE users ADD theme_preference VARCHAR(10) NOT NULL CONSTRAINT DF_users_theme_preference DEFAULT 'light'
        END
        """,
        """
        IF COL_LENGTH('files', 'deleted_at') IS NULL
        BEGIN
            ALTER TABLE files ADD deleted_at DATETIMEOFFSET NULL
        END
        """,
        """
        IF COL_LENGTH('files', 'deleted_by') IS NULL
        BEGIN
            ALTER TABLE files ADD deleted_by UNIQUEIDENTIFIER NULL
        END
        """,
        """
        IF COL_LENGTH('files', 'purge_after') IS NULL
        BEGIN
            ALTER TABLE files ADD purge_after DATETIMEOFFSET NULL
        END
        """,
        """
        IF COL_LENGTH('files', 'restore_blob_path') IS NULL
        BEGIN
            ALTER TABLE files ADD restore_blob_path VARCHAR(500) NULL
        END
        """,
        """
        IF OBJECT_ID('user_invites', 'U') IS NOT NULL AND COL_LENGTH('user_invites', 'revoked_at') IS NULL
        BEGIN
            ALTER TABLE user_invites ADD revoked_at DATETIMEOFFSET NULL
        END
        """,
        """
        IF OBJECT_ID('user_invites', 'U') IS NOT NULL AND COL_LENGTH('user_invites', 'last_sent_at') IS NULL
        BEGIN
            ALTER TABLE user_invites ADD last_sent_at DATETIMEOFFSET NULL
        END
        """,
        """
        IF OBJECT_ID('account_memberships', 'U') IS NOT NULL
        BEGIN
            INSERT INTO account_memberships (
                id,
                user_id,
                tenant_id,
                role,
                is_active,
                ai_enabled,
                confirm_file_delete,
                recycle_bin_retention_days,
                theme_preference,
                created_at
            )
            SELECT
                NEWID(),
                users.id,
                users.tenant_id,
                CASE WHEN users.role = 'admin' THEN 'owner' ELSE users.role END,
                users.is_active,
                users.ai_enabled,
                users.confirm_file_delete,
                users.recycle_bin_retention_days,
                users.theme_preference,
                users.created_at
            FROM users
            WHERE users.tenant_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM account_memberships existing
                WHERE existing.user_id = users.id
                  AND existing.tenant_id = users.tenant_id
              )
        END
        """,
        """
        IF OBJECT_ID('account_billing', 'U') IS NOT NULL AND COL_LENGTH('account_billing', 'premium_welcome_sent_at') IS NULL
        BEGIN
            ALTER TABLE account_billing ADD premium_welcome_sent_at DATETIMEOFFSET NULL
        END
        """,
    ]
    try:
        with engine.begin() as conn:
            for statement in statements:
                conn.execute(text(statement))
    except Exception:
        # Non-MSSQL local/dev databases can rely on create_all for fresh schemas.
        pass
    
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
