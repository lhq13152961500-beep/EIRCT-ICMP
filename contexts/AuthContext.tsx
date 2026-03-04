import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";

const AUTH_KEY = "@xiangyin_auth_user";

export type AuthUser = { id: string; username: string };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY)
      .then((stored) => {
        if (stored) {
          const parsed = JSON.parse(stored) as AuthUser;
          setUser(parsed);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登录失败");
    const u: AuthUser = data.user;
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u));
    setIsGuest(false);
    setUser(u);
  };

  const register = async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { username, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "注册失败");
    const u: AuthUser = data.user;
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u));
    setIsGuest(false);
    setUser(u);
  };

  const loginAsGuest = () => {
    setIsGuest(true);
    setUser({ id: "guest", username: "游客" });
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setUser(null);
    setIsGuest(false);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isGuest, login, register, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
