"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SalarySlipDocument, formatSlipWorkPeriod } from "@/components/shared/SalarySlipDocument";
import { PayrollRecord } from "@/app/manager/employees/types";
import { Printer, ArrowLeft, AlertCircle, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

function CrewSlipContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();

  const monthParam = searchParams.get("month") || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
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
      const payRes = await fetchWithAuth(`/api/payroll?month=${monthParam}`);
      if (payRes.ok) {
        const data: PayrollRecord[] = await payRes.json();
        if (data.length > 0) {
          setPayroll({
            ...data[0],
            workPeriod: formatSlipWorkPeriod(data[0].workPeriod, data[0].month),
          });
        } else {
          setError("Data slip gaji bulan ini belum tersedia atau belum dikunci resmi oleh manager.");
        }
      } else {
        setError("Gagal memuat data slip gaji.");
      }
    } catch (e) {
      console.error(e);
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, monthParam]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

  // Set document title untuk print PDF: Slip Gaji_(nama crew)_(periode gaji)
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
        <h2 className="text-lg font-black text-slate-800">Slip Tidak Ditemukan</h2>
        <p className="text-xs font-semibold text-slate-500 max-w-md mt-1 mb-6">
          {error || "Dokumen slip gaji tidak dapat ditampilkan."}
        </p>
        <button
          onClick={() => router.push("/crew/payroll")}
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-2 tap-target hover:bg-slate-800 transition-all cursor-pointer"
        >
          <ArrowLeft size={14} /> Kembali ke Slip Gaji
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
            onClick={() => router.push("/crew/payroll")}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Kembali ke Halaman Slip"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-emerald-400" />
              <h1 className="text-sm font-extrabold text-white">Slip Gaji Resmi Crew</h1>
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
      <div id="crew-slip-container" className="py-6 px-4 md:py-10 max-w-4xl mx-auto">
        <SalarySlipDocument payroll={payroll} employeeRole="Crew Lapangan & Produksi" />
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

          #crew-slip-container {
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

export default function CrewPayrollSlipPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <CrewSlipContent />
    </Suspense>
  );
}
