/**
 * Auth context — manages admin session state across the app.
 *
 * On mount, checks for an existing session via GET /me. If valid, the user
 * is authenticated and the dashboard renders. Otherwise, the login page shows.
 *
 * Exposes `signin`, `signout`, and the current user to the component tree.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import * as authApi from "../lib/auth";
import type { AuthUser } from "../lib/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signin: (email: string, password: string) => Promise<void>;
  signout: () => Promise<void>;
  /** Error from the last signin attempt (cleared on retry). */
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check existing session on mount.
  useEffect(() => {
    authApi
      .getMe()
      .then((u) => {
        setUser(u);
        setStatus("authenticated");
      })
      .catch(() => {
        setStatus("unauthenticated");
      });
  }, []);

  const signin = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await authApi.signin({ email, password });
      // Fetch the full profile after setting the cookie.
      const u = await authApi.getMe();
      setUser(u);
      setStatus("authenticated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      throw err;
    }
  }, []);

  const signout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Cookie might already be cleared — proceed anyway.
    }
    setUser(null);
    setStatus("unauthenticated");
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ status, user, signin, signout, error }),
    [status, user, signin, signout, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
