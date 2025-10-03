import os, uuid, datetime, asyncio, httpx
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from pathlib import Path
from fastapi.responses import RedirectResponse

APP_NAME = "ingest-portal"
app = FastAPI(title=APP_NAME)

# Optional static mount (won’t crash if missing)
if Path("static").exists():
    app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

def get_cfg():
    # Read lazily to avoid import-time crash
    account = os.getenv("AZ_STORAGE_ACCOUNT")
    key     = os.getenv("AZ_STORAGE_KEY")  # <— align your env name to this
    container = os.getenv("AZ_CONTAINER", "ingest")
    n8n_url = os.getenv("N8N_WEBHOOK_URL")
    return account, key, container, n8n_url

@app.get("/health", response_class=PlainTextResponse)
async def health():
    return "ok"

@app.get("/ingest", response_class=HTMLResponse)
async def ingest_page(request: Request):
    return templates.TemplateResponse("ingest.html", {"request": request})

@app.get("/")
async def root():
    return RedirectResponse(url="/ingest")

@app.post("/api/sas")
async def mint_sas(
    tenant_id: str = Form(...),
    filename: str  = Form(...),
    mime: str      = Form("application/octet-stream"),
    bytes: int     = Form(0)
):
    account, key, container, _ = get_cfg()
    if not account or not key:
        return JSONResponse({"error": "Storage not configured"}, status_code=500)
    if bytes > 50 * 1024 * 1024:
        return JSONResponse({"error": "File too large"}, status_code=400)

    safe_name = (filename.replace("/", "_").replace("\\", "_").strip().replace(" ", "-"))
    blob_name = f"tenant={tenant_id}/uploads/{datetime.datetime.utcnow():%Y/%m/%d}/{uuid.uuid4()}-{safe_name}"

    expires_on = datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
    sas = generate_blob_sas(
        account_name=account,
        container_name=container,
        blob_name=blob_name,
        account_key=key,
        permission=BlobSasPermissions(create=True, write=True),
        expiry=expires_on,
        content_type=mime
    )
    blob_url = f"https://{account}.blob.core.windows.net/{container}/{blob_name}"
    upload_url = f"{blob_url}?{sas}"
    return {"uploadUrl": upload_url, "blobUrl": blob_url}

@app.post("/api/notify")
async def notify_n8n(
    tenant_id: str = Form(...),
    blob_url: str = Form(...),
    mime: str = Form(...),
    bytes: int = Form(...),
    original_name: str = Form(...)
):
    _, _, _, n8n_url = get_cfg()
    if not n8n_url:
        return JSONResponse({"error": "N8N_WEBHOOK_URL not configured"}, status_code=500)

    headers = {"Content-Type": "application/json"}
    secret = os.getenv("WEBHOOK_SECRET")  # inject from KV as shown below
    if secret:
        headers["X-Webhook-Secret"] = secret

    payload = {
        "tenant_id": tenant_id,
        "blob_url": blob_url,
        "mime": mime,
        "bytes": bytes,
        "original_name": original_name,
        "tags": []
    }

    async with httpx.AsyncClient(timeout=10) as client:
        # small retry loop for transient 5xx/429
        for attempt in range(3):
            try:
                resp = await client.post(n8n_url, json=payload, headers=headers)
                ok = 200 <= resp.status_code < 300
                if ok:
                    return {"status": "ok", "n8n_status": resp.status_code}
                # retry on 429/5xx
                if resp.status_code in (429, 500, 502, 503, 504):
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                return JSONResponse(
                    {"error": "n8n rejected", "n8n_status": resp.status_code, "body": resp.text[:500]},
                    status_code=502
                )
            except Exception as e:
                if attempt == 2:
                    return JSONResponse({"error": f"notify failed: {type(e).__name__}: {e}"}, status_code=502)
                await asyncio.sleep(0.5 * (attempt + 1))
