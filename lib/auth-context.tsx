"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "./firebase-client";
import type { Role } from "@/types";

interface AuthState {
  user: FirebaseUser | null;
  role: Role | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

const EMAIL_DOMAIN = "anchur.internal";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const tokenResult = await firebaseUser.getIdTokenResult();
        setRole((tokenResult.claims.role as Role) ?? null);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (username: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const email = `${username.toLowerCase().trim()}@${EMAIL_DOMAIN}`;
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const tokenResult = await cred.user.getIdTokenResult();
      setRole((tokenResult.claims.role as Role) ?? null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login gagal";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRole(null);
  };

  const getToken = async (): Promise<string | null> => {
    if (!user) return null;
    return user.getIdToken();
  };

  return (
    <AuthContext.Provider
      value={{ user, role, loading, error, login, logout, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
