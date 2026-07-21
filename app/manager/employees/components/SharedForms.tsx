"use client";

import { useState } from "react";
import { Loader2, Check, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Employee, Role, ROLE_LABEL, AttendanceRecord } from "../types";

export function EmployeeForm({ initial, fetchWithAuth, onSuccess, onCancel }: {
  initial?: Employee;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    username: initial?.username ?? "",
    role: initial?.role ?? "crew" as Role,
    phone: initial?.phone ?? "",
    joinDate: initial?.joinDate ?? "",
  });
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim()) { setErr("Nama wajib diisi"); return; }
    if (!isEdit && !form.username.trim()) { setErr("Username wajib diisi"); return; }
    if (!isEdit && (!password || password.length < 6)) { setErr("Password minimal 6 karakter"); return; }
    setSaving(true); setErr("");
    try {
      const url = isEdit ? `/api/employees/${initial!.id}` : "/api/employees";
      const method = isEdit ? "PATCH" : "POST";
      const body: Record<string, unknown> = { name: form.name.trim(), role: form.role, phone: form.phone || null, joinDate: form.joinDate || null };
      if (!isEdit) { body.username = form.username.trim(); body.password = password; }
      const res = await fetchWithAuth(url, { method, body: JSON.stringify(body) });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#F8FAFC", borderRadius: "14px", padding: "14px", border: "1px solid #E2E8F0", marginBottom: "12px" }}>
      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E", marginBottom: "12px" }}>
        {isEdit ? "Edit Karyawan" : "Tambah Karyawan"}
      </p>
      <div className="flex flex-col gap-2.5">
        <Input placeholder="Nama lengkap *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          className="h-10 rounded-xl border-slate-200 text-sm" data-testid="emp-name-input" />

        {!isEdit && (
          <Input placeholder="Username *" value={form.username}
            onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
            className="h-10 rounded-xl border-slate-200 text-sm font-mono" data-testid="emp-username-input" />
        )}

        {isEdit && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "#F1F5F9", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: "12px", color: "#94A3B8" }}>Username:</span>
            <span style={{ fontSize: "13px", fontWeight: "600", fontFamily: "monospace", color: "#64748B" }}>{initial?.username}</span>
          </div>
        )}

        {/* Role selector */}
        <div className="flex gap-2">
          {(["crew", "manager"] as Role[]).map(r => (
            <button key={r} onClick={() => setForm(p => ({ ...p, role: r }))}
              style={{
                flex: 1, padding: "9px", borderRadius: "10px", fontSize: "12px", fontWeight: "600", border: "none", cursor: "pointer",
                color: form.role === r ? "#fff" : "#64748B",
                background: form.role === r ? (r === "manager" ? "#2563EB" : "#16A34A") : "#F1F5F9"
              }}
              data-testid={`role-${r}`}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input placeholder="No. HP" value={form.phone ?? ""} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm" data-testid="emp-phone-input" />
          <Input type="date" value={form.joinDate ?? ""} onChange={e => setForm(p => ({ ...p, joinDate: e.target.value }))}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm" title="Tanggal bergabung" />
        </div>

        {!isEdit && (
          <Input type="password" placeholder="Password (min 6 karakter) *" value={password}
            onChange={e => setPassword(e.target.value)}
            className="h-10 rounded-xl border-slate-200 text-sm" data-testid="emp-password-input" />
        )}

        {err && <p style={{ fontSize: "12px", color: "#DC2626" }}>{err}</p>}

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} data-testid="save-emp-btn"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#E85D8C" }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan
          </button>
          <button onClick={onCancel}
            style={{ padding: "8px 16px", borderRadius: "12px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChangePasswordForm({ emp, fetchWithAuth, onSuccess, onCancel }: {
  emp: Employee;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!pw || pw.length < 6) { setErr("Password minimal 6 karakter"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetchWithAuth(`/api/employees/${emp.id}/password`, {
        method: "PATCH", body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#FEF3C7", borderRadius: "10px", padding: "12px", border: "1px solid #FDE68A", marginTop: "8px" }}>
      <p style={{ fontSize: "12px", fontWeight: "700", color: "#D97706", marginBottom: "10px" }}>
        Ganti password <span style={{ fontFamily: "monospace" }}>{emp.username}</span>
      </p>
      <div className="flex gap-2">
        <Input type="password" placeholder="Password baru (min 6)" value={pw}
          onChange={e => setPw(e.target.value)}
          className="flex-1 h-9 rounded-xl border-yellow-200 text-sm" data-testid="new-password-input" />
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "8px 14px", borderRadius: "10px", background: "#D97706", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}
          data-testid="save-password-btn">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Simpan
        </button>
        <button onClick={onCancel}
          style={{ padding: "8px 12px", borderRadius: "10px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "12px" }}>
          Batal
        </button>
      </div>
      {err && <p style={{ fontSize: "11px", color: "#DC2626", marginTop: "6px" }}>{err}</p>}
    </div>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateFull(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}

export function AttendanceReviewCard({ a, onReview, reviewingId, isCorrectionMode = false, editData, onEditChange }: { 
  a: AttendanceRecord; 
  onReview?: (id: string, a: AttendanceRecord, actionType: "approve" | "adjust" | "reject", data?: any) => void;
  reviewingId?: string | null;
  isCorrectionMode?: boolean;
  editData?: { tot: string, ovt: string, bonus: string };
  onEditChange?: (field: "tot" | "ovt" | "bonus", val: string) => void;
}) {
  const [totLocal, setTotLocal] = useState(String(a.totalHours ?? 8));
  const [ovtLocal, setOvtLocal] = useState(String(a.overtimeHours ?? 0));
  const [bonusLocal, setBonusLocal] = useState(String(a.overtimeBonus ?? 0));

  const tot = isCorrectionMode && editData ? editData.tot : totLocal;
  const ovt = isCorrectionMode && editData ? editData.ovt : ovtLocal;
  const bonus = isCorrectionMode && editData ? editData.bonus : bonusLocal;

  const handleTot = (v: string) => { if (isCorrectionMode && onEditChange) onEditChange("tot", v); else setTotLocal(v); };
  const handleOvt = (v: string) => { if (isCorrectionMode && onEditChange) onEditChange("ovt", v); else setOvtLocal(v); };
  const handleBonus = (v: string) => { if (isCorrectionMode && onEditChange) onEditChange("bonus", v); else setBonusLocal(v); };

  const isDirty = (field: "tot" | "ovt" | "bonus") => {
    if (!isCorrectionMode || !editData) return false;
    if (field === "tot") return Number(tot) !== (a.totalHours ?? 8);
    if (field === "ovt") return Number(ovt) !== (a.overtimeHours ?? 0);
    if (field === "bonus") return Number(bonus) !== (a.overtimeBonus ?? 0);
    return false;
  };

  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: "1px solid #F1F5F9", boxShadow: "0 2px 10px rgba(0,0,0,0.015)" }}>
      <div className="flex items-start justify-between border-b border-slate-50 pb-3 mb-3">
        <div>
          <p style={{ fontSize: "14px", fontWeight: "800", color: "#1C1C1E" }}>{a.employeeName}</p>
          <div className="flex items-center gap-1.5 mt-1 text-slate-400">
            <CalendarDays size={12} />
            <span style={{ fontSize: "11px", fontWeight: "600" }}>
              {fmtDateFull(a.date)} {a.flaggedReason ? `· ${a.flaggedReason}` : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          {a.checkIn && (
            <p style={{ fontSize: "11px", color: "#64748B", background: "#F1F5F9", padding: "2px 8px", borderRadius: "100px", fontWeight: "600" }}>
              Masuk: <span className="text-slate-700">{fmtTime(a.checkIn.time)}</span>
            </p>
          )}
          {a.checkOut?.time && (
            <p style={{ fontSize: "11px", color: "#64748B", background: "#F1F5F9", padding: "2px 8px", borderRadius: "100px", fontWeight: "600" }}>
              Pulang: <span className="text-slate-700">{fmtTime(a.checkOut.time)}</span>
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">TOTAL JAM</label>
            <div className="relative">
              <input type="number" step="0.1" value={tot} onChange={(e) => handleTot(e.target.value)} style={{ background: isDirty("tot") ? "#FEF9C3" : "" }} className={`w-full h-9 rounded-lg border ${isDirty("tot") ? "border-yellow-400 text-yellow-900" : "border-slate-200 text-slate-700"} pl-3 pr-8 font-bold focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-pink-300 text-xs transition-all`} />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isDirty("tot") ? "text-yellow-700" : "text-slate-400"}`}>Jam</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">LEMBUR</label>
            <div className="relative">
              <input type="number" step="0.1" value={ovt} onChange={(e) => handleOvt(e.target.value)} style={{ background: isDirty("ovt") ? "#FEF9C3" : "" }} className={`w-full h-9 rounded-lg border ${isDirty("ovt") ? "border-yellow-400 text-yellow-900" : "border-slate-200 text-slate-700"} pl-3 pr-8 font-bold focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-pink-300 text-xs transition-all`} />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isDirty("ovt") ? "text-yellow-700" : "text-slate-400"}`}>Jam</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">BONUS (Rp)</label>
            <input type="number" step="1000" value={bonus} onChange={(e) => handleBonus(e.target.value)} style={{ background: isDirty("bonus") ? "#FEF9C3" : "" }} className={`w-full h-9 rounded-lg border ${isDirty("bonus") ? "border-yellow-400 text-yellow-900" : "border-slate-200 text-slate-700"} px-3 font-bold focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-pink-300 text-xs transition-all`} />
          </div>
        </div>

        {!isCorrectionMode && onReview && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
            <button disabled={reviewingId === a.id} onClick={() => onReview(a.id, a, "reject")} className="tap-target flex items-center justify-center" style={{ background: "#FEF2F2", color: "#EF4444", padding: "8px 16px", borderRadius: "10px", fontWeight: "700", fontSize: "12px", border: "1px solid #FECACA", cursor: "pointer", opacity: reviewingId === a.id ? 0.6 : 1 }}>
              {reviewingId === a.id ? <Loader2 size={13} className="animate-spin" /> : "Tolak"}
            </button>
            <button disabled={reviewingId === a.id} onClick={() => onReview(a.id, a, "adjust", { totalHours: Number(tot), overtimeHours: Number(ovt), overtimeBonus: Number(bonus) })} className="flex-1 flex items-center justify-center" style={{ background: "#EFF6FF", color: "#2563EB", padding: "8px 16px", borderRadius: "10px", fontWeight: "700", fontSize: "12px", border: "1px solid #BFDBFE", cursor: "pointer", opacity: reviewingId === a.id ? 0.6 : 1 }}>
              {reviewingId === a.id ? <Loader2 size={13} className="animate-spin" /> : "Ubah & Terima"}
            </button>
            <button disabled={reviewingId === a.id} onClick={() => onReview(a.id, a, "approve")} className="flex-1 flex items-center justify-center" style={{ background: "#F0FDF4", color: "#16A34A", padding: "8px 16px", borderRadius: "10px", fontWeight: "700", fontSize: "12px", border: "1px solid #BBF7D0", cursor: "pointer", opacity: reviewingId === a.id ? 0.6 : 1 }}>
              {reviewingId === a.id ? <Loader2 size={13} className="animate-spin" /> : "Sesuai"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
