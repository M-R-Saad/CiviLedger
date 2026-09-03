import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { authApi, setUnauthorizedHandler } from "../services/api";
import { decodeExp } from "../lib/jwt";

export type Role = "CITIZEN" | "ISSUER_ADMIN" | "VERIFIER_STAFF" | "OVERSIGHT";

export interface AuthUser {
  id: string;
  role: Role;
  full_name?: string;
  wallet_address?: string;
  organization_id?: string;
}

const TOKEN_KEY = "civiledger_token";
const USER_KEY = "civiledger_user";

interface AuthContextValue {
  user: AuthUser | null;
  loginWithPassword: (email: string, password: string) => Promise<AuthUser>;
  loginWithWallet: (walletAddress: string, signature: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(): AuthUser | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) return null;
    const exp = decodeExp(token);
    if (exp && exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function persist(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStored() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(readStored);

  const logout = useCallback(() => {
    clearStored();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  // axios 401 -> drop the session and return to login
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStored();
      setUser(null);
      if (window.location.pathname !== "/login") {
        navigate("/login", { replace: true });
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  // keep tabs in sync (logout in one tab logs out the others)
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === TOKEN_KEY || event.key === USER_KEY) {
        setUser(readStored());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      const { data } = await authApi.login(email, password);
      persist(data.token, data.user);
      setUser(data.user);
      return data.user as AuthUser;
    },
    []
  );

  const loginWithWallet = useCallback(
    async (walletAddress: string, signature: string) => {
      const { data } = await authApi.walletLogin(walletAddress, signature);
      persist(data.token, data.user);
      setUser(data.user);
      return data.user as AuthUser;
    },
    []
  );

  const value = useMemo(
    () => ({ user, loginWithPassword, loginWithWallet, logout }),
    [user, loginWithPassword, loginWithWallet, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
