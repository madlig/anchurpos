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
    <div className="page-enter min-h-screen pb-24 md:pb-6" style={{ background: "#F8FAFC" }}>
      <div className="px-5 pt-6 pb-6 bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <h1 className="text-2xl font-black mb-1" style={{ color: "#1E293B" }}>Slip Gaji Digital</h1>
        <p className="text-sm font-semibold text-slate-500">Akses rincian gaji Anda secara transparan.</p>
      </div>

      <div className="p-4 md:p-6 max-w-lg mx-auto">
        <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", border: "1px solid #E2E8F0", marginBottom: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
          <label className="text-xs font-bold text-slate-500 block mb-2">PILIH BULAN PENGGAJIAN</label>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "14px", fontWeight: "700", color: "#334155", outline: "none", background: "#F8FAFC" }} />
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-96 w-full rounded-[20px]" />
          </div>
        ) : !payroll ? (
          <div style={{ background: "#fff", borderRadius: "16px", padding: "32px 16px", textAlign: "center", border: "1px dashed #CBD5E1" }}>
            <ReceiptText size={32} className="mx-auto text-slate-300 mb-3" />
            <p style={{ fontSize: "14px", fontWeight: "700", color: "#64748B" }}>Belum ada slip gaji</p>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>Gaji bulan ini mungkin belum di-generate atau belum dikunci oleh manager.</p>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4" style={{ background: "#fff", borderRadius: "20px", overflow: "hidden", border: "1px solid #E2E8F0", boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}>
            <div style={{ background: "#10B981", padding: "24px 20px", color: "#fff", textAlign: "center", position: "relative" }}>
              <ShieldCheck size={40} className="mx-auto mb-2 opacity-90" />
              <h2 style={{ fontSize: "18px", fontWeight: "900", letterSpacing: "1px", textTransform: "uppercase" }}>SLIP GAJI RESMI</h2>
              <p style={{ fontSize: "13px", fontWeight: "600", opacity: 0.9 }}>Periode: {payroll.workPeriod}</p>
            </div>
            
            <div className="p-5">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div>
                  <p style={{ fontSize: "11px", fontWeight: "800", color: "#94A3B8" }}>NAMA CREW</p>
                  <p style={{ fontSize: "15px", fontWeight: "800", color: "#1E293B" }}>{payroll.employeeName}</p>
                </div>
                <div className="text-right">
                  <p style={{ fontSize: "11px", fontWeight: "800", color: "#94A3B8" }}>BULAN</p>
                  <p style={{ fontSize: "15px", fontWeight: "800", color: "#1E293B" }}>{payroll.month}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                  <p style={{ fontSize: "13px", fontWeight: "600", color: "#64748B" }}>Gaji Pokok ({payroll.workDays} shift)</p>
                  <p style={{ fontSize: "14px", fontWeight: "800", color: "#334155" }}>{fmtRupiah(payroll.totalRegularPay)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p style={{ fontSize: "13px", fontWeight: "600", color: "#64748B" }}>Bonus Lemburan</p>
                  <p style={{ fontSize: "14px", fontWeight: "800", color: "#334155" }}>{fmtRupiah(payroll.totalOvertimeBonus)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#059669" }}>Bonus Performa</p>
                    {payroll.performanceBonusNote && <p style={{ fontSize: "10px", color: "#059669" }}>Catatan: {payroll.performanceBonusNote}</p>}
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: "800", color: "#059669" }}>+{fmtRupiah(payroll.performanceBonus || 0)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#DC2626" }}>Potongan / Kasbon</p>
                    {payroll.deductionNote && <p style={{ fontSize: "10px", color: "#DC2626" }}>Catatan: {payroll.deductionNote}</p>}
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: "800", color: "#DC2626" }}>-{fmtRupiah(payroll.deductions || 0)}</p>
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "12px", border: "1px dashed #CBD5E1" }}>
                <p style={{ fontSize: "12px", fontWeight: "800", color: "#64748B", marginBottom: "4px" }}>TOTAL DITERIMA (TAKE HOME PAY)</p>
                <p style={{ fontSize: "28px", fontWeight: "900", color: "#10B981" }}>{fmtRupiah(payroll.totalPaid)}</p>
              </div>

              <button 
                onClick={() => window.print()}
                style={{ width: "100%", padding: "14px", borderRadius: "12px", background: "#1E293B", color: "#fff", border: "none", fontWeight: "800", fontSize: "13px", marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer" }}
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
