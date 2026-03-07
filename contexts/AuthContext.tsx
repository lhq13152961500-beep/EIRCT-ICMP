import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";

const AUTH_KEY = "@xiangyin_auth_user";
const SAVED_KEY = "@xiangyin_saved_accounts";

export type UserRole = "merchant" | "collector" | "user";
export type AuthUser = { id: string; username: string; role?: UserRole };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isGuest: boolean;
  savedAccounts: AuthUser[];
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  switchToAccount: (account: AuthUser) => Promise<void>;
  removeFromSaved: (id: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadSaved(): Promise<AuthUser[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as AuthUser[]) : [];
  } catch {
    return [];
  }
}

async function persistSaved(list: AuthUser[]) {
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

function upsertAccount(list: AuthUser[], account: AuthUser): AuthUser[] {
  const filtered = list.filter((a) => a.id !== account.id);
  return [account, ...filtered]; // keep most-recent at top
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<AuthUser[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [stored, saved] = await Promise.all([
          AsyncStorage.getItem(AUTH_KEY),
          loadSaved(),
        ]);
        if (stored) {
          const parsed = JSON.parse(stored) as AuthUser;
          setUser(parsed);
          // Ensure current user is in saved list
          const updated = upsertAccount(saved, parsed);
          setSavedAccounts(updated);
          await persistSaved(updated);
        } else {
          setSavedAccounts(saved);
        }
      } catch {}
      finally { setIsLoading(false); }
    })();
  }, []);

  const _setActiveUser = async (u: AuthUser) => {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u));
    const next = upsertAccount(savedAccounts, u);
    setSavedAccounts(next);
    await persistSaved(next);
    setIsGuest(false);
    setUser(u);
  };

  const login = async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登录失败");
    await _setActiveUser(data.user as AuthUser);
  };

  const register = async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { username, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "注册失败");
    await _setActiveUser(data.user as AuthUser);
  };

  const loginAsGuest = () => {
    setIsGuest(true);
    setUser({ id: "guest", username: "游客" });
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
    setIsGuest(false);
    // Keep savedAccounts so user can switch back
  };

  // Switch to a previously saved account without re-authenticating
  const switchToAccount = async (account: AuthUser) => {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(account));
    const next = upsertAccount(savedAccounts, account);
    setSavedAccounts(next);
    await persistSaved(next);
    setIsGuest(false);
    setUser(account);
  };

  // Remove a saved account (does not log out if it's the current user)
  const removeFromSaved = async (id: string) => {
    const next = savedAccounts.filter((a) => a.id !== id);
    setSavedAccounts(next);
    await persistSaved(next);
  };

  return (
    <AuthContext.Provider
      value={{
        user, isLoading, isGuest, savedAccounts,
        login, register, loginAsGuest, logout,
        switchToAccount, removeFromSaved,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
