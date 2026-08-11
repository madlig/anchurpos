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
    <div className="min-h-screen bg-slate-50/80 pb-28 px-4 pt-4 max-w-xl mx-auto space-y-4 page-enter">
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
            <KeyRound size={22} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800">Pengaturan</h1>
            <p className="text-xs font-semibold text-slate-400">
              {user?.displayName ?? "Crew"} · Kelola Akun
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-700 shrink-0">
              <KeyRound size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">Ubah Password Login</p>
              <p className="text-[11px] font-semibold text-slate-400">Ganti password akun POS Anda secara mandiri</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            {error && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-emerald-600">Password Anda berhasil diperbarui!</p>
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Password Baru</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/20"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Konfirmasi Password Baru</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/20"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-50 mt-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : "Simpan Password Baru"}
            </button>
          </form>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-slate-800">Logout Akun</p>
            <p className="text-[11px] font-semibold text-slate-400">Keluar dari perangkat ini</p>
          </div>
          <button
            onClick={logout}
            className="px-5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-black text-xs uppercase tracking-wider transition-all active:scale-95"
          >
            Keluar
          </button>
        </div>
      </div>
    </div>
  );
}
