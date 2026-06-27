"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2, Plus, Pencil, Trash2, X, Check, KeyRound,
  Users, CalendarDays, UserCheck, ChevronDown, ChevronUp,
  Wallet, Banknote, AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";

type Tab = "karyawan" | "absensi" | "payroll";
type Role = "owner" | "manager" | "crew";

interface PayrollRecord {
  id: string;
  month: string;
  employeeId: string;
  employeeName: string;
  workDays: number;
  dailyWage: number;
  totalRegularPay: number;
  totalOvertimeBonus: number;
  performanceBonus: number;
  performanceBonusNote: string;
  workPeriod: string;
  totalPaid: number;
  pendingReview: number;
  dataStatus: "parsial" | "final";
  status: "belum_dibayar" | "sudah_dibayar";
  paidAt: string | null;
  isLocked: boolean;
}

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

interface Employee {
  id: string; name: string; username: string; role: Role;
  phone: string | null; joinDate: string | null; isActive: boolean;
}
interface AttendanceRecord {
  id: string; employeeId: string; employeeName: string; date: string;
  checkIn: { time: string; ipAddress?: string; ipValid?: boolean } | null;
  checkOut: { time: string | null; ipAddress?: string; ipValid?: boolean } | null;
  totalHours: number | null; status: string;
  overtimeHours?: number | null;
  overtimeBonus?: number | null;
  flaggedReason?: string | null;
}

const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager", crew: "Crew" };
const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  owner:   { bg: "#FEF3C7", color: "#D97706" },
  manager: { bg: "#EFF6FF", color: "#2563EB" },
  crew:    { bg: "#F0FDF4", color: "#16A34A" },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}
function fmtDateFull(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}

// ─── Add/Edit Employee Form ────────────────────────────────────────────────────
function EmployeeForm({ initial, fetchWithAuth, onSuccess, onCancel }: {
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
              style={{ flex: 1, padding: "9px", borderRadius: "10px", fontSize: "12px", fontWeight: "600", border: "none", cursor: "pointer",
                color: form.role === r ? "#fff" : "#64748B",
                background: form.role === r ? (r === "manager" ? "#2563EB" : "#16A34A") : "#F1F5F9" }}
              data-testid={`role-${r}`}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input placeholder="No. HP" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm" data-testid="emp-phone-input" />
          <Input type="date" value={form.joinDate} onChange={e => setForm(p => ({ ...p, joinDate: e.target.value }))}
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

// ─── Change Password Form ──────────────────────────────────────────────────────
function ChangePasswordForm({ emp, fetchWithAuth, onSuccess, onCancel }: {
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ManagerEmployeesPage() {
  const { role, getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("karyawan");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Karyawan state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [pwEmp, setPwEmp] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Absensi state
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expandedAttId, setExpandedAttId] = useState<string | null>(null);
  const [editTotalHours, setEditTotalHours] = useState("");
  const [editOvertimeHours, setEditOvertimeHours] = useState("");
  const [editOvertimeBonus, setEditOvertimeBonus] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [attendanceSubTab, setAttendanceSubTab] = useState<"review" | "riwayat">("review");

  // Payroll state
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generateStartDate, setGenerateStartDate] = useState("");
  const [generateEndDate, setGenerateEndDate] = useState("");
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null);
  const [editWorkPeriod, setEditWorkPeriod] = useState("");
  const [editWorkDays, setEditWorkDays] = useState("");
  const [editDailyWage, setEditDailyWage] = useState("");
  const [editPerformanceBonus, setEditPerformanceBonus] = useState("");
  const [editPerformanceBonusNote, setEditPerformanceBonusNote] = useState("");
  const [savingBonusId, setSavingBonusId] = useState<string | null>(null);
  const [payrollWarnings, setPayrollWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!payrollMonth) return;
    const [yStr, mStr] = payrollMonth.split("-");
    const year = parseInt(yStr);
    const month = parseInt(mStr);

    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }

    const startStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-29`;
    const endStr = `${year}-${String(month).padStart(2, "0")}-28`;

    setGenerateStartDate(startStr);
    setGenerateEndDate(endStr);
  }, [payrollMonth]);

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const handleExpandAtt = (a: AttendanceRecord) => {
    if (expandedAttId === a.id) {
      setExpandedAttId(null);
    } else {
      setExpandedAttId(a.id);
      setEditTotalHours(String(a.totalHours ?? 8));
      setEditOvertimeHours(String(a.overtimeHours ?? 0));
      setEditOvertimeBonus(String(a.overtimeBonus ?? 0));
    }
  };

  const loadAttendance = useCallback(async () => {
    const res = await fetchWithAuth(`/api/attendance?month=${attendanceMonth}`);
    if (res.ok) setAttendance(await res.json());
  }, [fetchWithAuth, attendanceMonth]);

  async function handleReviewAttendance(id: string, a: AttendanceRecord, actionType: "approve" | "adjust" | "reject") {
    setReviewingId(id);
    try {
      const token = await getToken();
      let body: any = {};
      
      if (actionType === "approve") {
        body = { status: "lengkap" };
      } else if (actionType === "adjust") {
        const tot = Number(editTotalHours) || 0;
        const ovt = Number(editOvertimeHours) || 0;
        const bonus = Number(editOvertimeBonus) || 0;
        const reg = Math.min(tot, 8);
        const blocks = Math.floor(ovt);
        
        body = {
          status: "lengkap",
          totalHours: tot,
          regularHours: reg,
          overtimeHours: ovt,
          overtimeBlocks: blocks,
          overtimeBonus: bonus,
          flaggedReason: "Disetujui dengan penyesuaian oleh Manager/Owner"
        };
      } else if (actionType === "reject") {
        body = {
          status: "lengkap",
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          overtimeBlocks: 0,
          overtimeBonus: 0,
          flaggedReason: "Ditolak oleh Manager/Owner"
        };
      }
      
      const res = await fetch(`/api/attendance/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setExpandedAttId(null);
        showSuccess("Review absensi berhasil disimpan!");
        await loadAttendance();
      } else {
        const errData = await res.json();
        alert(errData.error || "Gagal menyimpan review");
      }
    } catch {
      alert("Kesalahan jaringan");
    } finally {
      setReviewingId(null);
    }
  }

  const loadPayroll = useCallback(async () => {
    setLoadingPayroll(true);
    setPayrollWarnings([]);
    try {
      const res = await fetchWithAuth(`/api/payroll?month=${payrollMonth}`);
      if (res.ok) setPayrolls(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPayroll(false);
    }
  }, [fetchWithAuth, payrollMonth]);

  useEffect(() => {
    if (tab === "payroll") loadPayroll();
  }, [tab, loadPayroll]);

  async function handleGeneratePayroll() {
    setGeneratingPayroll(true);
    setError("");
    setPayrollWarnings([]);
    try {
      const res = await fetchWithAuth("/api/payroll/generate", {
        method: "POST",
        body: JSON.stringify({
          month: payrollMonth,
          startDate: generateStartDate || undefined,
          endDate: generateEndDate || undefined
        })
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal membuat payroll");
      } else {
        if (d.warnings && d.warnings.length > 0) {
          setPayrollWarnings(d.warnings);
        }
        showSuccess("Payroll berhasil dihitung & diperbarui!");
        await loadPayroll();
      }
    } catch {
      setError("Kesalahan jaringan");
    } finally {
      setGeneratingPayroll(false);
    }
  }

  async function handleSavePayroll(id: string) {
    const workDaysVal = Number(editWorkDays);
    const dailyWageVal = Number(editDailyWage);
    const bonusVal = Number(editPerformanceBonus);

    if (isNaN(workDaysVal) || workDaysVal < 0) {
      alert("Jumlah hari kerja / shift tidak valid");
      return;
    }
    if (isNaN(dailyWageVal) || dailyWageVal < 0) {
      alert("Rate per shift tidak valid");
      return;
    }
    if (isNaN(bonusVal) || bonusVal < 0) {
      alert("Bonus tidak valid");
      return;
    }

    setSavingBonusId(id);
    try {
      const res = await fetchWithAuth(`/api/payroll/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          workPeriod: editWorkPeriod,
          workDays: workDaysVal,
          dailyWage: dailyWageVal,
          performanceBonus: bonusVal,
          performanceBonusNote: editPerformanceBonusNote,
        })
      });
      if (res.ok) {
        setEditingPayrollId(null);
        await loadPayroll();
        showSuccess("Data payroll berhasil diperbarui!");
      } else {
        const d = await res.json();
        alert(d.error || "Gagal menyimpan payroll");
      }
    } catch {
      alert("Kesalahan jaringan");
    } finally {
      setSavingBonusId(null);
    }
  }

  async function handlePayPayroll(p: PayrollRecord, confirmedDespitePartial = false) {
    if (p.dataStatus === "parsial" && !confirmedDespitePartial) {
      if (window.confirm(`Ada ${p.pendingReview} absensi yang belum direview untuk bulan ini. Apakah Anda yakin ingin memproses pembayaran gaji?`)) {
        handlePayPayroll(p, true);
      }
      return;
    }
    
    if (!confirmedDespitePartial && !window.confirm(`Proses pembayaran gaji untuk ${p.employeeName}? Data gaji akan dikunci.`)) {
      return;
    }

    setPayingId(p.id);
    try {
      const res = await fetchWithAuth(`/api/payroll/${p.id}/pay`, {
        method: "PATCH",
        body: JSON.stringify({ confirmedDespitePartial })
      });
      if (res.ok) {
        showSuccess(`Gaji ${p.employeeName} ditandai sudah dibayar!`);
        await loadPayroll();
      } else {
        const d = await res.json();
        alert(d.error || "Gagal memproses pembayaran");
      }
    } catch {
      alert("Kesalahan jaringan");
    } finally {
      setPayingId(null);
    }
  }

  function printPayrollSlip(p: PayrollRecord) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocker aktif. Mohon izinkan popup untuk mencetak slip.");
      return;
    }

    const regularPayFormatted = fmtRupiah(p.totalRegularPay);
    const overtimeBonusFormatted = fmtRupiah(p.totalOvertimeBonus);
    const performanceBonusFormatted = fmtRupiah(p.performanceBonus);
    const totalPaidFormatted = fmtRupiah(p.totalPaid);
    const dailyWageFormatted = fmtRupiah(p.dailyWage);

    const bonusSection = p.performanceBonus > 0
      ? `<div class="row"><span>Bonus / Insentif:</span><strong>${performanceBonusFormatted}</strong></div>` +
        (p.performanceBonusNote ? `<div class="note">* ${p.performanceBonusNote}</div>` : "")
      : "";

    printWindow.document.write(`
      <html>
        <head>
          <title>Slip Gaji - ${p.employeeName}</title>
          <style>
            body { padding: 20px; font-family: 'Courier New', Courier, monospace; background-color: #f1f5f9; display: flex; justify-content: center; }
            .slip-container { background: #fff; max-width: 380px; width: 100%; border: 1px dashed #000; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 6px; }
            .header h1 { margin: 0; font-size: 18px; font-weight: bold; }
            .header p { margin: 2px 0 0; font-size: 11px; }
            .meta-info { margin-bottom: 10px; font-size: 12px; }
            .meta-info div { margin-bottom: 3px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; border-top: 1px solid #000; margin-top: 8px; padding-top: 6px; }
            .note { font-size: 10px; font-style: italic; color: #333; margin-top: -3px; margin-bottom: 6px; padding-left: 8px; }
            .footer { text-align: center; margin-top: 15px; font-size: 11px; }
            .btn-print { display: block; width: 100%; text-align: center; margin-top: 15px; padding: 8px; background: #E85D8C; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; font-size: 12px; }
            @media print {
              body { margin: 0; padding: 0; background-color: #fff; display: block; }
              .slip-container { max-width: 100%; border: none; padding: 0; box-shadow: none; }
              .btn-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="slip-container">
            <div class="header">
              <h1>Anchur.us</h1>
              <p>SLIP GAJI KARYAWAN</p>
            </div>
            
            <div class="meta-info">
              <div><strong>Nama:</strong> ${p.employeeName}</div>
              <div><strong>Jabatan:</strong> Crew Produksi</div>
              <div><strong>Periode:</strong> ${p.workPeriod || p.month}</div>
            </div>
            
            <div class="divider"></div>
            
            <div class="row">
              <span>Kehadiran (Shift):</span>
              <strong>${p.workDays} shift</strong>
            </div>
            <div class="row">
              <span>Rate per Shift:</span>
              <strong>${dailyWageFormatted}</strong>
            </div>
            
            <div class="divider"></div>
            
            <div class="row">
              <span>Gaji Pokok (${p.workDays} shift):</span>
              <strong>${regularPayFormatted}</strong>
            </div>
            
            <div class="row">
              <span>Bonus Lembur:</span>
              <strong>${overtimeBonusFormatted}</strong>
            </div>
            
            ${bonusSection}
            
            <div class="total-row">
              <span>Total Diterima (THP):</span>
              <span>${totalPaidFormatted}</span>
            </div>
            
            <div class="footer">
              <p>Terima kasih atas kerja kerasnya!</p>
            </div>
            
            <button class="btn-print" onclick="window.print()">Cetak Slip Gaji</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  const loadEmployees = useCallback(async () => {
    const res = await fetchWithAuth("/api/employees");
    if (res.ok) setEmployees(await res.json());
  }, [fetchWithAuth]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadEmployees()]).finally(() => setLoading(false));
  }, [loadEmployees]);

  useEffect(() => {
    if (tab === "absensi") loadAttendance();
  }, [tab, loadAttendance]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  async function handleDelete(emp: Employee) {
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/employees/${emp.id}`, { method: "DELETE" });
      if (res.ok) { setDeleteTarget(null); await loadEmployees(); showSuccess("Karyawan dinonaktifkan"); }
    } finally { setDeleting(false); }
  }

  const activeEmps = employees.filter(e => e.isActive);
  const inactiveEmps = employees.filter(e => !e.isActive);

  return (
    <div className="min-h-screen" style={{ background: "#FCABB4" }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20" style={{ background: "#fff", borderBottom: "1px solid #F1F5F9" }}>
        <div className="px-5 pt-4 pb-2">
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Karyawan</h1>
        </div>
        <div className="flex">
          {(["karyawan", "absensi", "payroll"] as Tab[]).map(t => {
            const active = tab === t;
            const Icon = t === "karyawan" ? Users : t === "absensi" ? CalendarDays : Wallet;
            return (
              <button key={t} onClick={() => { setTab(t); setShowAddForm(false); setEditEmp(null); }}
                data-testid={`tab-${t}`}
                className="flex-1 flex items-center justify-center gap-1.5"
                style={{ paddingTop: "8px", paddingBottom: "10px", border: "none", background: "transparent", cursor: "pointer",
                  borderBottom: active ? "2px solid #E85D8C" : "2px solid transparent",
                  fontSize: "12px", fontWeight: active ? "600" : "500", color: active ? "#E85D8C" : "#94A3B8" }}>
                <Icon size={13} /> {t === "karyawan" ? "Data Karyawan" : t === "absensi" ? "Absensi" : "Gaji & Payroll"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-3 pb-24">

        {/* Success toast */}
        {successMsg && (
          <div className="flex items-center gap-2" style={{ padding: "10px 14px", borderRadius: "12px", background: "#DCFCE7", border: "1px solid #86EFAC", marginBottom: "12px" }}>
            <UserCheck size={14} style={{ color: "#16A34A" }} />
            <span style={{ fontSize: "13px", color: "#16A34A", fontWeight: "600" }}>{successMsg}</span>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <div style={{ padding: "12px 14px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: "12px" }} data-testid="payroll-error">
            <p style={{ fontSize: "13px", color: "#DC2626" }}>{error}</p>
          </div>
        )}

        {/* ── Tab: DATA KARYAWAN ── */}
        {tab === "karyawan" && (
          <>
            {/* Tambah button */}
            {!showAddForm && !editEmp && (
              <button onClick={() => setShowAddForm(true)} data-testid="add-emp-btn"
                className="flex items-center gap-2 mb-3"
                style={{ padding: "10px 16px", borderRadius: "12px", background: "#E85D8C", color: "#fff", fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer" }}>
                <Plus size={15} /> Tambah Karyawan
              </button>
            )}

            {showAddForm && (
              <EmployeeForm fetchWithAuth={fetchWithAuth}
                onSuccess={() => { setShowAddForm(false); loadEmployees(); showSuccess("Karyawan berhasil ditambahkan"); }}
                onCancel={() => setShowAddForm(false)} />
            )}

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: "#E85D8C" }} /></div>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  {activeEmps.length === 0 && !showAddForm && (
                    <div style={{ background: "#fff", borderRadius: "14px", padding: "32px 16px", textAlign: "center", border: "1px solid #F1F5F9" }}>
                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>Belum ada karyawan</p>
                      <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>Tap tombol Tambah Karyawan</p>
                    </div>
                  )}

                  {activeEmps.map(emp => {
                    const rc = ROLE_COLOR[emp.role] ?? { bg: "#F1F5F9", color: "#64748B" };
                    const expanded = expandedId === emp.id;
                    const isEditing = editEmp?.id === emp.id;

                    if (isEditing) return (
                      <EmployeeForm key={emp.id} initial={emp} fetchWithAuth={fetchWithAuth}
                        onSuccess={() => { setEditEmp(null); loadEmployees(); showSuccess("Data berhasil diperbarui"); }}
                        onCancel={() => setEditEmp(null)} />
                    );

                    return (
                      <div key={emp.id} data-testid={`emp-${emp.id}`}>
                        <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }}>
                          {/* Row utama */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div style={{ width: "38px", height: "38px", borderRadius: "12px", background: rc.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: "15px", fontWeight: "800", color: rc.color }}>{emp.name[0].toUpperCase()}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>{emp.name}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#94A3B8" }}>@{emp.username}</span>
                                  <span style={{ padding: "1px 7px", borderRadius: "100px", fontSize: "10px", fontWeight: "700", background: rc.bg, color: rc.color }}>
                                    {ROLE_LABEL[emp.role]}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => setExpandedId(expanded ? null : emp.id)}
                                style={{ width: "30px", height: "30px", borderRadius: "9px", background: "#F8FAFC", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {expanded ? <ChevronUp size={14} style={{ color: "#64748B" }} /> : <ChevronDown size={14} style={{ color: "#64748B" }} />}
                              </button>
                            </div>
                          </div>

                          {/* Expanded: action buttons */}
                          {expanded && (
                            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
                              {emp.phone && <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "10px" }}>HP: {emp.phone}</p>}
                              {emp.joinDate && <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "10px" }}>Bergabung: {new Date(emp.joinDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>}

                              <div className="flex gap-2 flex-wrap">
                                <button onClick={() => { setEditEmp(emp); setExpandedId(null); setPwEmp(null); setDeleteTarget(null); }}
                                  className="flex items-center gap-1.5"
                                  style={{ padding: "7px 12px", borderRadius: "10px", background: "#FEF1F5", color: "#E85D8C", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
                                  data-testid={`edit-emp-${emp.id}`}>
                                  <Pencil size={12} /> Edit Data
                                </button>
                                <button onClick={() => { setPwEmp(pwEmp?.id === emp.id ? null : emp); setDeleteTarget(null); }}
                                  className="flex items-center gap-1.5"
                                  style={{ padding: "7px 12px", borderRadius: "10px", background: "#FEF3C7", color: "#D97706", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
                                  data-testid={`reset-pw-${emp.id}`}>
                                  <KeyRound size={12} /> Ganti Password
                                </button>
                                <button onClick={() => { setDeleteTarget(deleteTarget?.id === emp.id ? null : emp); setPwEmp(null); }}
                                  className="flex items-center gap-1.5"
                                  style={{ padding: "7px 12px", borderRadius: "10px", background: "#FEE2E2", color: "#DC2626", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
                                  data-testid={`deactivate-emp-${emp.id}`}>
                                  <Trash2 size={12} /> Nonaktifkan
                                </button>
                              </div>

                              {pwEmp?.id === emp.id && (
                                <ChangePasswordForm emp={emp} fetchWithAuth={fetchWithAuth}
                                  onSuccess={() => { setPwEmp(null); showSuccess(`Password ${emp.username} berhasil diubah`); }}
                                  onCancel={() => setPwEmp(null)} />
                              )}

                              {deleteTarget?.id === emp.id && (
                                <div style={{ background: "#FEF2F2", borderRadius: "10px", padding: "12px", border: "1px solid #FECACA", marginTop: "8px" }}>
                                  <p style={{ fontSize: "12px", fontWeight: "600", color: "#DC2626", marginBottom: "10px" }}>
                                    Nonaktifkan akun {emp.name}? Mereka tidak bisa login lagi.
                                  </p>
                                  <div className="flex gap-2">
                                    <button onClick={() => handleDelete(emp)} disabled={deleting} data-testid="confirm-deactivate-btn"
                                      style={{ flex: 1, padding: "9px", borderRadius: "9px", background: "#DC2626", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                      {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Nonaktifkan
                                    </button>
                                    <button onClick={() => setDeleteTarget(null)}
                                      style={{ flex: 1, padding: "9px", borderRadius: "9px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "12px" }}>
                                      Batal
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Karyawan nonaktif */}
                {inactiveEmps.length > 0 && (
                  <div style={{ marginTop: "16px" }}>
                    <p style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                      Tidak Aktif ({inactiveEmps.length})
                    </p>
                    <div className="flex flex-col gap-2">
                      {inactiveEmps.map(emp => (
                        <div key={emp.id} style={{ background: "#fff", borderRadius: "12px", padding: "12px 14px", border: "1px solid #F1F5F9", opacity: 0.6 }}>
                          <p style={{ fontSize: "13px", fontWeight: "600", color: "#94A3B8" }}>{emp.name}</p>
                          <p style={{ fontSize: "11px", fontFamily: "monospace", color: "#CBD5E1" }}>@{emp.username}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Tab: ABSENSI ── */}
        {tab === "absensi" && (() => {
          const reviewCount = attendance.filter(a => a.status === "direview").length;
          const reviewItems = attendance.filter(a => a.status === "direview");
          const riwayatItems = attendance.filter(a => a.status === "lengkap" || a.status === "hadir" || a.status === "belum_lengkap");

          return (
            <>
              {/* Month picker */}
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => { const d = new Date(attendanceMonth + "-01"); d.setMonth(d.getMonth() - 1); setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                  style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}>‹</button>
                <p style={{ flex: 1, textAlign: "center", fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>
                  {new Date(attendanceMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                </p>
                <button onClick={() => { const d = new Date(attendanceMonth + "-01"); d.setMonth(d.getMonth() + 1); setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                  style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}>›</button>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-2 mb-3 bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setAttendanceSubTab("review")}
                  style={{
                    flex: 1,
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "700",
                    background: attendanceSubTab === "review" ? "#fff" : "transparent",
                    color: attendanceSubTab === "review" ? "#E85D8C" : "#64748B",
                    border: "none",
                    cursor: "pointer"
                  }}
                  data-testid="attendance-subtab-review"
                >
                  Perlu Review ({reviewCount})
                </button>
                <button 
                  onClick={() => setAttendanceSubTab("riwayat")}
                  style={{
                    flex: 1,
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "700",
                    background: attendanceSubTab === "riwayat" ? "#fff" : "transparent",
                    color: attendanceSubTab === "riwayat" ? "#E85D8C" : "#64748B",
                    border: "none",
                    cursor: "pointer"
                  }}
                  data-testid="attendance-subtab-riwayat"
                >
                  Riwayat Absensi
                </button>
              </div>

              {attendanceSubTab === "review" ? (
                reviewItems.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: "14px", padding: "32px 16px", textAlign: "center", border: "1px solid #F1F5F9" }}>
                    <p style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>Tidak ada absensi yang perlu direview</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {reviewItems.map(a => {
                      const expanded = expandedAttId === a.id;
                      return (
                        <div 
                          key={a.id} 
                          style={{ background: "#fff", borderRadius: "12px", padding: "12px 14px", border: "1px solid #F1F5F9" }}
                        >
                          <div 
                            className="flex items-start justify-between cursor-pointer select-none"
                            onClick={() => handleExpandAtt(a)}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>{a.employeeName}</p>
                                <span style={{ fontSize: "10px", color: "#64748B", fontWeight: "normal" }}>
                                  (klik untuk review)
                                </span>
                              </div>
                              <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                                {fmtDateFull(a.date)} {a.flaggedReason ? `· ${a.flaggedReason}` : ""}
                              </p>
                            </div>
                            <span style={{ padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600",
                              background: "#FEF3C7", color: "#D97706" }}>
                              Review
                            </span>
                          </div>

                          <div className="flex gap-4 mt-2 cursor-pointer" onClick={() => handleExpandAtt(a)}>
                            {a.checkIn && (
                              <p style={{ fontSize: "11px", color: "#64748B" }}>
                                Masuk: <strong>{fmtTime(a.checkIn.time)}</strong> {a.checkIn.ipAddress && `(${a.checkIn.ipAddress})`}
                              </p>
                            )}
                            {a.checkOut?.time && (
                              <p style={{ fontSize: "11px", color: "#64748B" }}>
                                Pulang: <strong>{fmtTime(a.checkOut.time)}</strong> {a.checkOut.ipAddress && `(${a.checkOut.ipAddress})`}
                              </p>
                            )}
                            {a.totalHours !== null && (
                              <p style={{ fontSize: "11px", color: "#64748B" }}>
                                {a.totalHours.toFixed(1)} jam
                              </p>
                            )}
                          </div>

                          {/* Expanded Review Panel */}
                          {expanded && (
                            <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 text-xs">
                              {/* Adjustment fields */}
                              <div className="space-y-3">
                                <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                                  Koreksi Absensi & Lembur
                                </p>
                                
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Total Jam</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={editTotalHours}
                                      onChange={(e) => setEditTotalHours(e.target.value)}
                                      style={{ background: "#F8FAFC" }}
                                      className="w-full h-9 rounded-lg border border-slate-200 px-2 font-semibold text-slate-700 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Lembur (Jam)</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={editOvertimeHours}
                                      onChange={(e) => setEditOvertimeHours(e.target.value)}
                                      style={{ background: "#F8FAFC" }}
                                      className="w-full h-9 rounded-lg border border-slate-200 px-2 font-semibold text-slate-700 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Bonus Lembur (Rp)</label>
                                    <input
                                      type="number"
                                      step="1000"
                                      value={editOvertimeBonus}
                                      onChange={(e) => setEditOvertimeBonus(e.target.value)}
                                      style={{ background: "#F8FAFC" }}
                                      className="w-full h-9 rounded-lg border border-slate-200 px-2 font-semibold text-slate-700 focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div className="flex flex-wrap gap-2 pt-2">
                                <button
                                  disabled={reviewingId === a.id}
                                  onClick={() => handleReviewAttendance(a.id, a, "approve")}
                                  style={{ background: "#10B981" }}
                                  className="flex-1 min-h-[36px] px-3 py-1.5 text-white rounded-xl font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
                                >
                                  Setujui Sesuai Data
                                </button>
                                <button
                                  disabled={reviewingId === a.id}
                                  onClick={() => handleReviewAttendance(a.id, a, "adjust")}
                                  style={{ background: "#0284C7" }}
                                  className="flex-1 min-h-[36px] px-3 py-1.5 text-white rounded-xl font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
                                >
                                  Simpan Koreksi & Setujui
                                </button>
                                <button
                                  disabled={reviewingId === a.id}
                                  onClick={() => handleReviewAttendance(a.id, a, "reject")}
                                  style={{ background: "#EF4444" }}
                                  className="flex-shrink-0 min-h-[36px] px-3 py-1.5 text-white rounded-xl font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
                                >
                                  Tolak Absen
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                riwayatItems.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: "14px", padding: "32px 16px", textAlign: "center", border: "1px solid #F1F5F9" }}>
                    <p style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>Belum ada riwayat absensi pada bulan ini</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {riwayatItems.map(a => (
                      <div 
                        key={a.id} 
                        style={{ background: "#fff", borderRadius: "12px", padding: "12px 14px", border: "1px solid #F1F5F9" }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>{a.employeeName}</p>
                            <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                              {fmtDateFull(a.date)}
                            </p>
                          </div>
                          <span style={{ padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600",
                            background: a.status === "belum_lengkap" ? "#EFF6FF" : "#DCFCE7",
                            color: a.status === "belum_lengkap" ? "#2563EB" : "#16A34A" }}>
                            {a.status === "belum_lengkap" ? "Aktif" : "Lengkap"}
                          </span>
                        </div>

                        <div className="flex gap-4 mt-2">
                          {a.checkIn && (
                            <p style={{ fontSize: "11px", color: "#64748B" }}>
                              Masuk: <strong>{fmtTime(a.checkIn.time)}</strong>
                            </p>
                          )}
                          {a.checkOut?.time && (
                            <p style={{ fontSize: "11px", color: "#64748B" }}>
                              Pulang: <strong>{fmtTime(a.checkOut.time)}</strong>
                            </p>
                          )}
                          {a.totalHours !== null && (
                            <p style={{ fontSize: "11px", color: "#64748B" }}>
                              {a.totalHours.toFixed(1)} jam
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          );
        })()}

        {/* ── Tab: PAYROLL ── */}
        {tab === "payroll" && (
          <>
            {/* Month picker & Generate button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => { const d = new Date(payrollMonth + "-01"); d.setMonth(d.getMonth() - 1); setPayrollMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                  className="tap-target"
                  style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}>‹</button>
                <p style={{ minWidth: "120px", textAlign: "center", fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>
                  {new Date(payrollMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                </p>
                <button onClick={() => { const d = new Date(payrollMonth + "-01"); d.setMonth(d.getMonth() + 1); setPayrollMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                  className="tap-target"
                  style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}>›</button>
              </div>

              <button
                onClick={handleGeneratePayroll}
                disabled={generatingPayroll}
                className="tap-target"
                style={{
                  padding: "8px 16px",
                  borderRadius: "12px",
                  background: "#E85D8C",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: "700",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {generatingPayroll ? <Loader2 size={13} className="animate-spin" /> : <Banknote size={13} />}
                Hitung Ulang & Generate Gaji
              </button>
            </div>

            {/* Custom Date Range picker */}
            <div style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: "1px solid #F1F5F9" }} className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <label style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", display: "block", marginBottom: "4px" }}>TANGGAL MULAI PERIODE</label>
                <input
                  type="date"
                  value={generateStartDate}
                  onChange={(e) => setGenerateStartDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: "36px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    padding: "0 12px",
                    fontSize: "12px",
                    fontWeight: "600",
                    outline: "none",
                    background: "#F8FAFC",
                    color: "#334155"
                  }}
                />
              </div>
              <div className="flex-1">
                <label style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", display: "block", marginBottom: "4px" }}>TANGGAL SELESAI PERIODE</label>
                <input
                  type="date"
                  value={generateEndDate}
                  onChange={(e) => setGenerateEndDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: "36px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    padding: "0 12px",
                    fontSize: "12px",
                    fontWeight: "600",
                    outline: "none",
                    background: "#F8FAFC",
                    color: "#334155"
                  }}
                />
              </div>
            </div>

            {/* Warnings from generation */}
            {payrollWarnings.length > 0 && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Peringatan Data Absensi</p>
                    <ul className="list-disc pl-4 mt-1 space-y-1">
                      {payrollWarnings.map((w, idx) => (
                        <li key={idx} className="text-xxs text-amber-700 font-medium">{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {loadingPayroll ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: "#E85D8C" }} /></div>
            ) : payrolls.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: "14px", padding: "32px 16px", textAlign: "center", border: "1px solid #F1F5F9" }} data-testid="payroll-empty">
                <p style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>Belum ada data payroll untuk bulan ini</p>
                <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>Klik tombol "Hitung Gaji / Generate Payroll" di atas</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {payrolls.map((p) => {
                  const isEditing = editingPayrollId === p.id;
                  const canPay = (role === "owner" || role === "manager") && p.status === "belum_dibayar";

                  return (
                    <div
                      key={p.id}
                      style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: "1px solid #F1F5F9" }}
                      data-testid={`payroll-card-${p.employeeId}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>{p.employeeName}</p>
                          <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                            {p.workPeriod ? `Periode: ${p.workPeriod} · ` : ""}{p.workDays} hari kerja valid @ {fmtRupiah(p.dailyWage)}/hari
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span
                            style={{
                              padding: "3px 9px",
                              borderRadius: "100px",
                              fontSize: "10px",
                              fontWeight: "700",
                              background: p.status === "sudah_dibayar" ? "#DCFCE7" : "#F1F5F9",
                              color: p.status === "sudah_dibayar" ? "#16A34A" : "#64748B"
                            }}
                          >
                            {p.status === "sudah_dibayar" ? "Sudah Dibayar" : "Belum Dibayar"}
                          </span>

                          <span
                            style={{
                              padding: "3px 9px",
                              borderRadius: "100px",
                              fontSize: "10px",
                              fontWeight: "700",
                              background: p.dataStatus === "final" ? "#EFF6FF" : "#FEF3C7",
                              color: p.dataStatus === "final" ? "#2563EB" : "#D97706"
                            }}
                          >
                            {p.dataStatus === "final" ? "Final" : `Parsial (${p.pendingReview} absen direview)`}
                          </span>
                        </div>
                      </div>

                      {/* Gaji Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-xl p-3 mt-3 text-xs">
                        <div>
                          <p style={{ color: "#94A3B8" }}>Gaji Pokok</p>
                          <p style={{ fontWeight: "700", color: "#334155", marginTop: "2px" }}>{fmtRupiah(p.totalRegularPay)}</p>
                        </div>
                        <div>
                          <p style={{ color: "#94A3B8" }}>Bonus Lembur</p>
                          <p style={{ fontWeight: "700", color: "#334155", marginTop: "2px" }}>{fmtRupiah(p.totalOvertimeBonus)}</p>
                        </div>
                        <div>
                          <p style={{ color: "#94A3B8" }}>Bonus Prestasi</p>
                          <p style={{ fontWeight: "700", color: "#334155", marginTop: "2px" }}>{fmtRupiah(p.performanceBonus)}</p>
                        </div>
                        <div>
                          <p style={{ color: "#E85D8C", fontWeight: "600" }}>Total Gaji</p>
                          <p style={{ fontWeight: "800", color: "#E85D8C", marginTop: "2px" }}>{fmtRupiah(p.totalPaid)}</p>
                        </div>
                      </div>

                      {p.performanceBonusNote && (
                        <p style={{ fontSize: "10px", color: "#64748B", fontStyle: "italic", marginTop: "8px", paddingLeft: "4px" }}>
                          * Detail Bonus: {p.performanceBonusNote}
                        </p>
                      )}

                      {/* Aksi Gaji */}
                      <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: "1px solid #F8FAFC" }}>
                        {!isEditing ? (
                          <>
                            {!p.isLocked && (
                              <button
                                onClick={() => {
                                  setEditingPayrollId(p.id);
                                  setEditWorkPeriod(p.workPeriod || "");
                                  setEditWorkDays(String(p.workDays));
                                  setEditDailyWage(String(p.dailyWage));
                                  setEditPerformanceBonus(String(p.performanceBonus));
                                  setEditPerformanceBonusNote(p.performanceBonusNote || "");
                                }}
                                className="tap-target"
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "10px",
                                  background: "#FEF1F5",
                                  color: "#E85D8C",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "11px",
                                  fontWeight: "700"
                                }}
                                data-testid={`edit-bonus-btn-${p.employeeId}`}
                              >
                                Edit Gaji
                              </button>
                            )}
                            <button
                              onClick={() => printPayrollSlip(p)}
                              className="tap-target"
                              style={{
                                padding: "6px 12px",
                                borderRadius: "10px",
                                background: "#F1F5F9",
                                color: "#64748B",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontWeight: "700"
                              }}
                            >
                              Cetak Slip
                            </button>
                            {canPay && (
                              <button
                                onClick={() => handlePayPayroll(p)}
                                disabled={payingId === p.id}
                                className="ml-auto tap-target"
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "10px",
                                  background: "linear-gradient(135deg, #16A34A, #15803D)",
                                  color: "#fff",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                                data-testid={`pay-salary-btn-${p.employeeId}`}
                              >
                                {payingId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                Bayar Gaji
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col gap-3 w-full bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-700">Edit Rincian Slip Gaji</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">PERIODE KERJA</label>
                                <Input
                                  type="text"
                                  placeholder="Contoh: Juni 2026"
                                  value={editWorkPeriod}
                                  onChange={(e) => setEditWorkPeriod(e.target.value)}
                                  className="h-9 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">JUMLAH KEHADIRAN (SHIFT)</label>
                                <Input
                                  type="number"
                                  placeholder="Total kehadiran..."
                                  value={editWorkDays}
                                  onChange={(e) => setEditWorkDays(e.target.value)}
                                  className="h-9 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">RATE PER SHIFT</label>
                                <Input
                                  type="number"
                                  placeholder="Rate per shift..."
                                  value={editDailyWage}
                                  onChange={(e) => setEditDailyWage(e.target.value)}
                                  className="h-9 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">BONUS / INSENTIF</label>
                                <Input
                                  type="number"
                                  placeholder="Bonus..."
                                  value={editPerformanceBonus}
                                  onChange={(e) => setEditPerformanceBonus(e.target.value)}
                                  className="h-9 rounded-lg text-xs"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-1">DETAIL/KETERANGAN BONUS</label>
                              <Input
                                  type="text"
                                  placeholder="Contoh: Bonus rajin packing & target tercapai..."
                                  value={editPerformanceBonusNote}
                                  onChange={(e) => setEditPerformanceBonusNote(e.target.value)}
                                  className="h-9 rounded-lg text-xs"
                              />
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={() => handleSavePayroll(p.id)}
                                disabled={savingBonusId === p.id}
                                className="tap-target"
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: "8px",
                                  background: "#E85D8C",
                                  color: "#fff",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "11px",
                                  fontWeight: "700"
                                }}
                                data-testid={`save-bonus-btn-${p.employeeId}`}
                              >
                                {savingBonusId === p.id ? <Loader2 size={11} className="animate-spin" /> : "Simpan Perubahan"}
                              </button>
                              <button
                                onClick={() => setEditingPayrollId(null)}
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: "8px",
                                  background: "#F1F5F9",
                                  color: "#64748B",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "11px",
                                  fontWeight: "600"
                                }}
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
