"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, CalendarDays, Check, Search, Lock, Edit3, Save, X, FileText, LayoutList, Wallet, Settings2, ChevronDown, CheckCircle2 } from "lucide-react";
import { AttendanceRecord, Employee, PayrollRecord } from "../types";
import { AdaptivePanel } from "@/components/shared/AdaptivePanel";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";

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
  const { alert, confirm } = useAlertConfirm();
  
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
  const [isPayingAll, setIsPayingAll] = useState(false);

  // Edit states for Bottom Sheet
  const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null);
  const [editedPayrolls, setEditedPayrolls] = useState<Record<string, Partial<PayrollRecord>>>({});
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
      const totalOvertimeBonus = empAtt.reduce((sum, a) => sum + (a.overtimeBonus || 0), 0);
      
      const pId = `${selectedMonth}_${emp.id}`;
      const overrides = editedPayrolls[pId];
      const isEditing = editingPayrollId === pId;
      
      const finalWorkDays = isEditing && editWorkDays !== "" ? Number(editWorkDays) : (overrides?.workDays ?? workDays);
      const finalDailyWage = isEditing && editDailyWage !== "" ? Number(editDailyWage) : (overrides?.dailyWage ?? dailyWage);
      const finalRegularPay = finalWorkDays * finalDailyWage;
      
      const finalBonus = isEditing && editPerformanceBonus !== "" ? Number(editPerformanceBonus) : (overrides?.performanceBonus ?? (locked?.performanceBonus || 0));
      const finalDeduction = isEditing && editDeductions !== "" ? Number(editDeductions) : (overrides?.deductions ?? (locked?.deductions || 0));
      
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
        performanceBonusNote: isEditing ? editPerformanceBonusNote : (overrides?.performanceBonusNote ?? (locked?.performanceBonusNote || "")),
        deductions: finalDeduction,
        deductionNote: isEditing ? editDeductionNote : (overrides?.deductionNote ?? (locked?.deductionNote || "")),
        totalPaid,
        isLocked: false,
        workPeriod: periodStr
      } as PayrollRecord;
    });
  }, [employees, attendance, lockedPayrolls, selectedMonth, startDate, endDate, editingPayrollId, editedPayrolls, editWorkDays, editDailyWage, editPerformanceBonus, editPerformanceBonusNote, editDeductions, editDeductionNote]);

  const handleStartEdit = (p: PayrollRecord) => {
    setEditingPayrollId(p.id);
    setEditWorkDays(String(p.workDays));
    setEditDailyWage(String(p.dailyWage));
    setEditPerformanceBonus(String(p.performanceBonus || 0));
    setEditPerformanceBonusNote(p.performanceBonusNote || "");
    setEditDeductions(String(p.deductions || 0));
    setEditDeductionNote(p.deductionNote || "");
  };

  const handleSaveEdit = async () => {
    if (editingPayrollId) {
      setEditedPayrolls(prev => ({
        ...prev,
        [editingPayrollId]: {
          workDays: Number(editWorkDays),
          dailyWage: Number(editDailyWage),
          performanceBonus: Number(editPerformanceBonus),
          performanceBonusNote: editPerformanceBonusNote,
          deductions: Number(editDeductions),
          deductionNote: editDeductionNote,
        }
      }));
    }
    setEditingPayrollId(null); 
  };

  const handlePay = async (p: PayrollRecord) => {
    if (!(await confirm("Kunci Data?", `Tandai gaji ${p.employeeName} sudah dibayar? Data ini akan dikunci.`))) return;
    setPayingId(p.id);
    try {
      const res = await fetchWithAuth(`/api/payroll/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...p, isLocked: true, lockedAt: new Date().toISOString() })
      });
      if (res.ok) loadData();
      else alert("Gagal mengunci gaji");
    } catch (e) {
      alert("Error jaringan");
    } finally {
      setPayingId(null);
    }
  };

  const handlePayAll = async () => {
    const unlocked = livePayrolls.filter(p => !p.isLocked);
    if (unlocked.length === 0) return;
    
    if (!(await confirm("Kunci Semua?", `Terdapat ${unlocked.length} gaji karyawan yang belum dikunci.\n\nApakah Anda yakin sudah mengecek semua bonus dan potongan? Tindakan ini akan mengunci seluruh gaji secara bersamaan.`))) return;
    
    setIsPayingAll(true);
    try {
      const promises = unlocked.map(p => 
        fetchWithAuth(`/api/payroll/${p.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...p, isLocked: true, lockedAt: new Date().toISOString() })
        })
      );
      await Promise.all(promises);
      await loadData();
    } catch (e) {
      alert("Beberapa gaji gagal dikunci. Silakan coba lagi.");
    } finally {
      setIsPayingAll(false);
    }
  };

  const unlockedCount = livePayrolls.filter(p => !p.isLocked).length;

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

      {/* Fitur Bayar Semua Karyawan (Batch Action) */}
      {!loading && unlockedCount > 0 && (
        <div className="mb-6 p-4 rounded-[16px] bg-emerald-50 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-emerald-900 font-bold text-sm">Ada {unlockedCount} gaji yang belum dibayar</h3>
            <p className="text-emerald-700 text-xs mt-1">Pastikan Anda sudah mengecek semua potongan atau bonus sebelum membayar sekaligus.</p>
          </div>
          <button 
            onClick={handlePayAll}
            disabled={isPayingAll}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-sm shadow-emerald-200 tap-target"
          >
            {isPayingAll ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
            Bayar & Kunci Semua
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : livePayrolls.length === 0 ? (
        <div className="text-center py-10 text-slate-500 font-bold">Tidak ada karyawan aktif untuk dihitung gajinya.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {livePayrolls.map(p => {
            const empAtt = attendance.filter(a => a.employeeId === p.employeeId);
            const isExpanded = expandedPayrollId === p.id;

            return (
              <div key={p.id} style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", border: p.isLocked ? "2px solid #10B981" : "1px solid #E2E8F0", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
                <div className="p-4 md:p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "900", color: "#1C1C1E" }}>{p.employeeName}</h3>
                      <p style={{ fontSize: "11px", color: "#64748B", fontWeight: "600", marginTop: "2px", background: "#F1F5F9", padding: "2px 8px", borderRadius: "100px", display: "inline-block" }}>
                        Periode: {p.workPeriod}
                      </p>
                    </div>
                    <div>
                      {p.isLocked ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#D1FAE5", color: "#065F46", padding: "4px 8px", borderRadius: "100px", fontSize: "10px", fontWeight: "800" }}>
                          <CheckCircle2 size={12} /> DIKUNCI
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#FEF3C7", color: "#D97706", padding: "4px 8px", borderRadius: "100px", fontSize: "10px", fontWeight: "800" }}>
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Compact Breakdown (Mobile First) */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-semibold">Gaji Pokok ({p.workDays} hr)</span>
                      <span className="text-slate-700 font-bold">{fmtRupiah(p.totalRegularPay)}</span>
                    </div>
                    {(p.totalOvertimeBonus > 0 || p.performanceBonus > 0) && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-emerald-600 font-semibold">Lembur + Bonus</span>
                        <span className="text-emerald-700 font-bold">+{fmtRupiah(p.totalOvertimeBonus + p.performanceBonus)}</span>
                      </div>
                    )}
                    {(p.deductions || 0) > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-red-600 font-semibold">Potongan / Kasbon</span>
                        <span className="text-red-700 font-bold">-{fmtRupiah(p.deductions || 0)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between pt-1 gap-2">
                    <p style={{ fontSize: "12px", fontWeight: "800", color: "#94A3B8", letterSpacing: "0.5px" }}>TOTAL DITERIMA</p>
                    <p style={{ fontSize: "28px", fontWeight: "900", color: p.isLocked ? "#10B981" : "#1E293B", lineHeight: "1" }}>
                      {fmtRupiah(p.totalPaid)}
                    </p>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex border-t border-slate-100 bg-slate-50">
                  <button onClick={() => setExpandedPayrollId(isExpanded ? null : p.id)} className="flex-1 py-3.5 text-xs font-bold text-slate-600 flex justify-center items-center gap-2 border-r border-slate-200 hover:bg-slate-200 transition-colors tap-target">
                    {isExpanded ? <ChevronDown size={14} className="rotate-180" /> : <LayoutList size={14} />} 
                    {isExpanded ? "Tutup Rincian" : "Rincian"}
                  </button>
                  {!p.isLocked && (
                    <>
                      <button onClick={() => handleStartEdit(p)} className="flex-1 py-3.5 text-xs font-bold text-blue-600 flex justify-center items-center gap-2 border-r border-slate-200 hover:bg-slate-200 transition-colors tap-target">
                        <Settings2 size={14} /> Koreksi
                      </button>
                      <button onClick={() => handlePay(p)} disabled={payingId === p.id} className="flex-1 py-3.5 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 flex justify-center items-center gap-2 transition-colors tap-target">
                        {payingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Kunci
                      </button>
                    </>
                  )}
                </div>

                {/* Compact Rincian Shift List */}
                {isExpanded && (
                  <div className="p-4 bg-white border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wide">Rincian {empAtt.length} Shift Kerja</p>
                    {empAtt.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Tidak ada kehadiran.</p>
                    ) : (
                      <div className="flex flex-col gap-0 border border-slate-100 rounded-xl overflow-hidden">
                        {empAtt.map((a, i) => (
                          <div key={a.id} className={`flex justify-between items-center p-3 ${i !== empAtt.length - 1 ? 'border-b border-slate-100' : ''}`}>
                            <div>
                              <p className="text-xs font-bold text-slate-700">{fmtDateFull(a.date)}</p>
                              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                Masuk: {a.checkIn ? new Date(a.checkIn.time).toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'}) : "-"}
                                {a.flaggedReason && <span className="text-red-500 ml-1">(! {a.flaggedReason})</span>}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-800">{a.totalHours} Jam</p>
                              {a.overtimeBonus ? (
                                <p className="text-[10px] font-bold text-emerald-600">Lembur: {fmtRupiah(a.overtimeBonus)}</p>
                              ) : null}
                            </div>
                          </div>
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

      {/* Adaptive Panel for Edit/Koreksi */}
      <AdaptivePanel 
        isOpen={editingPayrollId !== null} 
        onClose={() => setEditingPayrollId(null)}
        title="Koreksi Penggajian"
        icon={<Settings2 size={18} />}
      >
        <div className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">TOTAL HARI KERJA</label>
              <input type="number" value={editWorkDays} onChange={e => setEditWorkDays(e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 font-bold text-sm bg-slate-50" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">TARIF GAJI / HARI (Rp)</label>
              <input type="number" value={editDailyWage} onChange={e => setEditDailyWage(e.target.value)} className="w-full h-10 rounded-lg border border-slate-300 px-3 font-bold text-sm bg-slate-50" />
            </div>
          </div>
          
          <div className="pt-2 border-t border-slate-100">
            <label className="text-[10px] font-bold text-emerald-600 block mb-1">TAMBAHAN BONUS PERFORMA (Rp)</label>
            <input type="number" value={editPerformanceBonus} onChange={e => setEditPerformanceBonus(e.target.value)} className="w-full h-10 rounded-lg border border-emerald-300 px-3 font-bold text-sm text-emerald-700 bg-emerald-50 mb-2" />
            <input type="text" placeholder="Catatan bonus (Opsional)..." value={editPerformanceBonusNote} onChange={e => setEditPerformanceBonusNote(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs" />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="text-[10px] font-bold text-red-600 block mb-1">POTONGAN / KASBON (Rp)</label>
            <input type="number" value={editDeductions} onChange={e => setEditDeductions(e.target.value)} className="w-full h-10 rounded-lg border border-red-300 px-3 font-bold text-sm text-red-700 bg-red-50 mb-2" />
            <input type="text" placeholder="Catatan potongan (Opsional)..." value={editDeductionNote} onChange={e => setEditDeductionNote(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs" />
          </div>

          <div className="pt-6">
            <button onClick={handleSaveEdit} className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-lg shadow-slate-200 tap-target">
              Terapkan Perubahan
            </button>
            <button onClick={() => setEditingPayrollId(null)} className="w-full h-12 mt-2 rounded-xl text-slate-500 font-bold text-sm tap-target">
              Batal
            </button>
          </div>
        </div>
      </AdaptivePanel>
    </div>
  );
}
