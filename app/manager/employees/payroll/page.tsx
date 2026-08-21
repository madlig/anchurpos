"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { Loader2, CalendarDays, Check, Search, Lock, Edit3, Save, X, FileText, LayoutList, Wallet, Settings2, ChevronDown, CheckCircle2, TrendingUp, Users, AlertTriangle } from "lucide-react";
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
  
  // Date states (Default: 29th of prev month to 28th of current month)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [lockedPayrolls, setLockedPayrolls] = useState<PayrollRecord[]>([]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

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
    
    const sd = new Date(prevYear, prevMonth - 1, 29);
    const sYear = sd.getFullYear();
    const sMonth = String(sd.getMonth() + 1).padStart(2, "0");
    const sDate = String(sd.getDate()).padStart(2, "0");
    
    const ed = new Date(year, month - 1, 28);
    const eYear = ed.getFullYear();
    const eMonth = String(ed.getMonth() + 1).padStart(2, "0");
    const eDate = String(ed.getDate()).padStart(2, "0");
    
    setStartDate(`${sYear}-${sMonth}-${sDate}`);
    setEndDate(`${eYear}-${eMonth}-${eDate}`);
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
    
    return employees
      .filter(e => e.isActive !== false && e.role === "crew")
      .map(emp => {
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

  const filteredPayrolls = useMemo(() => {
    return livePayrolls.filter(p => p.employeeName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [livePayrolls, searchQuery]);

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
  const totalPayrollValue = livePayrolls.reduce((sum, p) => sum + p.totalPaid, 0);
  const totalLockedValue = livePayrolls.filter(p => p.isLocked).reduce((sum, p) => sum + p.totalPaid, 0);

  return (
    <div className="animate-in fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Sistem Penggajian</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Kalkulasi gaji real-time berdasarkan absensi berjalan.</p>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)} 
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 mb-1 tracking-wide">ESTIMASI TOTAL GAJI</p>
            <h3 className="text-2xl font-black text-slate-800">{fmtRupiah(totalPayrollValue)}</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">
              Terkunci: <span className="text-emerald-600">{fmtRupiah(totalLockedValue)}</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
            <TrendingUp className="text-slate-400" size={24} />
          </div>
        </div>
        
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-center">
          <p className="text-[10px] font-extrabold text-slate-400 mb-2 tracking-wide">RENTANG TANGGAL (29 S/D 28)</p>
          <div className="flex gap-2 items-center">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white shadow-sm" />
            <span className="font-bold text-slate-400 text-xs">s/d</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white shadow-sm" />
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Cari nama karyawan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
        />
      </div>

      {/* Fitur Bayar Semua Karyawan (Batch Action) */}
      {!loading && unlockedCount > 0 && !searchQuery && (
        <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div>
            <h3 className="text-emerald-900 font-extrabold text-sm flex items-center gap-2">
              <AlertTriangle size={16} className="text-emerald-600" /> 
              Ada {unlockedCount} gaji yang belum dibayar
            </h3>
            <p className="text-emerald-700/80 text-xs mt-1.5 font-semibold">Pastikan Anda sudah mengecek semua potongan atau bonus sebelum membayar sekaligus.</p>
          </div>
          <button 
            onClick={handlePayAll}
            disabled={isPayingAll}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md shadow-emerald-200/50 tap-target"
          >
            {isPayingAll ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
            Bayar & Kunci Semua
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : filteredPayrolls.length === 0 ? (
        <div className="bg-white rounded-2xl py-12 px-6 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
            <Users className="text-slate-400" size={24} />
          </div>
          <p className="text-sm font-bold text-slate-700">Tidak ada data gaji</p>
          <p className="text-xs text-slate-500 mt-1">Belum ada data gaji yang cocok dengan filter atau karyawan aktif.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {filteredPayrolls.map(p => {
            const empAtt = attendance.filter(a => a.employeeId === p.employeeId);
            const isExpanded = expandedPayrollId === p.id;

            return (
              <div key={p.id} className={`bg-white rounded-2xl overflow-hidden transition-all shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-md ${p.isLocked ? "border-2 border-emerald-400" : "border border-slate-200"}`}>
                <div className="p-4 md:p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight">{p.employeeName}</h3>
                      <p className="text-[10px] text-slate-500 font-bold mt-1 bg-slate-100 px-2.5 py-0.5 rounded-full inline-block">
                        Periode: {p.workPeriod}
                      </p>
                    </div>
                    <div>
                      {p.isLocked ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border border-emerald-200">
                          <CheckCircle2 size={12} /> DIKUNCI
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border border-amber-200">
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Compact Breakdown (Mobile First) */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 mb-4 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold">Gaji Pokok ({p.workDays} hr)</span>
                      <span className="text-slate-800 font-black">{fmtRupiah(p.totalRegularPay)}</span>
                    </div>
                    {(p.totalOvertimeBonus > 0 || p.performanceBonus > 0) && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-emerald-600 font-bold flex items-center gap-1">Lembur + Bonus</span>
                        <span className="text-emerald-700 font-black">+{fmtRupiah(p.totalOvertimeBonus + p.performanceBonus)}</span>
                      </div>
                    )}
                    {(p.deductions || 0) > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-rose-600 font-bold">Potongan / Kasbon</span>
                        <span className="text-rose-700 font-black">-{fmtRupiah(p.deductions || 0)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between pt-1 gap-2">
                    <p className="text-[11px] font-extrabold text-slate-400 tracking-wide">TOTAL DITERIMA</p>
                    <p className={`text-3xl font-black tracking-tight leading-none ${p.isLocked ? "text-emerald-600" : "text-slate-800"}`}>
                      {fmtRupiah(p.totalPaid)}
                    </p>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex border-t border-slate-100 bg-slate-50/50">
                  <button onClick={() => setExpandedPayrollId(isExpanded ? null : p.id)} className="flex-1 py-4 text-[11px] font-bold text-slate-600 flex justify-center items-center gap-2 border-r border-slate-100 hover:bg-slate-100 transition-colors tap-target">
                    {isExpanded ? <ChevronDown size={14} className="rotate-180" /> : <LayoutList size={14} />} 
                    {isExpanded ? "Tutup Rincian" : "Rincian"}
                  </button>
                  {!p.isLocked && (
                    <>
                      <button onClick={() => handleStartEdit(p)} className="flex-1 py-4 text-[11px] font-bold text-blue-600 flex justify-center items-center gap-2 border-r border-slate-100 hover:bg-blue-50 transition-colors tap-target">
                        <Settings2 size={14} /> Koreksi
                      </button>
                      <button onClick={() => handlePay(p)} disabled={payingId === p.id} className="flex-1 py-4 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex justify-center items-center gap-2 transition-colors tap-target">
                        {payingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Kunci
                      </button>
                    </>
                  )}
                </div>

                {/* Compact Rincian Shift List */}
                {isExpanded && (
                  <div className="p-4 bg-white border-t border-slate-100 animate-in slide-in-from-top-2">
                    <p className="text-[10px] font-extrabold text-slate-400 mb-3 tracking-wide">RINCIAN {empAtt.length} SHIFT KERJA</p>
                    {empAtt.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Tidak ada kehadiran.</p>
                    ) : (
                      <div className="flex flex-col gap-0 border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                        {empAtt.map((a, i) => (
                          <div key={a.id} className={`flex justify-between items-center p-3.5 bg-slate-50/30 ${i !== empAtt.length - 1 ? 'border-b border-slate-100' : ''}`}>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{fmtDateFull(a.date)}</p>
                              <p className="text-[10px] text-slate-500 font-semibold mt-1">
                                Masuk: {a.checkIn ? new Date(a.checkIn.time).toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'}) : "-"}
                                {a.flaggedReason && <span className="text-rose-500 ml-1">(! {a.flaggedReason})</span>}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black text-slate-800">{a.totalHours} Jam</p>
                              {a.overtimeBonus ? (
                                <p className="text-[10px] font-bold text-emerald-600 mt-1">Lembur: {fmtRupiah(a.overtimeBonus)}</p>
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
        <div className="p-4 md:p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 block mb-1.5 tracking-wide">TOTAL HARI KERJA</label>
              <input type="number" value={editWorkDays} onChange={e => setEditWorkDays(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 px-3 font-bold text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 block mb-1.5 tracking-wide">TARIF GAJI / HARI (Rp)</label>
              <input type="number" value={editDailyWage} onChange={e => setEditDailyWage(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 px-3 font-bold text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          
          <div className="pt-3 border-t border-slate-100">
            <label className="text-[10px] font-extrabold text-emerald-600 block mb-1.5 tracking-wide">TAMBAHAN BONUS PERFORMA (Rp)</label>
            <input type="number" value={editPerformanceBonus} onChange={e => setEditPerformanceBonus(e.target.value)} className="w-full h-11 rounded-xl border border-emerald-200 px-3 font-bold text-sm text-emerald-800 bg-emerald-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 mb-3" />
            <input type="text" placeholder="Catatan bonus (Opsional)..." value={editPerformanceBonusNote} onChange={e => setEditPerformanceBonusNote(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>

          <div className="pt-3 border-t border-slate-100">
            <label className="text-[10px] font-extrabold text-rose-600 block mb-1.5 tracking-wide">POTONGAN / KASBON (Rp)</label>
            <input type="number" value={editDeductions} onChange={e => setEditDeductions(e.target.value)} className="w-full h-11 rounded-xl border border-rose-200 px-3 font-bold text-sm text-rose-800 bg-rose-50 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 mb-3" />
            <input type="text" placeholder="Catatan potongan (Opsional)..." value={editDeductionNote} onChange={e => setEditDeductionNote(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>

          <div className="pt-6">
            <button onClick={handleSaveEdit} className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-md tap-target hover:bg-slate-800 transition-colors">
              Terapkan Perubahan
            </button>
            <button onClick={() => setEditingPayrollId(null)} className="w-full h-12 mt-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm tap-target hover:bg-slate-50 transition-colors">
              Batal
            </button>
          </div>
        </div>
      </AdaptivePanel>
    </div>
  );
}
