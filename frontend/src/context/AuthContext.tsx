"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  AccountSummary,
  apiCreateAccount,
  apiLogin,
  apiMe,
  apiRefresh,
  apiRegister,
  apiSelectAccount,
  apiSwitchAccount,
  MeResponse,
  TokenResponse,
} from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

interface AccountSelectionState {
  selectionToken: string;
  accounts: AccountSummary[];
}

interface AuthContextValue {
  user: MeResponse | null;
  tokens: AuthTokens;
  accountSelection: AccountSelectionState | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, tenantName: string) => Promise<void>;
  createAccount: (accountName: string) => Promise<void>;
  selectAccount: (membershipId: string) => Promise<void>;
  switchAccount: (membershipId: string) => Promise<void>;
  logout: () => void;
  refreshIfNeeded: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_KEY = "beam_tokens";
const SELECTION_KEY = "beam_account_selection";

function loadTokens(): AuthTokens {
  if (typeof window === "undefined") return { accessToken: null, refreshToken: null };
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) as AuthTokens : { accessToken: null, refreshToken: null };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function saveTokens(tokens: AuthTokens) {
  if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function clearTokens() {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

function loadSelection(): AccountSelectionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SELECTION_KEY);
    return raw ? JSON.parse(raw) as AccountSelectionState : null;
  } catch {
    return null;
  }
}

function saveSelection(selection: AccountSelectionState | null) {
  if (typeof window === "undefined") return;
  if (!selection) window.localStorage.removeItem(SELECTION_KEY);
  else window.localStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [tokens, setTokens] = useState<AuthTokens>({ accessToken: null, refreshToken: null });
  const [accountSelection, setAccountSelection] = useState<AccountSelectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  function applyTokens(tr: TokenResponse) {
    const newTokens = { accessToken: tr.access_token, refreshToken: tr.refresh_token };
    setTokens(newTokens);
    saveTokens(newTokens);
    setAccountSelection(null);
    saveSelection(null);
  }

  async function syncUser(currentTokens: AuthTokens) {
    if (!currentTokens.accessToken) {
      setUser(null);
      return;
    }
    try {
      setUser(await apiMe(currentTokens.accessToken));
    } catch (err) {
      console.warn("Failed loading /auth/me:", err);
      setUser(null);
    }
  }

  function handleLoginResponse(response: Awaited<ReturnType<typeof apiLogin>>) {
    if (response.requires_account_selection && response.account_selection_token) {
      const selection = { selectionToken: response.account_selection_token, accounts: response.accounts };
      setAccountSelection(selection);
      saveSelection(selection);
      clearTokens();
      setTokens({ accessToken: null, refreshToken: null });
      setUser(null);
      router.push("/select-account");
      return false;
    }
    if (response.access_token && response.refresh_token) {
      applyTokens({ access_token: response.access_token, refresh_token: response.refresh_token, token_type: response.token_type });
      return true;
    }
    throw new Error("Login did not return account access.");
  }

  useEffect(() => {
    async function init() {
      setAccountSelection(loadSelection());
      const stored = loadTokens();
      if (!stored.refreshToken) {
        setLoading(false);
        return;
      }
      try {
        const refreshed = await apiRefresh(stored.refreshToken);
        applyTokens(refreshed);
        await syncUser({ accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token });
      } catch (err) {
        console.warn("Initial refresh failed:", err);
        clearTokens();
        setTokens({ accessToken: null, refreshToken: null });
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiLogin(email, password);
      if (handleLoginResponse(response)) {
        await syncUser({ accessToken: response.access_token ?? null, refreshToken: response.refresh_token ?? null });
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, tenantName: string) => {
    setLoading(true);
    try {
      const response = await apiRegister(email, password, tenantName);
      if (handleLoginResponse(response)) {
        await syncUser({ accessToken: response.access_token ?? null, refreshToken: response.refresh_token ?? null });
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  const selectAccount = async (membershipId: string) => {
    if (!accountSelection) throw new Error("Account selection has expired. Please sign in again.");
    setLoading(true);
    try {
      const tr = await apiSelectAccount(accountSelection.selectionToken, membershipId);
      applyTokens(tr);
      await syncUser({ accessToken: tr.access_token, refreshToken: tr.refresh_token });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async (accountName: string) => {
    if (!tokens.accessToken) throw new Error("You must be signed in to create an account.");
    setLoading(true);
    try {
      const tr = await apiCreateAccount(tokens.accessToken, accountName);
      applyTokens(tr);
      await syncUser({ accessToken: tr.access_token, refreshToken: tr.refresh_token });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const switchAccount = async (membershipId: string) => {
    if (!tokens.accessToken) return;
    setLoading(true);
    try {
      const tr = await apiSwitchAccount(tokens.accessToken, membershipId);
      applyTokens(tr);
      await syncUser({ accessToken: tr.access_token, refreshToken: tr.refresh_token });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearTokens();
    saveSelection(null);
    setTokens({ accessToken: null, refreshToken: null });
    setAccountSelection(null);
    setUser(null);
    router.push("/login");
  };

  const refreshIfNeeded = async () => {
    if (!tokens.refreshToken) return;
    try {
      const refreshed = await apiRefresh(tokens.refreshToken);
      applyTokens(refreshed);
    } catch (err) {
      console.warn("Refresh failed:", err);
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, tokens, accountSelection, loading, login, register, createAccount, selectAccount, switchAccount, logout, refreshIfNeeded }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
