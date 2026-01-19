# backend/app/routers/files.py
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from uuid import uuid4, UUID
from datetime import datetime
import re
from urllib.parse import quote

from azure.storage.blob import BlobServiceClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.deps import get_db
from app.auth import get_current_user
from app.models import File as FileModel, User   # <-- IMPORTANT FIX

router = APIRouter()

settings = get_settings()
blob_service = BlobServiceClient.from_connection_string(settings.AZURE_BLOB_CONNSTRING)
container_client = blob_service.get_container_client(settings.BLOB_CONTAINER)


class FileOut(BaseModel):
    id: UUID
    original_name: str
    uploaded_at: datetime
    status: str
    size_bytes: int | None

    class Config:
        orm_mode = True


@router.post("/upload", response_model=FileOut)
async def upload_file(
    uploaded_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if uploaded_file.content_type not in (
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    file_id = str(uuid4())
    tenant_prefix = f"tenant_{user.tenant_id}/file_{file_id}"
    blob_path = f"{tenant_prefix}/raw/{uploaded_file.filename}"

    data = await uploaded_file.read()

    try:
        blob_client = container_client.get_blob_client(blob_path)
        blob_client.upload_blob(data, overwrite=True)
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Blob upload failed: {ex}")

    db_file = FileModel(
        id=file_id,
        tenant_id=user.tenant_id,
        uploaded_by=user.id,
        original_name=uploaded_file.filename,
        blob_path=blob_path,
        file_type="csv" if uploaded_file.filename.lower().endswith(".csv") else "xlsx",
        size_bytes=len(data),
        status="uploaded",
        uploaded_at=datetime.utcnow(),
    )

    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return db_file


@router.get("/", response_model=List[FileOut])
def list_files(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    files = (
        db.query(FileModel)
        .filter(FileModel.tenant_id == user.tenant_id)
        .order_by(FileModel.uploaded_at.desc())
        .all()
    )
    return files


@router.get("/{file_id}", response_model=FileOut)
def get_file(
    file_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    file = (
        db.query(FileModel)
        .filter(
            FileModel.id == file_id,
            FileModel.tenant_id == user.tenant_id,
        )
        .first()
    )
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return file


def _content_disposition_attachment(filename: str) -> str:
    """Build a safe Content-Disposition header value with RFC 5987 support.

    We include both:
      - filename="..." (ASCII-ish fallback)
      - filename*=UTF-8''... (RFC 5987, full UTF-8)

    This is widely supported by modern browsers and should not break older ones.
    """
    name = filename or "download"
    # Strip CR/LF and quotes to avoid header injection / broken headers.
    name = re.sub(r"[\r\n]", " ", name).replace('"', "")

    # ASCII fallback: keep common safe chars, replace others with underscore.
    fallback = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip() or "download"

    # RFC 5987 encoding for UTF-8 filenames
    encoded = quote(name, safe="")

    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}"


@router.get("/{file_id}/download")
def download_file(
    file_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    file = (
        db.query(FileModel)
        .filter(
            FileModel.id == file_id,
            FileModel.tenant_id == user.tenant_id,
        )
        .first()
    )
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    try:
        blob_client = container_client.get_blob_client(file.blob_path)
        downloader = blob_client.download_blob()

        def stream():
            for chunk in downloader.chunks():
                yield chunk

        name_lc = (file.original_name or "").lower()
        if name_lc.endswith(".csv"):
            media_type = "text/csv"
        elif name_lc.endswith(".xlsx"):
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif name_lc.endswith(".xls"):
            media_type = "application/vnd.ms-excel"
        else:
            media_type = "application/octet-stream"

        headers = {
            "Content-Disposition": _content_disposition_attachment(file.original_name),
        }

        return StreamingResponse(stream(), media_type=media_type, headers=headers)

    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Download failed: {ex}")
