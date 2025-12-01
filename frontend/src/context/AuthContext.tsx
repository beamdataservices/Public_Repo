"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  apiLogin,
  apiRegister,
  apiRefresh,
  apiMe,
  MeResponse,
  TokenResponse,
} from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthContextValue {
  user: MeResponse | null;
  tokens: AuthTokens;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    tenantName: string
  ) => Promise<void>;
  logout: () => void;
  refreshIfNeeded: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "beam_tokens";

function loadTokens(): AuthTokens {
  if (typeof window === "undefined")
    return { accessToken: null, refreshToken: null };
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return { accessToken: null, refreshToken: null };
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function saveTokens(tokens: AuthTokens) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [tokens, setTokens] = useState<AuthTokens>({
    accessToken: null,
    refreshToken: null,
  });
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  function applyTokens(tr: TokenResponse) {
    const newTokens: AuthTokens = {
      accessToken: tr.access_token,
      refreshToken: tr.refresh_token,
    };
    setTokens(newTokens);
    saveTokens(newTokens);
  }

  async function syncUser(currentTokens: AuthTokens) {
    if (!currentTokens.accessToken) {
      setUser(null);
      return;
    }
    try {
      const me = await apiMe(currentTokens.accessToken);
      setUser(me);
    } catch (err) {
      console.warn("Failed loading /auth/me:", err);
      setUser(null);
    }
  }

  // Load tokens from localStorage & refresh
  useEffect(() => {
    async function init() {
      const stored = loadTokens();
      if (!stored.refreshToken) {
        setLoading(false);
        return;
      }
      try {
        const refreshed = await apiRefresh(stored.refreshToken);
        applyTokens(refreshed);
        await syncUser({
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token,
        });
      } catch (err) {
        console.warn("Initial refresh failed:", err);
        clearTokens();
        setTokens({ accessToken: null, refreshToken: null });
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const tr = await apiLogin(email, password);
      applyTokens(tr);
      await syncUser({
        accessToken: tr.access_token,
        refreshToken: tr.refresh_token,
      });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    tenantName: string
  ) => {
    setLoading(true);
    try {
      const tr = await apiRegister(email, password, tenantName);
      applyTokens(tr);
      await syncUser({
        accessToken: tr.access_token,
        refreshToken: tr.refresh_token,
      });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearTokens();
    setTokens({ accessToken: null, refreshToken: null });
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

  const value: AuthContextValue = {
    user,
    tokens,
    loading,
    login,
    register,
    logout,
    refreshIfNeeded,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
