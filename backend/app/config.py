# backend/app/config.py
from pydantic import BaseSettings
from functools import lru_cache
import urllib.parse
import os


class Settings(BaseSettings):
    AZURE_SQL_CONNSTRING: str
    AZURE_BLOB_CONNSTRING: str
    BLOB_CONTAINER: str = "tenant-files"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def sqlalchemy_database_uri(self) -> str:
        """
        Convert the ADO-style Azure SQL connection string into a SQLAlchemy URL.
        Expects something like:
        Server=tcp:beamanalyticssql2.database.windows.net,1433;Database=beamtenantdb;User ID=beamadmin;Password=...;Encrypt=true;
        """
        parts = {}
        for segment in self.AZURE_SQL_CONNSTRING.split(";"):
            if not segment.strip():
                continue
            key, _, value = segment.partition("=")
            parts[key.strip().lower()] = value.strip()

        server = parts.get("server") or parts.get("data source")
        if server and server.lower().startswith("tcp:"):
            server = server[4:]
        database = parts.get("database")
        user = parts.get("user id") or parts.get("uid")
        password = parts.get("password") or parts.get("pwd")

        if not (server and database and user and password):
            raise ValueError("AZURE_SQL_CONNSTRING is missing required parts")

        user_enc = urllib.parse.quote_plus(user)
        pwd_enc = urllib.parse.quote_plus(password)
        driver = urllib.parse.quote_plus("ODBC Driver 18 for SQL Server")

        # Example:
        # mssql+pyodbc://user:pass@server:1433/db?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no
        return (
            f"mssql+pyodbc://{user_enc}:{pwd_enc}@{server}/{database}"
            f"?driver={driver}&Encrypt=yes&TrustServerCertificate=no"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings(
        AZURE_SQL_CONNSTRING=os.getenv("AZURE_SQL_CONNSTRING", ""),
        AZURE_BLOB_CONNSTRING=os.getenv("AZURE_BLOB_CONNSTRING", ""),
        BLOB_CONTAINER=os.getenv("BLOB_CONTAINER", "tenant-files"),
    )
