"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, User, Phone, Calendar, DollarSign, KeyRound, Loader2, Save, CheckCircle2 } from "lucide-react";
import { Employee, Role, ROLE_LABEL } from "@/app/manager/employees/types";
import { useAuth } from "@/lib/auth-context";

interface EmployeeModalProps {
  isOpen: boolean;
  initial?: Employee | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function EmployeeModal({ isOpen, initial, onClose, onSuccess }: EmployeeModalProps) {
  const { role: userRole, getToken } = useAuth();
  const [mounted, setMounted] = useState(false);
  const isEdit = !!initial;

  const [form, setForm] = useState({
    name: "",
    username: "",
    role: "crew" as Role,
    phone: "",
    joinDate: "",
    dailyWage: 60000,
  });
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      if (initial) {
        setForm({
          name: initial.name || "",
          username: initial.username || "",
          role: initial.role || "crew",
          phone: initial.phone || "",
          joinDate: initial.joinDate || "",
          dailyWage: initial.dailyWage ?? 60000,
        });
      } else {
        const today = new Date().toISOString().split("T")[0];
        setForm({
          name: "",
          username: "",
          role: "crew",
          phone: "",
          joinDate: today,
          dailyWage: 60000,
        });
        setPassword("");
      }
      setErr("");
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, initial]);

  if (!isOpen || !mounted) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr("Nama lengkap wajib diisi");
      return;
    }
    if (!isEdit && !form.username.trim()) {
      setErr("Username akun wajib diisi");
      return;
    }
    if (!isEdit && (!password || password.length < 6)) {
      setErr("Password akun minimal 6 karakter");
      return;
    }

    setSaving(true);
    setErr("");

    try {
      const token = await getToken();
      const url = isEdit ? `/api/employees/${initial!.id}` : "/api/employees";
      const method = isEdit ? "PATCH" : "POST";

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        role: form.role,
        phone: form.phone ? form.phone.trim() : null,
        joinDate: form.joinDate || null,
        dailyWage: Number(form.dailyWage) || 60000,
      };

      if (!isEdit) {
        payload.username = form.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
        payload.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(data.error || "Gagal menyimpan data karyawan");
        return;
      }

      onSuccess(isEdit ? "Data karyawan berhasil diperbarui" : "Karyawan baru berhasil ditambahkan");
      onClose();
    } catch (e) {
      setErr("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  }

  // Role list available to select
  const availableRoles: Role[] = userRole === "owner" ? ["crew", "manager", "owner"] : ["crew", "manager"];

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                {isEdit ? "Edit Data Karyawan" : "Tambah Karyawan Baru"}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEdit ? `Memperbarui profil ${initial?.name}` : "Buat akun login dan akses kerja tim"}
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
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {err && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
              {err}
            </div>
          )}

          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
              Nama Lengkap *
            </label>
            <input
              type="text"
              placeholder="Contoh: Budi Pratama"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          {!isEdit ? (
            <div>
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Username Akun (Untuk Login) *
              </label>
              <input
                type="text"
                placeholder="budi_pratama"
                value={form.username}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  }))
                }
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
              />
              <p className="text-[10px] text-slate-400 mt-1">Hanya huruf kecil, angka, dan underscore (_).</p>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Username</span>
                <span className="font-mono text-xs font-bold text-slate-700 mt-0.5 block">@{initial?.username}</span>
              </div>
              <span className="text-[10px] text-slate-400 italic">Username login permanen</span>
            </div>
          )}

          {/* Role selector */}
          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
              Role & Hak Akses
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableRoles.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setForm((p) => ({ ...p, role: r }))}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                    form.role === r
                      ? r === "manager"
                        ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                        : r === "owner"
                        ? "bg-purple-600 text-white border-purple-700 shadow-xs"
                        : "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {ROLE_LABEL[r] || r}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                No. WhatsApp / HP
              </label>
              <input
                type="text"
                placeholder="08123456789"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
            <div>
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Tanggal Bergabung
              </label>
              <input
                type="date"
                value={form.joinDate}
                onChange={(e) => setForm((p) => ({ ...p, joinDate: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Gaji Pokok Harian / Shift */}
          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
              Upah Gaji Pokok per Shift (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="number"
                min="0"
                step="5000"
                placeholder="60000"
                value={form.dailyWage}
                onChange={(e) => setForm((p) => ({ ...p, dailyWage: Number(e.target.value) }))}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Gaji pokok yang otomatis dikalikan dengan jumlah shift sah di payroll.
            </p>
          </div>

          {!isEdit && (
            <div>
              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                Password Akun Baru (Min 6 Karakter) *
              </label>
              <input
                type="password"
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs tap-target transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all tap-target cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save size={14} /> Simpan Karyawan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
