"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/types";

const ROLE_HOME: Record<Role, string> = {
  owner: "/owner/dashboard",
  manager: "/manager/dashboard",
  crew: "/crew/attendance",
};

export default function LoginPage() {
  const router = useRouter();
  const { user, role, loading: authLoading, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && user && role) {
      router.replace(ROLE_HOME[role]);
    }
  }, [authLoading, user, role, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Username dan password wajib diisi");
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
    } catch {
      setError("Username atau password salah");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (user && role) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-600/25">
            <span className="text-2xl font-black text-white">A</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-stone-900">AnchurPOS</h1>
          <p className="text-sm text-stone-500">Sistem manajemen Anchur</p>
        </div>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-stone-900 mb-5">Masuk ke akun</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium text-stone-700">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="contoh: adli"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                className="border-stone-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-stone-700">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-11 border-stone-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-700 mt-1"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Masuk"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-stone-400 mt-6">AnchurPOS v1.0</p>
      </div>
    </div>
  );
}
