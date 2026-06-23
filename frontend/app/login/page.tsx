"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
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
      <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (user && role) return null;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: "#FCABB4" }}
    >
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full" style={{ background: "rgba(232,93,140,0.25)" }} />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full" style={{ background: "rgba(201,74,115,0.20)" }} />
        <div className="absolute top-1/3 right-8 h-8 w-8 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />
        <div className="absolute bottom-1/3 left-8 h-5 w-5 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
      </div>

      <div className="relative w-full max-w-sm page-enter">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div
            className="h-20 w-20 rounded-[28px] flex items-center justify-center mb-4"
            style={{
              background: "rgba(255,255,255,0.3)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              boxShadow: "0 8px 32px rgba(232,93,140,0.3), inset 0 1px 0 rgba(255,255,255,0.5)"
            }}
          >
            <span className="text-3xl font-extrabold text-white" style={{ textShadow: "0 2px 8px rgba(201,74,115,0.3)" }}>A</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>AnchurPOS</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>Sistem manajemen produksi Anchur</p>
        </div>

        {/* Glass card */}
        <div
          className="rounded-3xl p-6"
          style={{
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 20px 60px rgba(201,74,115,0.15), inset 0 1px 0 rgba(255,255,255,0.8)",
            border: "1px solid rgba(255,255,255,0.7)"
          }}
        >
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1C1E" }}>Masuk ke akun</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="login-form">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Username</label>
              <div
                className="flex items-center gap-3 h-12 px-4 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.6)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.7)"
                }}
              >
                <Mail size={16} style={{ color: "#E85D8C" }} />
                <input
                  id="username"
                  data-testid="login-username-input"
                  type="text"
                  placeholder="contoh: adli"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  className="flex-1 bg-transparent text-sm font-medium outline-none"
                  style={{ color: "#1C1C1E" }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Password</label>
              <div
                className="flex items-center gap-3 h-12 px-4 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.6)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.7)"
                }}
              >
                <Lock size={16} style={{ color: "#E85D8C" }} />
                <input
                  id="password"
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="flex-1 bg-transparent text-sm font-medium outline-none"
                  style={{ color: "#1C1C1E" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 tap-target"
                  data-testid="toggle-password-visibility"
                  style={{ color: "#B0707E" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-2xl px-4 py-2.5" style={{ background: "rgba(232,93,140,0.12)", border: "1px solid rgba(232,93,140,0.3)" }} data-testid="login-error">
                <p className="text-sm font-medium" style={{ color: "#C94A73" }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              data-testid="login-submit-button"
              disabled={loading}
              className="w-full h-12 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 tap-target disabled:opacity-70 mt-1"
              style={{ background: "#ffffff", color: "#E85D8C", boxShadow: "0 4px 16px rgba(232,93,140,0.2)" }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" style={{ color: "#E85D8C" }} /> : "Masuk 🚀"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.6)" }}>AnchurPOS v1.0 · Anchur Bandung</p>
      </div>
    </div>
  );
}
