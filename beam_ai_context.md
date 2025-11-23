# BEAM Analytics SaaS Platform – AI Context Guide

## Vision
The BEAM Analytics platform is being built as a **multi‑tenant SaaS solution** that enables organizations to securely upload, process, store, and manage files within their own isolated tenant space. The design prioritizes *scalability, automation, security, and rapid deployment.*

This system lays the foundation for future add‑ons including:
- Automated ETL pipelines
- AI‑assisted data extraction
- Integration with n8n workflows
- Institution‑specific processing templates
- Chatbot‑driven analytics

## Why This Architecture
### **1. Azure Container Apps (ACA)**
We use ACA because:
- Automatic HTTPS ingress
- Scale‑to‑zero billing model (lowest cost for early deployment)
- Built‑in support for system‑assigned managed identities
- Clean separation of backend/frontend containers
- Revision‑based zero-downtime deployments

### **2. Azure SQL Serverless**
Serverless SQL provides:
- Pause/resume billing (saves cost)
- Multi‑tenant data isolation
- Strong relational consistency
- First‑class integration with Azure services

### **3. Azure Blob Storage**
Blob is used because it:
- Scales infinitely
- Supports low‑cost tiers (Hot/Cool/Archive)
- Provides per‑file metadata tagging
- Works natively with event triggers and AI processing

### **4. Azure Container Registry (ACR)**
ACR stores backend/frontend images used to deploy revisions.  
GitHub Actions pushes images via **OIDC**, meaning:
- No passwords
- No secrets
- No docker login required  
The GitHub workflow uses federated identity with permissions:
- `AcrPush` (GitHub → ACR)
- `AcrPull` (Container App → ACR)

### **5. GitHub Actions CI/CD**
Each push to `main`:
1. Builds backend Docker image
2. Pushes to ACR
3. Deploys to ACA
4. Routes traffic to the newest revision

This is fully automated, secure, and auditable.

---

## Core Components of the Application

### **Backend (FastAPI)**
Responsibilities:
- Tenant authentication (phase 2)
- File upload handling
- Generating blob storage SAS tokens
- Storing metadata in SQL
- Listing file history
- Multi‑tenant scoping of data  
The backend exposes a clean REST API that the frontend uses.

### **Frontend (React/Next.js or Vite)**
Responsibilities:
- Tenant login (future: Azure B2C)
- File upload UI
- File history table
- File metadata preview
- Dashboard for usage metrics

---

## Why This Design Works for the Future

### **Pluggable Workflow Automations**
By storing uploads/metadata cleanly, future versions can:
- Trigger n8n workflows per tenant
- Trigger Azure Functions
- Trigger AI extraction models
- Feed into the BEAM ingestion system

### **Multi‑Tenant Ready**
We treat **every request as scoped to a tenant**:
- SQL uses a `tenant_id` column
- Blobs are stored in a per‑tenant directory structure
- Backend routes require tenant context

Future authentication will plug in easily.

### **Extremely Low Cost**
- ACA scales to zero
- SQL is serverless with auto‑pause
- Blob is cheap
- ACR only charges for storage

This provides a *production‑capable architecture* for under $5–$20 per month.

---

## Immediate Next Milestones
1. **Fix backend deployment pipeline (in progress)**
2. Implement file metadata routes:
   - `/files/upload`
   - `/files/list`
   - `/files/details`
3. Add tenant-based filtering in SQL queries
4. Integrate backend API with frontend UI
5. Add tenant login (Azure B2C or simple JWT)
6. Add n8n automation triggers (optional)

---

## Long-Term Vision
The platform evolves into:
- A fully automated ETL engine for consumers
- A vendor-neutral ingestion hub
- An AI-powered transformation and analytics portal
- A subscription SaaS with usage-based billing

BEAM becomes:
**“The central nervous system for institutional data automation.”**

---

This markdown file is meant to serve as **AI context** for future ChatGPT sessions so the assistant understands the architecture, design reasons, and long‑term goals.

