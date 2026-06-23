"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-stone-50 overflow-hidden px-5">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-400/6 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-stone-200/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm page-enter">
        {/* Logo & branding */}
        <div className="mb-8 flex flex-col items-center">
          <div className="relative mb-3">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shadow-[0_12px_40px_rgba(5,150,105,0.35)]">
              <span className="text-3xl font-black text-white tracking-tight">A</span>
            </div>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-rose-400 border-2 border-white flex items-center justify-center">
              <span className="text-white text-[9px] font-black">POS</span>
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">AnchurPOS</h1>
          <p className="text-sm text-stone-400 mt-0.5">Sistem manajemen produksi Anchur</p>
        </div>

        {/* Login card */}
        <div className="rounded-3xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-stone-100 p-6">
          <h2 className="text-base font-bold text-stone-900 mb-5">Masuk ke akun</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-semibold text-stone-700">Username</Label>
              <Input
                id="username"
                data-testid="login-username-input"
                type="text"
                placeholder="contoh: adli"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-stone-700">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-12 rounded-xl pr-12 border-stone-200 bg-stone-50 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3" data-testid="login-error">
                <p className="text-sm text-rose-600 font-medium">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              data-testid="login-submit-button"
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-base shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all mt-1"
              disabled={loading}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Masuk"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">AnchurPOS v1.0 &middot; Anchur Bandung</p>
      </div>
    </div>
  );
}
