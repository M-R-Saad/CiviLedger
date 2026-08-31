import { useState, useCallback } from "react";
import { authApi } from "../services/api";

interface AuthUser {
  id: string;
  role: string;
  wallet_address?: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem("civiledger_user");
    return stored ? JSON.parse(stored) : null;
  });

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem("civiledger_token", data.token);
    localStorage.setItem("civiledger_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithWallet = useCallback(async (walletAddress: string) => {
    const { data } = await authApi.walletLogin(walletAddress);
    localStorage.setItem("civiledger_token", data.token);
    localStorage.setItem("civiledger_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("civiledger_token");
    localStorage.removeItem("civiledger_user");
    setUser(null);
  }, []);

  return { user, loginWithPassword, loginWithWallet, logout };
}
