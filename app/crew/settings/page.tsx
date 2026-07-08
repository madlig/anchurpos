"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

export default function CrewSettingsPage() {
  const { user, getToken, logout } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword.length < 6) {
      setError("Password baru harus minimal 6 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Password konfirmasi tidak cocok.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengubah password.");
      } else {
        setSuccess(true);
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-enter min-h-screen" style={{ background: "#FCABB4" }}>
      {/* Header (Glassmorphism) */}
      <div className="px-5 pt-5 pb-5 rounded-b-[24px] sticky top-0 z-30 bg-white/90 backdrop-blur-xl shadow-sm border-b border-pink-200">
        <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Pengaturan Akun</h1>
        <p className="text-[12px] font-medium mt-1 text-slate-500">
          {user?.displayName ?? "Crew"} · Kelola profil dan password
        </p>
      </div>

      <div className="px-4 pt-6 pb-4 md:px-8 md:max-w-2xl">
        <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #F1F5F9", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
          <div className="flex items-center gap-2.5 mb-4">
            <div style={{ padding: "8px", background: "#FEF1F5", borderRadius: "10px", color: "#E85D8C" }}>
              <KeyRound size={20} />
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>Ubah Password Login</p>
              <p style={{ fontSize: "11px", color: "#94A3B8" }}>Ganti password akun POS Anda secara mandiri</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "10px 12px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p style={{ fontSize: "11px", color: "#B91C1C", fontWeight: "500" }}>{error}</p>
              </div>
            )}

            {success && (
              <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "10px", padding: "10px 12px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                <p style={{ fontSize: "11px", color: "#15803D", fontWeight: "500" }}>Password Anda berhasil diperbarui!</p>
              </div>
            )}

            <div>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", display: "block", marginBottom: "4px" }}>Password Baru</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                style={{
                  width: "100%",
                  height: "40px",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  padding: "0 12px",
                  fontSize: "13px",
                  fontWeight: "600",
                  outline: "none",
                  background: "#F8FAFC"
                }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", display: "block", marginBottom: "4px" }}>Konfirmasi Password Baru</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                style={{
                  width: "100%",
                  height: "40px",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  padding: "0 12px",
                  fontSize: "13px",
                  fontWeight: "600",
                  outline: "none",
                  background: "#F8FAFC"
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg,#E85D8C,#C94A73)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: "700",
                border: "none",
                cursor: submitting ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
              className="tap-target"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : "Simpan Password Baru"}
            </button>
          </form>
        </div>

        <div className="mt-4" style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #F1F5F9", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>Logout Akun</p>
              <p style={{ fontSize: "11px", color: "#94A3B8" }}>Keluar dari sesi aplikasi di perangkat ini</p>
            </div>
            <button
              onClick={logout}
              className="tap-target"
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                background: "#FEF2F2",
                color: "#DC2626",
                border: "1px solid #FEE2E2",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "700"
              }}
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
