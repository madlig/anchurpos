"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, CalendarDays, Check, Search, Lock, Edit3, Save, X, FileText } from "lucide-react";
import { AttendanceRecord, Employee, PayrollRecord } from "../types";
import { AttendanceReviewCard } from "../components/SharedForms";

const fmtDateFull = (dStr: string) => {
  const [y, m, d] = dStr.split("-");
  const mos = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${mos[parseInt(m) - 1]} ${y}`;
};

const fmtRupiah = (num: number) => {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
};

export default function PayrollPage() {
  const { getToken } = useAuth();
  
  // Date states (Default: 26th of prev month to 25th of current month)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [lockedPayrolls, setLockedPayrolls] = useState<PayrollRecord[]>([]);

  const [expandedPayrollId, setExpandedPayrollId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Edit states
  const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null);
  const [editWorkDays, setEditWorkDays] = useState("");
  const [editDailyWage, setEditDailyWage] = useState("");
  const [editPerformanceBonus, setEditPerformanceBonus] = useState("");
  const [editPerformanceBonusNote, setEditPerformanceBonusNote] = useState("");
  const [editDeductions, setEditDeductions] = useState("");
  const [editDeductionNote, setEditDeductionNote] = useState("");

  useEffect(() => {
    if (!selectedMonth) return;
    const [yStr, mStr] = selectedMonth.split("-");
    const year = parseInt(yStr);
    const month = parseInt(mStr);
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }
    
    setStartDate(`${prevYear}-${String(prevMonth).padStart(2, "0")}-26`);
    setEndDate(`${year}-${String(month).padStart(2, "0")}-25`);
  }, [selectedMonth]);

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const [empRes, attRes, payRes] = await Promise.all([
        fetchWithAuth("/api/employees"),
        fetchWithAuth(`/api/attendance?startDate=${startDate}&endDate=${endDate}`),
        fetchWithAuth(`/api/payroll?month=${selectedMonth}`)
      ]);
      
      if (empRes.ok) setEmployees(await empRes.json());
      if (attRes.ok) setAttendance(await attRes.json());
      if (payRes.ok) setLockedPayrolls(await payRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, startDate, endDate, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live Payroll Calculation
  const livePayrolls = useMemo(() => {
    const periodStr = `${fmtDateFull(startDate)} - ${fmtDateFull(endDate)}`;
    
    return employees.filter(e => e.isActive !== false && e.role === "crew").map(emp => {
      const locked = lockedPayrolls.find(p => p.employeeId === emp.id);
      if (locked && locked.isLocked) return locked; // Return locked if exists

      const empAtt = attendance.filter(a => a.employeeId === emp.id);
      const workDays = empAtt.length;
      const dailyWage = emp.dailyWage || 60000;
      const totalRegularPay = workDays * dailyWage;
      const totalOvertimeBonus = empAtt.reduce((sum, a) => sum + (a.overtimeBonus || 0), 0);
      
      const pId = `${selectedMonth}_${emp.id}`;
      // Maintain edit states if currently editing, otherwise use calculated/locked values
      const isEditing = editingPayrollId === pId;
      
      const finalWorkDays = isEditing && editWorkDays !== "" ? Number(editWorkDays) : workDays;
      const finalDailyWage = isEditing && editDailyWage !== "" ? Number(editDailyWage) : dailyWage;
      const finalRegularPay = finalWorkDays * finalDailyWage;
      
      const finalBonus = isEditing && editPerformanceBonus !== "" ? Number(editPerformanceBonus) : (locked?.performanceBonus || 0);
      const finalDeduction = isEditing && editDeductions !== "" ? Number(editDeductions) : (locked?.deductions || 0);
      
      const totalPaid = finalRegularPay + totalOvertimeBonus + finalBonus - finalDeduction;

      return {
        id: pId,
        month: selectedMonth,
        employeeId: emp.id,
        employeeName: emp.name,
        workDays: finalWorkDays,
        dailyWage: finalDailyWage,
        totalRegularPay: finalRegularPay,
        totalOvertimeBonus,
        performanceBonus: finalBonus,
        performanceBonusNote: isEditing ? editPerformanceBonusNote : (locked?.performanceBonusNote || ""),
        deductions: finalDeduction,
        deductionNote: isEditing ? editDeductionNote : (locked?.deductionNote || ""),
        totalPaid,
        isLocked: false,
        workPeriod: periodStr
      } as PayrollRecord;
    });
  }, [employees, attendance, lockedPayrolls, selectedMonth, startDate, endDate, editingPayrollId, editWorkDays, editDailyWage, editPerformanceBonus, editPerformanceBonusNote, editDeductions, editDeductionNote]);

  const handleStartEdit = (p: PayrollRecord) => {
    setEditingPayrollId(p.id);
    setEditWorkDays(String(p.workDays));
    setEditDailyWage(String(p.dailyWage));
    setEditPerformanceBonus(String(p.performanceBonus || 0));
    setEditPerformanceBonusNote(p.performanceBonusNote || "");
    setEditDeductions(String(p.deductions || 0));
    setEditDeductionNote(p.deductionNote || "");
  };

  const handleSaveEdit = async (p: PayrollRecord) => {
    setEditingPayrollId(null); // Just saves it to the local live calc. Will be persisted when locked.
  };

  const handlePay = async (p: PayrollRecord) => {
    if (!confirm(`Tandai gaji ${p.employeeName} sudah dibayar? Data ini akan dikunci dan slip gaji digital akan diterbitkan.`)) return;
    setPayingId(p.id);
    try {
      const res = await fetchWithAuth(`/api/payroll/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...p,
          isLocked: true,
          lockedAt: new Date().toISOString()
        })
      });
      if (res.ok) {
        loadData();
      } else {
        alert("Gagal mengunci gaji");
      }
    } catch (e) {
      alert("Error jaringan");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: "900", color: "#1E293B" }}>Sistem Penggajian</h2>
          <p style={{ fontSize: "13px", color: "#64748B", fontWeight: "600" }}>Kalkulasi gaji real-time berdasarkan absensi berjalan.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "13px", fontWeight: "700", color: "#334155", outline: "none" }} />
        </div>
      </div>

      <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "14px", border: "1px dashed #CBD5E1", marginBottom: "20px" }}>
        <p style={{ fontSize: "11px", fontWeight: "800", color: "#64748B", marginBottom: "8px" }}>TENTUKAN RENTANG TANGGAL GAJI (DEFAULT 26 S/D 25)</p>
        <div className="flex gap-3 items-center">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px" }} />
          <span className="font-bold text-slate-400">s/d</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px" }} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : livePayrolls.length === 0 ? (
        <div className="text-center py-10 text-slate-500 font-bold">Tidak ada karyawan aktif untuk dihitung gajinya.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {livePayrolls.map(p => {
            const isEditing = editingPayrollId === p.id;
            const empAtt = attendance.filter(a => a.employeeId === p.employeeId);
            const isExpanded = expandedPayrollId === p.id;

            return (
              <div key={p.id} style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", border: p.isLocked ? "2px solid #10B981" : "1px solid #E2E8F0", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#1C1C1E" }}>{p.employeeName}</h3>
                      <p style={{ fontSize: "12px", color: "#64748B", fontWeight: "600", marginTop: "2px" }}>Periode: {p.workPeriod}</p>
                    </div>
                    <div className="text-right">
                      {p.isLocked ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#D1FAE5", color: "#065F46", padding: "4px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "800" }}>
                          <Lock size={12} /> DIBAYAR & DIKUNCI
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#FEF3C7", color: "#D97706", padding: "4px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "800" }}>
                          LIVE CALCULATION
                        </span>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">TOTAL HARI KERJA</label>
                          <input type="number" value={editWorkDays} onChange={e => setEditWorkDays(e.target.value)} className="w-full h-9 rounded-lg border border-slate-300 px-3 font-bold text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">TARIF GAJI / HARI (Rp)</label>
                          <input type="number" value={editDailyWage} onChange={e => setEditDailyWage(e.target.value)} className="w-full h-9 rounded-lg border border-slate-300 px-3 font-bold text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">TAMBAHAN BONUS (Rp)</label>
                          <input type="number" value={editPerformanceBonus} onChange={e => setEditPerformanceBonus(e.target.value)} className="w-full h-9 rounded-lg border border-slate-300 px-3 font-bold text-xs text-emerald-700" />
                          <input type="text" placeholder="Keterangan Bonus..." value={editPerformanceBonusNote} onChange={e => setEditPerformanceBonusNote(e.target.value)} className="w-full h-8 mt-1 rounded-lg border border-slate-300 px-3 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">POTONGAN / DEDUCTIONS (Rp)</label>
                          <input type="number" value={editDeductions} onChange={e => setEditDeductions(e.target.value)} className="w-full h-9 rounded-lg border border-slate-300 px-3 font-bold text-xs text-red-600" />
                          <input type="text" placeholder="Keterangan Potongan..." value={editDeductionNote} onChange={e => setEditDeductionNote(e.target.value)} className="w-full h-8 mt-1 rounded-lg border border-slate-300 px-3 text-xs" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingPayrollId(null)} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 border border-slate-300">Batal</button>
                        <button onClick={() => handleSaveEdit(p)} className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white">Terapkan Perubahan</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                      <div className="bg-slate-50 p-2 rounded-lg text-center">
                        <p style={{ fontSize: "10px", color: "#64748B", fontWeight: "700" }}>GAJI POKOK ({p.workDays} Hari)</p>
                        <p style={{ fontSize: "14px", fontWeight: "900", color: "#334155" }}>{fmtRupiah(p.totalRegularPay)}</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg text-center">
                        <p style={{ fontSize: "10px", color: "#64748B", fontWeight: "700" }}>LEMBUR</p>
                        <p style={{ fontSize: "14px", fontWeight: "900", color: "#334155" }}>{fmtRupiah(p.totalOvertimeBonus)}</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-center">
                        <p style={{ fontSize: "10px", color: "#065F46", fontWeight: "700" }}>BONUS</p>
                        <p style={{ fontSize: "14px", fontWeight: "900", color: "#059669" }}>{fmtRupiah(p.performanceBonus || 0)}</p>
                        {p.performanceBonusNote && <p className="text-[9px] text-emerald-600 truncate mt-1">{p.performanceBonusNote}</p>}
                      </div>
                      <div className="bg-red-50 border border-red-100 p-2 rounded-lg text-center">
                        <p style={{ fontSize: "10px", color: "#991B1B", fontWeight: "700" }}>POTONGAN</p>
                        <p style={{ fontSize: "14px", fontWeight: "900", color: "#DC2626" }}>-{fmtRupiah(p.deductions || 0)}</p>
                        {p.deductionNote && <p className="text-[9px] text-red-600 truncate mt-1">{p.deductionNote}</p>}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                    <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B" }}>TOTAL DITERIMA:</p>
                    <p style={{ fontSize: "20px", fontWeight: "900", color: p.isLocked ? "#10B981" : "#1E293B" }}>
                      {fmtRupiah(p.totalPaid)}
                    </p>
                  </div>
                </div>

                <div className="flex border-t border-slate-100 bg-slate-50">
                  <button onClick={() => setExpandedPayrollId(isExpanded ? null : p.id)} className="flex-1 py-3 text-xs font-bold text-slate-600 flex justify-center items-center gap-2 border-r border-slate-100 hover:bg-slate-100 transition-colors">
                    <FileText size={14} /> {isExpanded ? "Tutup Rincian" : "Rincian Shift"}
                  </button>
                  {!p.isLocked && (
                    <>
                      <button onClick={() => handleStartEdit(p)} className="px-4 py-3 text-xs font-bold text-blue-600 flex justify-center items-center gap-2 border-r border-slate-100 hover:bg-slate-100 transition-colors">
                        <Edit3 size={14} /> Koreksi
                      </button>
                      <button onClick={() => handlePay(p)} disabled={payingId === p.id} className="flex-1 py-3 text-xs font-bold text-emerald-700 bg-emerald-100/50 hover:bg-emerald-100 flex justify-center items-center gap-2 transition-colors">
                        {payingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Bayar & Kunci
                      </button>
                    </>
                  )}
                </div>

                {isExpanded && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-500 mb-3">RINCIAN {empAtt.length} SHIFT KERJA</p>
                    {empAtt.length === 0 ? (
                      <p className="text-xs text-slate-400">Tidak ada kehadiran.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {empAtt.map(a => (
                          <AttendanceReviewCard key={a.id} a={a} dailyWage={p.dailyWage} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
