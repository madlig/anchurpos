"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  ReceiptText, 
  ShieldCheck, 
  Printer, 
  Eye, 
  CalendarDays, 
  ChevronDown, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Sparkles
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { AttendanceRecord, PayrollRecord } from "../../manager/employees/types";
import { SalarySlipDocument, formatSlipWorkPeriod } from "@/components/shared/SalarySlipDocument";

const fmtRupiah = (num: number) => {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
};

const formatShiftDate = (dStr: string) => {
  try {
    const [y, m, d] = dStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    return `${days[dateObj.getDay()]}, ${d} ${months[m - 1]} ${y}`;
  } catch {
    return dStr;
  }
};

const formatTimeOnly = (isoString?: string | null) => {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "-";
  }
};

const getCutoffDates = (monthStr: string) => {
  const [yStr, mStr] = monthStr.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  const sd = new Date(prevYear, prevMonth - 1, 29);
  const sYear = sd.getFullYear();
  const sMonth = String(sd.getMonth() + 1).padStart(2, "0");
  const sDate = String(sd.getDate()).padStart(2, "0");

  const ed = new Date(year, month - 1, 28);
  const eYear = ed.getFullYear();
  const eMonth = String(ed.getMonth() + 1).padStart(2, "0");
  const eDate = String(ed.getDate()).padStart(2, "0");

  return {
    startDate: `${sYear}-${sMonth}-${sDate}`,
    endDate: `${eYear}-${eMonth}-${eDate}`,
  };
};

export default function CrewPayrollPage() {
  const { getToken } = useAuth();
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [loading, setLoading] = useState(true);
  const [payroll, setPayroll] = useState<PayrollRecord | null>(null);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [showAttendanceDetails, setShowAttendanceDetails] = useState(false);
  const [showFullSlip, setShowFullSlip] = useState(false);

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPayroll(null);
    setAttendances([]);
    try {
      const { startDate, endDate } = getCutoffDates(selectedMonth);
      const [payRes, attRes] = await Promise.all([
        fetchWithAuth(`/api/payroll?month=${selectedMonth}`),
        fetchWithAuth(`/api/attendance?startDate=${startDate}&endDate=${endDate}`),
      ]);

      if (payRes.ok) {
        const data: PayrollRecord[] = await payRes.json();
        if (data.length > 0) {
          setPayroll({
            ...data[0],
            workPeriod: formatSlipWorkPeriod(data[0].workPeriod, data[0].month),
          });
        }
      }

      if (attRes.ok) {
        const attData: AttendanceRecord[] = await attRes.json();
        setAttendances(attData);
      }
    } catch (e) {
      console.error("Crew loadData error:", e);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set document title untuk print PDF
  useEffect(() => {
    if (payroll) {
      const cleanName = (payroll.employeeName || "Crew").replace(/[^a-zA-Z0-9]/g, "_");
      document.title = `Slip_Gaji_${payroll.month}_${cleanName}`;
    }
  }, [payroll]);

  const validAttendances = useMemo(() => {
    return attendances.filter((a) => (a.totalHours || 0) > 0);
  }, [attendances]);

  const totalShiftHours = useMemo(() => {
    return attendances.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
  }, [attendances]);

  const handlePrint = () => {
    if (!payroll) return;
    const slipUrl = `/crew/payroll/slip?month=${encodeURIComponent(payroll.month)}&autoPrint=true`;
    window.open(slipUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-50/80 pb-28 px-4 pt-4 max-w-2xl mx-auto space-y-4 page-enter">
      {/* ── HEADER HALAMAN (SCREEN ONLY) ── */}
      <div className="no-print bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
            <ReceiptText size={22} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800">Slip Gaji Crew</h1>
            <p className="text-xs font-semibold text-slate-400">Rincian upah & slip resmi transparan</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* ── SELECTOR BULAN (SCREEN ONLY) ── */}
        <div className="no-print bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
          <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider">
            Pilih Bulan Penggajian
          </label>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)} 
            className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        {loading ? (
          <div className="no-print space-y-4">
            <Skeleton className="h-96 w-full rounded-3xl" />
          </div>
        ) : !payroll ? (
          <div className="no-print bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-sm space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-2">
              <ReceiptText size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-black text-slate-700">Belum ada slip gaji</p>
            <p className="text-[11px] font-semibold text-slate-400 max-w-[250px] mx-auto leading-relaxed">
              Gaji bulan ini mungkin belum di-generate atau belum dikunci resmi oleh manager.
            </p>
          </div>
        ) : (
          <>
            {/* ── CARD SUMMARY UNTUK MOBILE SCREEN (TIDAK TERCETAK) ── */}
            <div className="no-print bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-lg shadow-slate-200/50 animate-in slide-in-from-bottom-4">
              <div className="bg-slate-900 p-6 text-center relative text-white">
                <ShieldCheck size={36} className="mx-auto mb-2 text-emerald-400" />
                <h2 className="text-base font-black tracking-widest uppercase">Slip Gaji Resmi</h2>
                <p className="text-xs font-semibold text-slate-300 mt-1">Periode: {formatSlipWorkPeriod(payroll.workPeriod, payroll.month)}</p>
                <div className="mt-2 inline-block">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {payroll.isLocked ? "SUDAH DIBAYAR" : "DRAFT BERJALAN"}
                  </span>
                </div>
              </div>
              
              <div className="p-5 md:p-6">
                <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Nama Crew</p>
                    <p className="text-sm font-black text-slate-800">{payroll.employeeName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Bulan</p>
                    <p className="text-sm font-black text-slate-800">{payroll.month}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mb-5">
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-700">Gaji Pokok ({payroll.workDays} shift)</p>
                      <p className="text-[10px] text-slate-400">@ {fmtRupiah(payroll.dailyWage || 60000)} / shift</p>
                    </div>
                    <p className="font-black text-slate-800">{fmtRupiah(payroll.totalRegularPay)}</p>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <p className="font-bold text-slate-700">Bonus Lemburan</p>
                    <p className="font-black text-slate-800">{fmtRupiah(payroll.totalOvertimeBonus)}</p>
                  </div>
                  {payroll.performanceBonus > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-emerald-700">Bonus Performa</p>
                        {payroll.performanceBonusNote && <p className="text-[10px] text-emerald-600">Ket: {payroll.performanceBonusNote}</p>}
                      </div>
                      <p className="font-black text-emerald-700">+{fmtRupiah(payroll.performanceBonus)}</p>
                    </div>
                  )}
                  {(payroll.deductions || 0) > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-rose-600">Potongan / Kasbon</p>
                        {payroll.deductionNote && <p className="text-[10px] text-rose-500">Ket: {payroll.deductionNote}</p>}
                      </div>
                      <p className="font-black text-rose-600">-{fmtRupiah(payroll.deductions || 0)}</p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Total Diterima (Take Home Pay)</p>
                  <p className="text-2xl font-black text-slate-900">{fmtRupiah(payroll.totalPaid)}</p>
                </div>

                {/* ── RINCIAN KEHADIRAN (ACCORDION VALIDASI SHIFT CREW) ── */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAttendanceDetails(prev => !prev)}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/70 hover:bg-indigo-50 border border-indigo-100/80 transition-all cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <CalendarDays size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-900">Rincian Kehadiran Shift</p>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-200/80 text-indigo-900">
                            {validAttendances.length} Shift Sah
                          </span>
                        </div>
                        <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                          Ketuk untuk validasi daftar tanggal & jam kerja periode ini
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                        showAttendanceDetails ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showAttendanceDetails && (
                    <div className="mt-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* Ringkasan Akumulasi */}
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-center">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Shift Sah</p>
                          <p className="text-xs font-black text-slate-800 mt-0.5">{validAttendances.length} Hari</p>
                        </div>
                        <div className="border-x border-slate-200/80">
                          <p className="text-[9px] font-black text-slate-400 uppercase">Total Jam</p>
                          <p className="text-xs font-black text-slate-800 mt-0.5">{totalShiftHours.toFixed(1)} Jam</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Lembur</p>
                          <p className="text-xs font-black text-emerald-700 mt-0.5">{fmtRupiah(payroll.totalOvertimeBonus)}</p>
                        </div>
                      </div>

                      {/* List Shift */}
                      {attendances.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-50 text-center border border-slate-100">
                          <AlertCircle size={20} className="mx-auto text-slate-300 mb-1" />
                          <p className="text-xs font-bold text-slate-500">Tidak ada riwayat absensi pada periode penggajian ini</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                          {attendances.map((att) => {
                            const isValid = (att.totalHours || 0) > 0;
                            const hasOvertime = (att.overtimeBonus || 0) > 0;

                            return (
                              <div
                                key={att.id}
                                className={`p-3 rounded-2xl border transition-all text-xs flex flex-col gap-1.5 ${
                                  isValid
                                    ? "bg-white border-slate-200/80 shadow-2xs"
                                    : "bg-amber-50/50 border-amber-200/60"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-black text-slate-800">
                                      {formatShiftDate(att.date)}
                                    </span>
                                  </div>
                                  <div>
                                    {isValid ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                        <CheckCircle2 size={11} /> 1 Shift Sah
                                      </span>
                                    ) : att.status === "direview" ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200/80">
                                        <AlertCircle size={11} /> Perlu Review
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200/80">
                                        <AlertCircle size={11} /> Belum Lengkap
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                  <div className="flex items-center gap-1.5 font-medium">
                                    <Clock size={12} className="text-slate-400" />
                                    <span>
                                      {formatTimeOnly(att.checkIn?.time)} – {formatTimeOnly(att.checkOut?.time)}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="font-semibold text-slate-700">{att.totalHours || 0} Jam</span>
                                  </div>
                                  {hasOvertime && (
                                    <span className="font-black text-emerald-600 bg-emerald-50/80 px-1.5 py-0.5 rounded-md">
                                      +{fmtRupiah(att.overtimeBonus || 0)}
                                    </span>
                                  )}
                                </div>

                                {att.flaggedReason && (
                                  <p className="text-[10px] font-medium text-amber-600 bg-amber-50/80 px-2 py-1 rounded-lg">
                                    Catatan: {att.flaggedReason}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5 mt-5">
                  <button 
                    onClick={() => setShowFullSlip(!showFullSlip)}
                    className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all tap-target cursor-pointer"
                  >
                    <Eye size={15} /> {showFullSlip ? "Tutup Slip" : "Lihat Lembar Slip"}
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 tap-target cursor-pointer"
                  >
                    <Printer size={15} /> Cetak / PDF
                  </button>
                </div>
              </div>
            </div>

            {/* ── PREVIEW DOKUMEN RESMI DI LAYAR (JIKA DIBUKA) ── */}
            {showFullSlip && (
              <div className="no-print bg-white rounded-3xl p-4 md:p-6 border border-slate-200 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                  <span className="text-xs font-extrabold text-slate-700">Lembar Slip Gaji Resmi</span>
                  <button
                    onClick={() => setShowFullSlip(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
                <SalarySlipDocument payroll={payroll} employeeRole="Crew Lapangan & Produksi" />
              </div>
            )}

            {/* ── AREA PRINT RESMI (HANYA DITAMPILKAN SAAT PRINT) ── */}
            <div id="crew-printable-slip" className="hidden print:block">
              <SalarySlipDocument payroll={payroll} employeeRole="Crew Lapangan & Produksi" />
            </div>
          </>
        )}
      </div>

      {/* ── ISOLASI PRINT CSS UNTUK CREW ── */}
      <style>{`
        @media print {
          /* Sembunyikan seluruh UI web/mobile */
          .no-print, nav, header, aside, button, input {
            display: none !important;
          }

          html, body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }

          /* Tampilkan HANYA area cetak resmi */
          #crew-printable-slip {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .salary-slip-doc {
            border: 2px solid #0f172a !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 16px !important;
          }

          @page {
            size: A4 portrait;
            margin: 8mm 6mm;
          }
        }
      `}</style>
    </div>
  );
}
