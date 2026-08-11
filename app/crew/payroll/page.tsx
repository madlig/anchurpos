"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { ReceiptText, ShieldCheck, Download, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { PayrollRecord } from "../../manager/employees/types";

const fmtRupiah = (num: number) => {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
};

export default function CrewPayrollPage() {
  const { getToken } = useAuth();
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [loading, setLoading] = useState(true);
  const [payroll, setPayroll] = useState<PayrollRecord | null>(null);

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPayroll(null);
    try {
      const payRes = await fetchWithAuth(`/api/payroll?month=${selectedMonth}`);
      if (payRes.ok) {
        const data: PayrollRecord[] = await payRes.json();
        if (data.length > 0) {
          setPayroll(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-slate-50/80 pb-28 px-4 pt-4 max-w-xl mx-auto space-y-4 page-enter">
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
            <ReceiptText size={22} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800">Slip Gaji</h1>
            <p className="text-xs font-semibold text-slate-400">Rincian gaji transparan</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
          <label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider">Pilih Bulan Penggajian</label>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)} 
            className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-96 w-full rounded-3xl" />
          </div>
        ) : !payroll ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-sm space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-2">
              <ReceiptText size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-black text-slate-700">Belum ada slip gaji</p>
            <p className="text-[11px] font-semibold text-slate-400 max-w-[250px] mx-auto leading-relaxed">
              Gaji bulan ini mungkin belum di-generate atau belum dikunci oleh manager.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-lg shadow-slate-200/50 animate-in slide-in-from-bottom-4">
            <div className="bg-emerald-500 p-6 text-center relative text-white">
              <ShieldCheck size={40} className="mx-auto mb-2 opacity-90" />
              <h2 className="text-lg font-black tracking-widest uppercase">Slip Gaji Resmi</h2>
              <p className="text-xs font-bold opacity-90 mt-1">Periode: {payroll.workPeriod}</p>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Nama Crew</p>
                  <p className="text-sm font-black text-slate-800">{payroll.employeeName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Bulan</p>
                  <p className="text-sm font-black text-slate-800">{payroll.month}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-slate-500">Gaji Pokok ({payroll.workDays} shift)</p>
                  <p className="text-sm font-black text-slate-800">{fmtRupiah(payroll.totalRegularPay)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-slate-500">Bonus Lemburan</p>
                  <p className="text-sm font-black text-slate-800">{fmtRupiah(payroll.totalOvertimeBonus)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-emerald-600">Bonus Performa</p>
                    {payroll.performanceBonusNote && <p className="text-[10px] font-semibold text-emerald-600/80">Catatan: {payroll.performanceBonusNote}</p>}
                  </div>
                  <p className="text-sm font-black text-emerald-600">+{fmtRupiah(payroll.performanceBonus || 0)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-red-500">Potongan / Kasbon</p>
                    {payroll.deductionNote && <p className="text-[10px] font-semibold text-red-500/80">Catatan: {payroll.deductionNote}</p>}
                  </div>
                  <p className="text-sm font-black text-red-500">-{fmtRupiah(payroll.deductions || 0)}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Diterima (Take Home Pay)</p>
                <p className="text-3xl font-black text-emerald-500">{fmtRupiah(payroll.totalPaid)}</p>
              </div>

              <button 
                onClick={() => window.print()}
                className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-wider mt-5 flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-95 transition-all shadow-md"
              >
                <Download size={16} /> Simpan PDF / Cetak
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
