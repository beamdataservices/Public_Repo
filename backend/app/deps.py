from .auth import get_current_user_stub
from .db import SessionLocal

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# For now, this uses the stub user for all requests
get_current_user = get_current_user_stub
