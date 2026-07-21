"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, User, Mail, Shield, LogOut, Key } from "lucide-react";

export default function ManagerProfilePage() {
  const { user, role, logout, getToken } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Semua field kata sandi wajib diisi");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi baru tidak cocok");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Gagal mengubah kata sandi");
        return;
      }

      setSuccess("Kata sandi berhasil diubah!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-5 pt-6 pb-20 md:px-8 md:pt-8 page-enter">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "#FEF1F5" }}>
          <User size={16} style={{ color: "#E85D8C" }} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#1C1C1E" }}>Profil Akun</h1>
      </div>

      {/* Profile Card */}
      <div className="rounded-3xl p-5 mb-5 space-y-4" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-50">
          <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-extrabold text-lg" style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)" }}>
            {(user?.displayName ?? "M")[0].toUpperCase()}
          </div>
          <div>
            <p className="text-base font-extrabold" style={{ color: "#1C1C1E" }}>{user?.displayName ?? "Manager"}</p>
            <span className="inline-block text-xs font-bold px-2 py-0.5 mt-1 rounded-full text-primary bg-primary/10 border border-primary/20 uppercase">
              {role ?? "Manager"}
            </span>
          </div>
        </div>

        <div className="space-y-3.5 text-slate-600">
          <div className="flex items-center gap-3">
            <Mail size={16} className="text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-xxs text-slate-400 block">E-mail Terdaftar</span>
              <span className="text-xs font-semibold text-slate-700 truncate block">{user?.email ?? "—"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Shield size={16} className="text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-xxs text-slate-400 block">ID Pengguna</span>
              <span className="text-xs font-semibold text-slate-700 truncate block">{user?.uid ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="rounded-3xl p-5 mb-5" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Key size={15} style={{ color: "#E85D8C" }} />
          <h2 className="text-sm font-bold" style={{ color: "#1C1C1E" }}>Ubah Kata Sandi</h2>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-3.5">
          <div>
            <label className="text-xxs font-bold text-slate-400 block mb-1.5 uppercase">Kata Sandi Lama</label>
            <input
              type="password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              className="w-full rounded-2xl px-4 py-3 text-xs outline-none transition-colors border border-slate-200 bg-brand-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xxs font-bold text-slate-400 block mb-1.5 uppercase">Kata Sandi Baru</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full rounded-2xl px-4 py-3 text-xs outline-none transition-colors border border-slate-200 bg-brand-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xxs font-bold text-slate-400 block mb-1.5 uppercase">Konfirmasi Kata Sandi Baru</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full rounded-2xl px-4 py-3 text-xs outline-none transition-colors border border-slate-200 bg-brand-50 focus:bg-white"
            />
          </div>

          {error && <p className="text-xxs text-red-500 text-center font-semibold">{error}</p>}
          {success && <p className="text-xxs text-green-600 text-center font-bold">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center font-bold text-xs rounded-2xl min-h-[44px] text-white active:scale-[0.98] transition-all disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)" }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : "Ubah Kata Sandi"}
          </button>
        </form>
      </div>

      {/* Logout Button */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 font-bold text-xs rounded-3xl min-h-[48px] transition-all border tap-target text-red-600 border-red-200 bg-red-50/50 hover:bg-red-50"
      >
        <LogOut size={14} />
        Keluar dari Aplikasi
      </button>
    </div>
  );
}
