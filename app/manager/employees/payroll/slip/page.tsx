"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SalarySlipDocument, formatSlipWorkPeriod } from "@/components/shared/SalarySlipDocument";
import { PayrollRecord, Employee, AttendanceRecord } from "../../types";
import { Printer, ArrowLeft, Loader2, AlertCircle, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

function fmtDateFull(dStr: string) {
  const [y, m, d] = dStr.split("-");
  const mos = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${mos[parseInt(m) - 1]} ${y}`;
}

function SlipContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();

  const id = searchParams.get("id");
  const monthParam = searchParams.get("month");
  const empIdParam = searchParams.get("empId");
  const autoPrint = searchParams.get("autoPrint") === "true";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payroll, setPayroll] = useState<PayrollRecord | null>(null);

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...opts?.headers,
      },
    });
  }, [getToken]);

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Coba ambil langsung dari ID jika ada
      if (id) {
        const res = await fetchWithAuth(`/api/payroll/${id}`);
        if (res.ok) {
          const data: PayrollRecord = await res.json();
          setPayroll({
            ...data,
            workPeriod: formatSlipWorkPeriod(data.workPeriod, data.month),
          });
          setLoading(false);
          return;
        }
      }

      // 2. Jika tidak ditemukan via ID atau ID adalah kombinasi month_empId (live/unlocked)
      const month = monthParam || (id ? id.split("_")[0] : null);
      const empId = empIdParam || (id && id.includes("_") ? id.split("_").slice(1).join("_") : null);

      if (!month || !empId) {
        setError("Parameter slip tidak lengkap. Dibutuhkan ID atau bulan & karyawan.");
        setLoading(false);
        return;
      }

      // Hitung rentang 29 s/d 28
      const [yStr, mStr] = month.split("-");
      const year = parseInt(yStr);
      const mNum = parseInt(mStr);
      let prevMonth = mNum - 1;
      let prevYear = year;
      if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }

      const sd = new Date(prevYear, prevMonth - 1, 29);
      const sYear = sd.getFullYear();
      const sMonth = String(sd.getMonth() + 1).padStart(2, "0");
      const sDate = String(sd.getDate()).padStart(2, "0");

      const ed = new Date(year, mNum - 1, 28);
      const eYear = ed.getFullYear();
      const eMonth = String(ed.getMonth() + 1).padStart(2, "0");
      const eDate = String(ed.getDate()).padStart(2, "0");

      const startDate = `${sYear}-${sMonth}-${sDate}`;
      const endDate = `${eYear}-${eMonth}-${eDate}`;

      const [empRes, attRes, payRes] = await Promise.all([
        fetchWithAuth("/api/employees"),
        fetchWithAuth(`/api/attendance?startDate=${startDate}&endDate=${endDate}`),
        fetchWithAuth(`/api/payroll?month=${month}`),
      ]);

      let employees: Employee[] = [];
      let attendance: AttendanceRecord[] = [];
      let lockedPayrolls: PayrollRecord[] = [];

      if (empRes.ok) employees = await empRes.json();
      if (attRes.ok) attendance = await attRes.json();
      if (payRes.ok) lockedPayrolls = await payRes.json();

      const emp = employees.find((e) => e.id === empId);
      if (!emp) {
        setError("Karyawan tidak ditemukan.");
        setLoading(false);
        return;
      }

      const locked = lockedPayrolls.find((p) => p.employeeId === empId);
      if (locked) {
        setPayroll({
          ...locked,
          workPeriod: formatSlipWorkPeriod(locked.workPeriod, locked.month),
        });
        setLoading(false);
        return;
      }

      // Hitung live slip
      const empAtt = attendance.filter((a) => a.employeeId === emp.id);
      const validEmpAtt = empAtt.filter((a) => (a.totalHours || 0) > 0);
      const workDays = validEmpAtt.length;
      const dailyWage = emp.dailyWage || 60000;
      const totalRegularPay = workDays * dailyWage;
      const totalOvertimeBonus = validEmpAtt.reduce((sum, a) => sum + (a.overtimeBonus || 0), 0);
      const periodStr = `${fmtDateFull(startDate)} - ${fmtDateFull(endDate)}`;
      const totalPaid = totalRegularPay + totalOvertimeBonus;

      setPayroll({
        id: `${month}_${emp.id}`,
        month,
        employeeId: emp.id,
        employeeName: emp.name,
        workDays,
        dailyWage,
        totalRegularPay,
        totalOvertimeBonus,
        performanceBonus: 0,
        performanceBonusNote: "",
        deductions: 0,
        deductionNote: "",
        totalPaid,
        isLocked: false,
        workPeriod: periodStr,
      });
    } catch (e) {
      console.error(e);
      setError("Terjadi kesalahan saat memuat data slip gaji.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, id, monthParam, empIdParam]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  // Set document title untuk print PDF sesuai format: Slip Gaji_(nama crew)_(periode gaji)
  useEffect(() => {
    if (!loading && payroll) {
      const cleanName = (payroll.employeeName || "Crew").replace(/[/\\?%*:|"<>]/g, "").trim();
      const cleanPeriod = (payroll.month || "").replace(/[/\\?%*:|"<>]/g, "").trim();
      document.title = `Slip Gaji_${cleanName}_${cleanPeriod}`;

      if (autoPrint) {
        let isMounted = true;
        const triggerPrint = async () => {
          try {
            if (typeof document !== "undefined" && document.fonts) {
              await document.fonts.ready;
            }
          } catch {}
          if (!isMounted) return;
          setTimeout(() => {
            if (isMounted) window.print();
          }, 600);
        };
        triggerPrint();
        return () => { isMounted = false; };
      }
    }
  }, [loading, payroll, autoPrint]);

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !payroll) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-lg font-black text-slate-800">Gagal Membuka Slip</h2>
        <p className="text-xs font-semibold text-slate-500 max-w-md mt-1 mb-6">
          {error || "Dokumen slip gaji tidak dapat ditemukan."}
        </p>
        <button
          onClick={() => router.push("/manager/employees/payroll")}
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-2 tap-target hover:bg-slate-800 transition-all cursor-pointer"
        >
          <ArrowLeft size={14} /> Kembali ke Payroll
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ── TOP ACTION BAR (TIDAK TERCETAK) ── */}
      <div className="no-print sticky top-0 z-30 bg-slate-900 text-white px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/manager/employees/payroll")}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Kembali ke Dashboard Payroll"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-emerald-400" />
              <h1 className="text-sm font-extrabold text-white">Halaman Cetak Slip Gaji</h1>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {payroll.employeeName} · Periode {payroll.month}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const cleanName = (payroll.employeeName || "Crew").replace(/[/\\?%*:|"<>]/g, "").trim();
              const cleanPeriod = (payroll.month || "").replace(/[/\\?%*:|"<>]/g, "").trim();
              document.title = `Slip Gaji_${cleanName}_${cleanPeriod}`;
              window.print();
            }}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/30 active:scale-95 transition-all cursor-pointer"
          >
            <Printer size={15} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      {/* ── PRINTABLE SLIP CANVAS ── */}
      <div id="slip-container" className="py-6 px-4 md:py-10 max-w-4xl mx-auto">
        <SalarySlipDocument payroll={payroll} />
      </div>

      {/* ── OVERRIDE CSS FOR CLEAN PRINT ── */}
      <style>{`
        html, body {
          background-color: #ffffff !important;
          background: #ffffff !important;
        }

        aside, nav {
          display: none !important;
        }

        @media print {
          .no-print, nav, aside, header {
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

          @page {
            size: A4 portrait;
            margin: 8mm 6mm;
          }

          #slip-container {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          .salary-slip-doc {
            border: 2px solid #0f172a !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 16px !important;
          }
        }
      `}</style>
    </>
  );
}

export default function PayrollSlipPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <SlipContent />
    </Suspense>
  );
}
