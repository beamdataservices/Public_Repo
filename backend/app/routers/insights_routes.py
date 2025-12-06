from fastapi import APIRouter, Depends
from models import User
from deps import get_current_user
from insights import generate_insights

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
