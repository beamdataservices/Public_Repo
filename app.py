import os, uuid, datetime
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from azure.storage.blob import (
    BlobServiceClient, generate_blob_sas, BlobSasPermissions
)
import httpx

APP_NAME = "ingest-portal"
ACCOUNT_NAME = os.environ["AZ_STORAGE_ACCOUNT"]
ACCOUNT_KEY = os.environ.get("AZ_STORAGE_KEY")  # use MSI later if preferred
CONTAINER = os.environ.get("AZ_CONTAINER", "ingest")
N8N_WEBHOOK_URL = os.environ["N8N_WEBHOOK_URL"]

app = FastAPI(title=APP_NAME)
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Blob client (account key path). For MSI, use DefaultAzureCredential & BlobServiceClient w/ URL only.
blob_service = BlobServiceClient(
    f"https://{ACCOUNT_NAME}.blob.core.windows.net",
    credential=ACCOUNT_KEY
)
container_client = blob_service.get_container_client(CONTAINER)

@app.get("/ingest", response_class=HTMLResponse)
async def ingest_page(request: Request):
    return templates.TemplateResponse("ingest.html", {"request": request})

@app.post("/api/sas")
async def mint_sas(tenant_id: str = Form(...), filename: str = Form(...), mime: str = Form("application/octet-stream"), bytes: int = Form(0)):
    # TODO: auth & quota checks here
    # Minimal validations
    if bytes > 50 * 1024 * 1024:
        return JSONResponse({"error": "File too large"}, status_code=400)

    safe_name = filename.replace("/", "_").replace("\\", "_")
    blob_name = f"tenant={tenant_id}/uploads/{datetime.datetime.utcnow():%Y/%m/%d}/{uuid.uuid4()}-{safe_name}"

    expires_on = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
    sas = generate_blob_sas(
        account_name=ACCOUNT_NAME,
        container_name=CONTAINER,
        blob_name=blob_name,
        account_key=ACCOUNT_KEY,
        permission=BlobSasPermissions(create=True, write=True),
        expiry=expires_on,
        content_type=mime
    )
    blob_url = f"https://{ACCOUNT_NAME}.blob.core.windows.net/{CONTAINER}/{blob_name}"
    upload_url = f"{blob_url}?{sas}"
    return {"uploadUrl": upload_url, "blobUrl": blob_url}

@app.post("/api/notify")
async def notify_n8n(tenant_id: str = Form(...), blob_url: str = Form(...), mime: str = Form(...), bytes: int = Form(...), original_name: str = Form(...)):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(N8N_WEBHOOK_URL, json={
            "tenant_id": tenant_id,
            "blob_url": blob_url,
            "mime": mime,
            "bytes": bytes,
            "original_name": original_name,
            "tags": []
        })
    return {"status": "ok", "n8n_status": r.status_code}
