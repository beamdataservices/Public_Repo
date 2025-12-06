from fastapi import APIRouter, Depends
from app.models import User
from app.deps import get_current_user
from app.insights import generate_insights

router = APIRouter(prefix="/api/files")

@router.post("/{file_id}/insights")
async def get_file_insights(
    file_id: str,
    payload: dict,
    user: User = Depends(get_current_user)
):
    filters = payload.get("filters", {})
    blob_path = f"{user.tenant_id}/{file_id}"

    return generate_insights(blob_path, filters)
