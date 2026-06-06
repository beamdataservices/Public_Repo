const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AccountSummary {
  membership_id: string;
  account_id: string;
  account_name: string;
  role: "owner" | "admin" | "user";
}

export interface LoginResponse {
  requires_account_selection: boolean;
  account_selection_token?: string | null;
  accounts: AccountSummary[];
  access_token?: string | null;
  refresh_token?: string | null;
  token_type: string;
}

export interface MeResponse {
  id: string;
  email: string;
  tenant_id: string;
  role: "owner" | "admin" | "user";
  ai_enabled: boolean;
  active_account: AccountSummary;
  available_accounts: AccountSummary[];
}

export interface FileItem {
  id: string;
  original_name: string;
  uploaded_at: string;
  status: string;
  size_bytes: number | null;
  uploaded_by_email?: string | null;
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// --- AUTH ---

export async function apiLogin(
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleJson<LoginResponse>(res);
}

export async function apiRegister(
  email: string,
  password: string,
  tenant_name: string
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      tenant_name,
    }),
  });
  return handleJson<LoginResponse>(res);
}

export async function apiSelectAccount(
  account_selection_token: string,
  membership_id: string
): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/select-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_selection_token, membership_id }),
  });
  return handleJson<TokenResponse>(res);
}

export async function apiSwitchAccount(
  accessToken: string,
  membership_id: string
): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/switch-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ membership_id }),
  });
  return handleJson<TokenResponse>(res);
}

export async function apiCreateAccount(
  accessToken: string,
  account_name: string
): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/accounts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ account_name }),
  });
  return handleJson<TokenResponse>(res);
}

export async function apiRefresh(
  refresh_token: string
): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  return handleJson<TokenResponse>(res);
}

export async function apiMe(accessToken: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return handleJson<MeResponse>(res);
}

// --- FILES ---

export async function apiListFiles(
  accessToken: string
): Promise<FileItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/files/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return handleJson<FileItem[]>(res);
}

export async function apiUploadFile(
  accessToken: string,
  file: File
): Promise<FileItem> {
  const formData = new FormData();
  formData.append("uploaded_file", file);

  const res = await fetch(`${API_BASE_URL}/api/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  return handleJson<FileItem>(res);
}
