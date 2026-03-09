import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";

const AUTH_KEY = "@xiangyin_auth_user";
const SAVED_KEY = "@xiangyin_saved_accounts";

export type UserRole = "merchant" | "collector" | "user";
export type AuthUser = { id: string; username: string; role?: UserRole };

export interface UserProfile {
  userId: string;
  displayName: string | null;
  bio: string | null;
  gender: string | null;
  birthYear: string | null;
  birthMonth: string | null;
  region: string | null;
  phone: string | null;
  address: string | null;
  avatarUrl: string | null;
  updatedAt?: string;
}

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isGuest: boolean;
  savedAccounts: AuthUser[];
  profile: UserProfile | null;
  addingAccount: boolean;
  setAddingAccount: (v: boolean) => void;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  switchToAccount: (account: AuthUser) => Promise<void>;
  removeFromSaved: (id: string) => Promise<void>;
  updateProfile: (data: Partial<Omit<UserProfile, "userId" | "updatedAt">>) => Promise<void>;
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
  return [account, ...filtered];
}

async function fetchProfileFromApi(userId: string): Promise<UserProfile | null> {
  try {
    const url = new URL(`/api/profile/${encodeURIComponent(userId)}`, getApiUrl());
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json() as { profile: UserProfile | null };
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<AuthUser[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [addingAccount, setAddingAccount] = useState(false);

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
          const updated = upsertAccount(saved, parsed);
          setSavedAccounts(updated);
          await persistSaved(updated);
          // Fetch profile after restoring session
          const p = await fetchProfileFromApi(parsed.id);
          setProfile(p);
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
    // Fetch profile for this user
    const p = await fetchProfileFromApi(u.id);
    setProfile(p);
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
    setProfile(null);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
    setIsGuest(false);
    setProfile(null);
  };

  const switchToAccount = async (account: AuthUser) => {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(account));
    const next = upsertAccount(savedAccounts, account);
    setSavedAccounts(next);
    await persistSaved(next);
    setIsGuest(false);
    setUser(account);
    const p = await fetchProfileFromApi(account.id);
    setProfile(p);
  };

  const removeFromSaved = async (id: string) => {
    const next = savedAccounts.filter((a) => a.id !== id);
    setSavedAccounts(next);
    await persistSaved(next);
  };

  const updateProfile = async (data: Partial<Omit<UserProfile, "userId" | "updatedAt">>) => {
    if (!user || isGuest) return;
    try {
      const url = new URL(`/api/profile/${encodeURIComponent(user.id)}`, getApiUrl());
      const res = await fetch(url.toString(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("保存失败");
      const json = await res.json() as { profile: UserProfile };
      setProfile(json.profile);
    } catch (err) {
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user, isLoading, isGuest, savedAccounts, profile,
        addingAccount, setAddingAccount,
        login, register, loginAsGuest, logout,
        switchToAccount, removeFromSaved, updateProfile,
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
