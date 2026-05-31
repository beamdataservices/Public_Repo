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
