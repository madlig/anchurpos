"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2, Plus, Pencil, Trash2, X, Check, KeyRound,
  Users, CalendarDays, UserCheck, ChevronDown, ChevronUp,
  Wallet, Banknote, AlertTriangle, MoreHorizontal, Clock, TrendingUp
} from "lucide-react";
import { Input } from "@/components/ui/input";

type Tab = "karyawan" | "absensi" | "payroll";

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

import { EmployeeForm, ChangePasswordForm, AttendanceReviewCard } from "./components/SharedForms";
import { Employee, Role, ROLE_LABEL, ROLE_COLOR, AttendanceRecord } from "./types";

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

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



// ─── Manual Attendance Form ───────────────────────────────────────────────────
function ManualAttendanceForm({ employees, onSuccess, onCancel, fetchWithAuth, initialData }: {
  employees: Employee[];
  onSuccess: () => void;
  onCancel: () => void;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  initialData?: { empId: string; date: string; checkInTime: string } | null;
}) {
  const [empId, setEmpId] = useState(initialData?.empId || "");
  const [date, setDate] = useState(initialData?.date || "");
  const [checkInTime, setCheckInTime] = useState(initialData?.checkInTime || "");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId || !date || !checkInTime || !checkOutTime) {
      setError("Semua field wajib diisi");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetchWithAuth("/api/attendance/manual", {
        method: "POST",
        body: JSON.stringify({ employeeId: empId, date, checkInTime, checkOutTime })
      });
      if (res.ok) {
        onSuccess();
      } else {
        const d = await res.json();
        setError(d.error || "Gagal menyimpan data absensi manual");
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: "1px solid #F1F5F9", marginBottom: "16px", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }} className="animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
        <div>
          <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#1C1C1E" }}>Tambah Absensi Manual</h3>
          <p style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>Input data shift yang terlewat (otomatis berstatus lengkap)</p>
        </div>
        <button onClick={onCancel} style={{ background: "#F1F5F9", border: "none", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" }}>
          <X size={14} />
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px", background: "#FEF2F2", color: "#DC2626", borderRadius: "10px", fontSize: "12px", marginBottom: "12px", border: "1px solid #FECACA" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", display: "block", marginBottom: "4px" }}>KARYAWAN</label>
          <select value={empId} onChange={e => setEmpId(e.target.value)} style={{ width: "100%", height: "38px", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "0 12px", fontSize: "13px", color: "#334155", outline: "none", background: "#F8FAFC" }}>
            <option value="">-- Pilih Karyawan --</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({ROLE_LABEL[e.role]})</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", display: "block", marginBottom: "4px" }}>TANGGAL ABSENSI</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", height: "38px", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "0 12px", fontSize: "13px", color: "#334155", outline: "none", background: "#F8FAFC" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", display: "block", marginBottom: "4px" }}>JAM MASUK</label>
            <input type="time" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} style={{ width: "100%", height: "38px", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "0 12px", fontSize: "13px", color: "#334155", outline: "none", background: "#F8FAFC" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", display: "block", marginBottom: "4px" }}>JAM KELUAR</label>
            <input type="time" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} style={{ width: "100%", height: "38px", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "0 12px", fontSize: "13px", color: "#334155", outline: "none", background: "#F8FAFC" }} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-50">
          <button type="button" onClick={onCancel} style={{ padding: "10px 16px", borderRadius: "10px", background: "transparent", color: "#64748B", border: "1px solid #E2E8F0", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>Batal</button>
          <button type="submit" disabled={loading} style={{ padding: "10px 16px", borderRadius: "10px", background: "#10B981", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan Data
          </button>
        </div>
      </form>
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
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expandedAttId, setExpandedAttId] = useState<string | null>(null);
  const [editTotalHours, setEditTotalHours] = useState("");
  const [editOvertimeHours, setEditOvertimeHours] = useState("");
  const [editOvertimeBonus, setEditOvertimeBonus] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [attendanceSubTab, setAttendanceSubTab] = useState<"review" | "riwayat">("review");
  const [showManualAttForm, setShowManualAttForm] = useState(false);
  const [manualAttInitialData, setManualAttInitialData] = useState<{empId: string; date: string; checkInTime: string;} | null>(null);

  // Payroll state
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [generateStartDate, setGenerateStartDate] = useState("");
  const [generateEndDate, setGenerateEndDate] = useState("");
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null);
  const [expandedPayrollId, setExpandedPayrollId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [editWorkPeriod, setEditWorkPeriod] = useState("");
  const [editWorkDays, setEditWorkDays] = useState("");
  const [editDailyWage, setEditDailyWage] = useState("");
  const [editPerformanceBonus, setEditPerformanceBonus] = useState("");
  const [editPerformanceBonusNote, setEditPerformanceBonusNote] = useState("");
  const [savingBonusId, setSavingBonusId] = useState<string | null>(null);
  const [payrollWarnings, setPayrollWarnings] = useState<string[]>([]);
  
  // Bulk Save State for Correction Mode
  const [shiftEdits, setShiftEdits] = useState<Record<string, { tot: string, ovt: string, bonus: string }>>({});
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  useEffect(() => {
    if (!selectedMonth) return;
    const [yStr, mStr] = selectedMonth.split("-");
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
  }, [selectedMonth]);

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
    if (!generateStartDate || !generateEndDate) return;
    const res = await fetchWithAuth(`/api/attendance?month=${selectedMonth}&startDate=${generateStartDate}&endDate=${generateEndDate}`);
    if (res.ok) setAttendance(await res.json());
  }, [fetchWithAuth, selectedMonth, generateStartDate, generateEndDate]);

  async function handleReviewAttendance(id: string, a: AttendanceRecord, actionType: "approve" | "adjust" | "reject", data?: any) {
    setReviewingId(id);
    try {
      const token = await getToken();
      let body: any = {};

      if (actionType === "approve") {
        body = { status: "lengkap" };
      } else if (actionType === "adjust") {
        const tot = Number(data?.tot) || 0;
        const ovt = Number(data?.ovt) || 0;
        const bonus = Number(data?.bonus) || 0;
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
        if (tab === "payroll") {
          await handleGeneratePayroll();
        }
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

  async function handleBulkApprove() {
    const toReview = attendance.filter(a => a.status === "direview");
    if (toReview.length === 0) return;
    
    if (!confirm(`Anda yakin ingin menyetujui semua (${toReview.length}) absensi sesuai data sistem?`)) return;
    
    setReviewingId("bulk");
    try {
      const token = await getToken();
      let count = 0;
      
      for (const a of toReview) {
        const res = await fetch(`/api/attendance/${a.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status: "lengkap" })
        });
        if (res.ok) count++;
      }
      
      showSuccess(`Berhasil menyetujui ${count} absensi!`);
      await loadAttendance();
    } catch (err) {
      alert("Gagal menyetujui absensi secara massal");
    } finally {
      setReviewingId(null);
    }
  }

  const handleEditChange = (id: string, field: "tot" | "ovt" | "bonus", val: string) => {
    setShiftEdits(prev => {
      const existing = prev[id] || { 
        tot: String(attendance.find(a => a.id === id)?.totalHours ?? 8), 
        ovt: String(attendance.find(a => a.id === id)?.overtimeHours ?? 0), 
        bonus: String(attendance.find(a => a.id === id)?.overtimeBonus ?? 0) 
      };
      return { ...prev, [id]: { ...existing, [field]: val } };
    });
  };

  async function handleBulkSaveCorrections(employeeId: string) {
    const editKeys = Object.keys(shiftEdits);
    // filter to only those belonging to this employee
    const myEdits = editKeys.filter(id => attendance.find(a => a.id === id)?.employeeId === employeeId);
    if (myEdits.length === 0) return;

    setIsBulkSaving(true);
    try {
      const token = await getToken();
      let count = 0;
      for (const id of myEdits) {
        const data = shiftEdits[id];
        const tot = Number(data.tot) || 0;
        const ovt = Number(data.ovt) || 0;
        const bonus = Number(data.bonus) || 0;
        const reg = Math.min(tot, 8);
        const blocks = Math.floor(ovt);

        const res = await fetch(`/api/attendance/${id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "lengkap",
            totalHours: tot,
            regularHours: reg,
            overtimeHours: ovt,
            overtimeBlocks: blocks,
            overtimeBonus: bonus,
            flaggedReason: "Dikoreksi masal oleh Manager/Owner"
          })
        });
        if (res.ok) count++;
      }
      
      showSuccess(`${count} perubahan berhasil disimpan! Menghitung ulang gaji...`);
      
      // Clear edits for this employee
      setShiftEdits(prev => {
        const next = { ...prev };
        myEdits.forEach(id => delete next[id]);
        return next;
      });

      await loadAttendance();
      await handleGeneratePayroll();
    } catch (err) {
      alert("Gagal menyimpan koreksi massal");
    } finally {
      setIsBulkSaving(false);
    }
  }

  const loadPayroll = useCallback(async () => {
    setLoadingPayroll(true);
    setPayrollWarnings([]);
    try {
      const res = await fetchWithAuth(`/api/payroll?month=${selectedMonth}`);
      if (res.ok) setPayrolls(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPayroll(false);
    }
  }, [fetchWithAuth, selectedMonth]);

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
          month: selectedMonth,
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
            .btn-close { display: block; width: 100%; text-align: center; margin-top: 8px; padding: 8px; background: #64748B; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; font-size: 12px; }
            @media print {
              body { margin: 0; padding: 0; background-color: #fff; display: block; }
              .slip-container { max-width: 100%; border: none; padding: 0; box-shadow: none; }
              .btn-print, .btn-close { display: none; }
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
              <p>Makasih banyak untuk kontribusinya di Anchur.us! Kamu hebat!</p>
            </div>
            
            <button class="btn-print" onclick="window.print()">Cetak Slip Gaji</button>
            <button class="btn-close" onclick="window.close()">Kembali ke Aplikasi</button>
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
    if (tab === "absensi" || tab === "payroll") {
      loadAttendance();
    }
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
      <div className="sticky top-0 z-30" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(226, 232, 240, 0.6)", boxShadow: "0 4px 20px -10px rgba(0,0,0,0.05)" }}>
        <div className="px-5 pt-5 pb-3">
          <h1 style={{ fontSize: "20px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.5px" }}>Tim & Karyawan</h1>
        </div>
        <div className="flex px-2">
          {(["karyawan", "absensi", "payroll"] as Tab[]).map(t => {
            const active = tab === t;
            const Icon = t === "karyawan" ? Users : t === "absensi" ? CalendarDays : Wallet;
            return (
              <button key={t} onClick={() => { setTab(t); setShowAddForm(false); setEditEmp(null); }}
                data-testid={`tab-${t}`}
                className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 transition-all duration-200"
                style={{
                  padding: "10px 4px", border: "none", background: "transparent", cursor: "pointer",
                  borderBottom: active ? "3px solid #E85D8C" : "3px solid transparent",
                  color: active ? "#E85D8C" : "#94A3B8"
                }}>
                <Icon size={16} strokeWidth={active ? 2.5 : 2} /> 
                <span style={{ fontSize: "12px", fontWeight: active ? "700" : "600", marginTop: "2px" }}>
                  {t === "karyawan" ? "Data Karyawan" : t === "absensi" ? "Absensi" : "Gaji & Payroll"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-3 pb-24">

        {/* Success toast */}
        {successMsg && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4" style={{ 
            position: "fixed",
            bottom: "32px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 20px", 
            borderRadius: "100px", 
            background: "#DCFCE7", 
            border: "1px solid #86EFAC", 
            boxShadow: "0 10px 25px -5px rgba(22, 163, 74, 0.3)",
            zIndex: 9999
          }}>
            <UserCheck size={16} style={{ color: "#16A34A" }} />
            <span style={{ fontSize: "14px", color: "#16A34A", fontWeight: "700" }}>{successMsg}</span>
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
              {/* Period Date Filter for Attendance */}
              <div style={{ background: "#fff", borderRadius: "16px", padding: "12px 16px", border: "1px solid #F1F5F9" }} className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => { const d = new Date(selectedMonth + "-01"); d.setMonth(d.getMonth() - 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                    style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid #E2E8F0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}>‹</button>
                  <p style={{ flex: 1, textAlign: "center", fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>
                    {new Date(selectedMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                  </p>
                  <button onClick={() => { const d = new Date(selectedMonth + "-01"); d.setMonth(d.getMonth() + 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                    style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid #E2E8F0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}>›</button>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", display: "block", marginBottom: "4px" }}>TANGGAL MULAI PERIODE</label>
                    <input type="date" value={generateStartDate} onChange={(e) => setGenerateStartDate(e.target.value)}
                      style={{ width: "100%", height: "36px", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "0 12px", fontSize: "12px", fontWeight: "600", outline: "none", background: "#F8FAFC", color: "#334155" }} />
                  </div>
                  <div className="flex-1">
                    <label style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", display: "block", marginBottom: "4px" }}>TANGGAL SELESAI PERIODE</label>
                    <input type="date" value={generateEndDate} onChange={(e) => setGenerateEndDate(e.target.value)}
                      style={{ width: "100%", height: "36px", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "0 12px", fontSize: "12px", fontWeight: "600", outline: "none", background: "#F8FAFC", color: "#334155" }} />
                  </div>
                </div>
              </div>

              {/* Tambah Absensi Manual Button */}
              {!showManualAttForm && (
                <button onClick={() => setShowManualAttForm(true)} data-testid="add-manual-att-btn"
                  className="flex items-center gap-2 mb-4 tap-target"
                  style={{ padding: "10px 16px", borderRadius: "12px", background: "#E85D8C", color: "#fff", fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer", boxShadow: "0 4px 10px rgba(232, 93, 140, 0.2)" }}>
                  <Plus size={15} /> Tambah Absensi Karyawan
                </button>
              )}

              {/* Manual Attendance Form */}
              {showManualAttForm && (
                <ManualAttendanceForm 
                  employees={activeEmps} 
                  fetchWithAuth={fetchWithAuth}
                  initialData={manualAttInitialData}
                  onSuccess={() => { 
                    setShowManualAttForm(false); 
                    setManualAttInitialData(null);
                    loadAttendance(); 
                    showSuccess("Absensi manual berhasil ditambahkan"); 
                  }}
                  onCancel={() => {
                    setShowManualAttForm(false);
                    setManualAttInitialData(null);
                  }} 
                />
              )}

              {/* Summary Dashboard Absensi */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", border: "1px solid #F1F5F9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ padding: "6px", background: "#FEE2E2", borderRadius: "8px" }}><AlertTriangle size={14} color="#EF4444" /></div>
                    <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B" }}>MENUNGGU REVIEW</p>
                  </div>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#EF4444", letterSpacing: "-0.5px" }}>
                    {reviewCount} <span style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8" }}>Shift</span>
                  </p>
                </div>
                <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", border: "1px solid #F1F5F9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ padding: "6px", background: "#EFF6FF", borderRadius: "8px" }}><CalendarDays size={14} color="#3B82F6" /></div>
                    <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B" }}>TOTAL SHIFT</p>
                  </div>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.5px" }}>
                    {attendance.length} <span style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8" }}>Shift</span>
                  </p>
                </div>
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
                    <div className="mb-2">
                      <button 
                        onClick={handleBulkApprove} 
                        disabled={reviewingId === "bulk"}
                        className="w-full tap-target"
                        style={{
                          background: "#10B981", 
                          color: "#fff", 
                          padding: "12px", 
                          borderRadius: "12px", 
                          fontSize: "13px", 
                          fontWeight: "700",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)"
                        }}
                      >
                        {reviewingId === "bulk" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        Setujui Semua ({reviewCount})
                      </button>
                    </div>
                    {reviewItems.map(a => (
                      <AttendanceReviewCard key={a.id} a={a} onReview={handleReviewAttendance} reviewingId={reviewingId} />
                    ))}
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
                          <span style={{
                            padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600",
                            background: a.status === "belum_lengkap" ? "#EFF6FF" : "#DCFCE7",
                            color: a.status === "belum_lengkap" ? "#2563EB" : "#16A34A"
                          }}>
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

                        {a.status === "belum_lengkap" && (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                            <button
                              onClick={() => {
                                setManualAttInitialData({
                                  empId: a.employeeId,
                                  date: a.date,
                                  checkInTime: a.checkIn ? new Date(a.checkIn.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : ""
                                });
                                setShowManualAttForm(true);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white tap-target"
                              style={{ background: "#3B82F6", border: "none", cursor: "pointer" }}
                            >
                              + Lengkapi Absen (Manual)
                            </button>
                          </div>
                        )}
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
            {/* Period Date Filter for Payroll */}
            <div style={{ background: "#fff", borderRadius: "16px", padding: "12px 16px", border: "1px solid #F1F5F9" }} className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => { const d = new Date(selectedMonth + "-01"); d.setMonth(d.getMonth() - 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                  style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid #E2E8F0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}>‹</button>
                <p style={{ flex: 1, textAlign: "center", fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>
                  {new Date(selectedMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                </p>
                <button onClick={() => { const d = new Date(selectedMonth + "-01"); d.setMonth(d.getMonth() + 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                  style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid #E2E8F0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}>›</button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <div className="flex-1">
                  <label style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", display: "block", marginBottom: "4px" }}>TANGGAL MULAI PERIODE</label>
                  <input type="date" value={generateStartDate} onChange={(e) => setGenerateStartDate(e.target.value)}
                    style={{ width: "100%", height: "36px", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "0 12px", fontSize: "12px", fontWeight: "600", outline: "none", background: "#F8FAFC", color: "#334155" }} />
                </div>
                <div className="flex-1">
                  <label style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", display: "block", marginBottom: "4px" }}>TANGGAL SELESAI PERIODE</label>
                  <input type="date" value={generateEndDate} onChange={(e) => setGenerateEndDate(e.target.value)}
                    style={{ width: "100%", height: "36px", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "0 12px", fontSize: "12px", fontWeight: "600", outline: "none", background: "#F8FAFC", color: "#334155" }} />
                </div>
              </div>

              {/* Summary Dashboard */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", border: "1px solid #F1F5F9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ padding: "6px", background: "#FEF2F2", borderRadius: "8px" }}><Banknote size={14} color="#EF4444" /></div>
                    <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B" }}>TOTAL BEBAN GAJI</p>
                  </div>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.5px" }}>
                    {fmtRupiah(payrolls.reduce((sum, p) => sum + p.totalPaid, 0))}
                  </p>
                </div>
                <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", border: "1px solid #F1F5F9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ padding: "6px", background: "#EFF6FF", borderRadius: "8px" }}><Users size={14} color="#3B82F6" /></div>
                    <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B" }}>KARYAWAN</p>
                  </div>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.5px" }}>
                    {payrolls.length} <span style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8" }}>Orang</span>
                  </p>
                </div>
                <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", border: "1px solid #F1F5F9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ padding: "6px", background: "#F0FDF4", borderRadius: "8px" }}><Check size={14} color="#22C55E" /></div>
                    <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B" }}>SUDAH DIBAYAR</p>
                  </div>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#22C55E", letterSpacing: "-0.5px" }}>
                    {payrolls.filter(p => p.status === "sudah_dibayar").length}
                  </p>
                </div>
                <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", border: "1px solid #F1F5F9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ padding: "6px", background: "#FEF3C7", borderRadius: "8px" }}><AlertTriangle size={14} color="#D97706" /></div>
                    <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B" }}>BELUM DIBAYAR</p>
                  </div>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#D97706", letterSpacing: "-0.5px" }}>
                    {payrolls.filter(p => p.status === "belum_dibayar").length}
                  </p>
                </div>
              </div>

              {attendance.filter(a => a.status === "direview").length > 0 && (
                <div className="mb-4 p-4 rounded-xl flex items-start gap-3" style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
                  <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "700", color: "#991B1B" }}>Ada {attendance.filter(a => a.status === "direview").length} Absensi Belum Direview!</p>
                    <p style={{ fontSize: "12px", color: "#B91C1C", marginTop: "2px", lineHeight: "1.5" }}>
                      Anda tidak dapat menghitung gaji sebelum semua absensi pada periode ini selesai direview. Silakan kembali ke tab Karyawan dan selesaikan review.
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleGeneratePayroll}
                disabled={generatingPayroll || (attendance.filter(a => a.status === "direview").length > 0)}
                className="tap-target w-full transition-all active:scale-[0.98]"
                style={{
                  padding: "12px 16px",
                  borderRadius: "14px",
                  background: (attendance.filter(a => a.status === "direview").length > 0) ? "#94A3B8" : "#E85D8C",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: "700",
                  border: "none",
                  cursor: (attendance.filter(a => a.status === "direview").length > 0) ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: (attendance.filter(a => a.status === "direview").length > 0) ? "none" : "0 4px 12px rgba(232, 93, 140, 0.3)"
                }}
              >
                {generatingPayroll ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
                Hitung Ulang & Generate Gaji
              </button>
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-brand-50 rounded-xl p-3 mt-3 text-xs">
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

                      {/* Aksi Gaji (Redesigned) */}
                      <div className="flex items-center gap-2 mt-4 pt-4 relative" style={{ borderTop: "1px dashed #E2E8F0" }}>
                        {!isEditing ? (
                          <>
                            <button
                              onClick={() => setExpandedPayrollId(expandedPayrollId === p.id ? null : p.id)}
                              className="tap-target"
                              style={{
                                padding: "8px 12px",
                                borderRadius: "10px",
                                background: expandedPayrollId === p.id ? "#F8FAFC" : "#fff",
                                color: "#475569",
                                border: "1px solid #E2E8F0",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontWeight: "700",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                            >
                              <Clock size={13} />
                              {expandedPayrollId === p.id ? "Tutup Rincian" : "Rincian Shift"}
                            </button>

                            <div className="ml-auto relative">
                              <button
                                onClick={() => setActionMenuId(actionMenuId === p.id ? null : p.id)}
                                className="tap-target"
                                style={{
                                  padding: "8px",
                                  borderRadius: "10px",
                                  background: actionMenuId === p.id ? "#F1F5F9" : "transparent",
                                  color: "#64748B",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <MoreHorizontal size={18} />
                              </button>

                              {/* Kebab Menu Dropdown */}
                              {actionMenuId === p.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)}></div>
                                  <div className="absolute right-0 bottom-full mb-2 w-40 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden" style={{ transformOrigin: "bottom right" }}>
                                    {canPay && (
                                      <button
                                        onClick={() => { handlePayPayroll(p); setActionMenuId(null); }}
                                        disabled={payingId === p.id}
                                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors flex items-center justify-between border-b border-slate-50"
                                      >
                                        Bayar Gaji
                                        {payingId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => { printPayrollSlip(p); setActionMenuId(null); }}
                                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-brand-50 transition-colors border-b border-slate-50"
                                    >
                                      Cetak Slip
                                    </button>
                                    {!p.isLocked && (
                                      <button
                                        onClick={() => {
                                          setEditingPayrollId(p.id);
                                          setEditWorkPeriod(p.workPeriod || "");
                                          setEditWorkDays(String(p.workDays));
                                          setEditDailyWage(String(p.dailyWage));
                                          setEditPerformanceBonus(String(p.performanceBonus));
                                          setEditPerformanceBonusNote(p.performanceBonusNote || "");
                                          setActionMenuId(null);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                                      >
                                        Koreksi Gaji (Manual)
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col gap-3 w-full bg-white p-4 rounded-xl border border-primary/20 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                            <p className="text-xs font-bold text-slate-700">Koreksi Gaji Manual (Override)</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1">PERIODE KERJA</label>
                                <Input type="text" placeholder="Contoh: Juni 2026" value={editWorkPeriod} onChange={(e) => setEditWorkPeriod(e.target.value)} className="h-9 rounded-lg text-xs" />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1">JUMLAH KEHADIRAN (SHIFT)</label>
                                <Input type="number" placeholder="Total kehadiran..." value={editWorkDays} onChange={(e) => setEditWorkDays(e.target.value)} className="h-9 rounded-lg text-xs" />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1">RATE PER SHIFT</label>
                                <Input type="number" placeholder="Rate per shift..." value={editDailyWage} onChange={(e) => setEditDailyWage(e.target.value)} className="h-9 rounded-lg text-xs" />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1">BONUS / INSENTIF</label>
                                <Input type="number" placeholder="Bonus..." value={editPerformanceBonus} onChange={(e) => setEditPerformanceBonus(e.target.value)} className="h-9 rounded-lg text-xs" />
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-400 block mb-1">DETAIL/KETERANGAN BONUS</label>
                              <Input type="text" placeholder="Contoh: Bonus rajin packing & target tercapai..." value={editPerformanceBonusNote} onChange={(e) => setEditPerformanceBonusNote(e.target.value)} className="h-9 rounded-lg text-xs" />
                            </div>

                            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-50">
                              <button onClick={() => setEditingPayrollId(null)} className="tap-target" style={{ padding: "8px 16px", borderRadius: "10px", background: "transparent", color: "#64748B", border: "1px solid #E2E8F0", cursor: "pointer", fontSize: "11px", fontWeight: "700" }}>Batal</button>
                              <button onClick={() => handleSavePayroll(p.id)} disabled={savingBonusId === p.id} className="tap-target" style={{ padding: "8px 16px", borderRadius: "10px", background: "#E85D8C", color: "#fff", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: "700" }} data-testid={`save-bonus-btn-${p.employeeId}`}>
                                {savingBonusId === p.id ? <Loader2 size={11} className="animate-spin" /> : "Simpan Koreksi"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {expandedPayrollId === p.id && (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2 relative">
                          <p className="text-xs font-bold text-slate-700 mb-1">Rincian Shift Karyawan</p>
                          {attendance.filter(a => a.employeeId === p.employeeId).length === 0 ? (
                            <p className="text-xs text-slate-500 italic">Tidak ada shift tercatat pada periode ini.</p>
                          ) : (
                            <>
                              {attendance
                                .filter(a => a.employeeId === p.employeeId)
                                .map(a => (
                                  <AttendanceReviewCard 
                                    key={a.id} 
                                    a={a} 
                                    isCorrectionMode={true}
                                    editData={shiftEdits[a.id]}
                                    onEditChange={(field, val) => handleEditChange(a.id, field, val)}
                                  />
                                ))}

                              {/* Bulk Save Button Overlay */}
                              {Object.keys(shiftEdits).filter(id => attendance.find(a => a.id === id)?.employeeId === p.employeeId).length > 0 && (
                                <div className="sticky bottom-4 mt-2 p-3 bg-white/90 backdrop-blur-sm border border-slate-200 shadow-xl rounded-xl flex items-center justify-between z-10 animate-in slide-in-from-bottom-4">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-700">Perubahan Terdeteksi</span>
                                    <span className="text-xs text-slate-500">{Object.keys(shiftEdits).filter(id => attendance.find(a => a.id === id)?.employeeId === p.employeeId).length} shift diedit belum disimpan</span>
                                  </div>
                                  <button
                                    onClick={() => handleBulkSaveCorrections(p.employeeId)}
                                    disabled={isBulkSaving}
                                    className="flex items-center gap-2 tap-target"
                                    style={{
                                      background: "#E85D8C",
                                      color: "#fff",
                                      padding: "10px 16px",
                                      borderRadius: "10px",
                                      fontSize: "12px",
                                      fontWeight: "700",
                                      border: "none",
                                      cursor: "pointer",
                                      boxShadow: "0 4px 10px rgba(232, 93, 140, 0.3)"
                                    }}
                                  >
                                    {isBulkSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    Simpan {Object.keys(shiftEdits).filter(id => attendance.find(a => a.id === id)?.employeeId === p.employeeId).length} Perubahan
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
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
