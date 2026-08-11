"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ArrowLeft, RefreshCw, Users, Wallet, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";

interface Employee {
  id: string;
  name: string;
  username: string;
  role: string;
  phone?: string;
  isActive?: boolean;
}

interface PayrollItem {
  id: string;
  month: string;
  employeeName?: string;
  employeeId?: string;
  workDays?: number;
  dailyWage?: number;
  totalRegularPay?: number;
  totalOvertimeBonus?: number;
  performanceBonus?: number;
  deductions?: number;
  totalPaid?: number;
  status?: string;
  paidAt?: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function OwnerEmployeesPage() {
  const { fetchWithAuth } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, payRes] = await Promise.all([
        fetchWithAuth("/api/employees"),
        fetchWithAuth(`/api/payroll?month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`),
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
      if (payRes.ok) {
        const payData = await payRes.json();
        setPayroll(Array.isArray(payData) ? payData : []);
      }
    } finally { setLoading(false); }
  }, [fetchWithAuth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const crewList = employees.filter((e) => e.role !== "owner");
  const totalPayroll = payroll.reduce((s, p) => s + (p.totalPaid ?? 0), 0);
  const paidCount = payroll.filter((p) => p.status === "sudah_bayar").length;
  const unpaidCount = payroll.filter((p) => p.status !== "sudah_bayar").length;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/owner/dashboard" className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 text-slate-600">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800">Karyawan & Payroll</h1>
                <p className="text-xs text-slate-400">{crewList.length} karyawan aktif</p>
              </div>
            </div>
            <button onClick={fetchData} className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
              <RefreshCw size={16} className={loading ? "animate-spin text-primary" : ""} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-5 pt-5">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Payroll Summary */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-xl border border-slate-800">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Payroll Bulan Ini</p>
              <div className="text-2xl font-black tabular-nums">{fmt(totalPayroll)}</div>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-400" /> {paidCount} dibayar</span>
                <span className="flex items-center gap-1"><Wallet size={12} className="text-amber-400" /> {unpaidCount} belum</span>
              </div>
            </div>

            {/* Employee List */}
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 px-1">Daftar Karyawan</h2>
              <div className="space-y-2">
                {crewList.map((emp) => (
                  <div key={emp.id} className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center shrink-0">
                      <span className="text-white font-bold text-sm">{emp.name[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-slate-800 truncate">{emp.name}</p>
                      <p className="text-[10px] text-slate-400">{emp.role} • {emp.phone || "-"}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${emp.isActive !== false ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                      {emp.isActive !== false ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                ))}
                {crewList.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
                    <p className="text-xs text-slate-400">Belum ada data karyawan.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
