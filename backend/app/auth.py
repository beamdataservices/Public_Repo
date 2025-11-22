# backend/app/auth.py
from dataclasses import dataclass


@dataclass
class CurrentUser:
    id: str
    tenant_id: str
    email: str


def get_current_user_stub() -> CurrentUser:
    """
    TEMP: single-tenant stub user. Later we replace this with real B2C auth.
    """
    # Don't use this in prod; just for getting the system working.
    return CurrentUser(
        id="00000000-0000-0000-0000-000000000001",
        tenant_id="00000000-0000-0000-0000-000000000001",
        email="demo@beam.local",
    )
