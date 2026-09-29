"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, KeyRound, Eye, EyeOff, Loader2, Check } from "lucide-react";
import { Employee } from "@/app/manager/employees/types";
import { useAuth } from "@/lib/auth-context";

interface ChangePasswordModalProps {
  isOpen: boolean;
  emp: Employee | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function ChangePasswordModal({
  isOpen,
  emp,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const { getToken } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setErr("");
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !mounted || !emp) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password.length < 6) {
      setErr("Password minimal 6 karakter");
      return;
    }
    if (password !== confirmPassword) {
      setErr("Konfirmasi password tidak cocok");
      return;
    }

    setSaving(true);
    setErr("");

    try {
      const token = await getToken();
      const res = await fetch(`/api/employees/${emp!.id}/password`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(data.error || "Gagal mengubah password");
        return;
      }

      onSuccess(`Password untuk @${emp!.username} berhasil diperbarui`);
      onClose();
    } catch (e) {
      setErr("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Ganti Password</h3>
              <p className="text-[11px] text-slate-400">
                Akun: <span className="font-mono text-amber-300">@{emp.username}</span> ({emp.name})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {err && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
              {err}
            </div>
          )}

          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
              Password Baru *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
              Ulangi Password Baru *
            </label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Ulangi password baru"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-slate-50/50"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>{saving ? "Menyimpan..." : "Simpan Password"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
