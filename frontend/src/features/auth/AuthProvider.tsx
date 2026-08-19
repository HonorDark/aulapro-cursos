import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  AUTH_UNAUTHORIZED_EVENT,
  sessionToken,
} from "../../shared/api/client";
import type { User } from "../../types";
import { AuthContext, type AuthValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api<User>("/auth/me");
      setUser(response.data);
    } catch {
      sessionToken.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (sessionToken.get()) {
      void refresh().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const authenticate = useCallback(async (
    path: string,
    payload: object,
    remember = false,
  ) => {
    const response = await api<{ token: string; user: User }>(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    sessionToken.set(response.data.token, remember);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      login: (email, password, remember) =>
        authenticate("/auth/login", { email, password }, remember),
      register: (name, email, password) =>
        authenticate("/auth/register", { name, email, password }),
      logout: () => {
        sessionToken.clear();
        setUser(null);
      },
      refresh,
    }),
    [authenticate, loading, refresh, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
