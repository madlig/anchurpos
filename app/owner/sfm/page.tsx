"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2, ChefHat, Clock, AlertTriangle, Snowflake,
  CheckCircle2, Package, ArrowLeft, RefreshCw, ThermometerSnowflake,
  ClipboardList, Users, Award, Calendar, Check, X, Camera
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";

interface ActiveWorkOrder {
  id: string;
  woNumber: string;
  woType: string;
  status: string;
  currentStage: string;
  currentStepIndex: number;
  progressPct: number;
  assignedCrewName: string;
  productName: string;
  variantNames: string;
  targetPacks: number;
  targetPcs: number;
  goodPacks: number;
  goodPcs: number;
  defectPacks: number;
  defectPcs: number;
  startedAt?: string;
  currentStepStartedAt?: string;
  freezerInAt?: string;
  batchCode: string;
  notes: string;
  stuck: boolean;
  paused?: boolean;
  pausedReason?: string;
  totalPauseMs?: number;
  needsClose?: boolean;
}

interface SfmMetrics {
  activeCount: number;
  stuckCount: number;
  inFreezerCount: number;
  todayCompletedCount: number;
  todayGoodPacks: number;
  todayGoodPcs: number;
  todayDefectPacks: number;
  todayYieldPct: number;
  needsCloseCount: number;
  totalFrozenTrays: number;
}

interface AuditItem {
  id: string;
  woNumber: string;
  woType: string;
  status: string;
  assignedCrewName: string;
  goodPacks: number;
  defectPacks: number;
  createdAt: string;
  completedAt?: string;
  batchCode: string;
  expiredDate: string;
}

const ALL_STEPS = ["DOUGH_COOKING", "MIXING_EGG", "TRAY_MOLDING", "FREEZER_CHECKPOINT", "PRE_PACK", "FINAL_PACK"];
const STEP_LABELS: Record<string, string> = {
  DOUGH_COOKING: "Dough",
  MIXING_EGG: "Adonan Telur",
  TRAY_MOLDING: "Cetak Tray",
  FREEZER_CHECKPOINT: "Freezer",
  PRE_PACK: "Pre-Pack",
  FINAL_PACK: "Final Pack",
};
const WO_TYPE_LABELS: Record<string, string> = {
  PRODUKSI: "Produksi",
  REPACK_SAOS: "Repack Saos",
  REPACK_GULA: "Repack Gula",
  PACKING_PESANAN: "Packing Order",
  STOCK_OPNAME: "Stok Opname",
  GENERAL_TASK: "Tugas Umum",
};

function fmtTime(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function elapsedShort(iso?: string) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}j ${m}m`;
}

export default function OwnerSFMPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<{ metrics: SfmMetrics; activeWorkOrders: ActiveWorkOrder[]; audit: AuditItem[] } | null>(null);
  const [freezerRakTotal, setFreezerRakTotal] = useState({ loyang: 0, pcs: 0 });
  const [freezerPetiTotal, setFreezerPetiTotal] = useState({ regular: 0, full: 0 });
  const [shiftReports, setShiftReports] = useState<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers }
    });
  }, [getToken]);

  const load = useCallback(async (showSkeleton = false) => {
    if (showSkeleton === true) setLoading(true);
    try {
      const [sfmRes, rakRes, petiRes, reportsRes] = await Promise.all([
        fetchWithAuth("/api/owner/sfm-summary"),
        fetchWithAuth("/api/sfm/freezer-rak").catch(() => null),
        fetchWithAuth("/api/products/stocks").catch(() => null),
        fetchWithAuth("/api/sfm/shift-reports").catch(() => null),
      ]);

      if (sfmRes.ok) setData(await sfmRes.json());
      if (rakRes && rakRes.ok) {
        const rakData: any[] = await rakRes.json();
        const lSum = rakData.reduce((s, r) => s + (Number(r.totalLoyang) || 0), 0);
        const pSum = rakData.reduce((s, r) => s + (Number(r.totalPcs) || 0), 0);
        setFreezerRakTotal({ loyang: lSum, pcs: pSum });
      }
      if (petiRes && petiRes.ok) {
        const petiData: any[] = await petiRes.json();
        let reg = 0;
        let ful = 0;
        petiData.forEach((p) => {
          if (p.productId === "churros-frozen-regular") reg += Number(p.currentStock) || 0;
          if (p.productId === "churros-frozen-full") ful += Number(p.currentStock) || 0;
        });
        setFreezerPetiTotal({ regular: reg, full: ful });
      }
      if (reportsRes && reportsRes.ok) {
        setShiftReports(await reportsRes.json());
      }
    } catch (err) {
      console.error("SFM load error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const handleUpdateOvertime = async (reportId: string, overtimeStatus: "approved" | "rejected") => {
    try {
      const res = await fetchWithAuth("/api/sfm/shift-reports", {
        method: "PATCH",
        body: JSON.stringify({ id: reportId, overtimeStatus }),
      });
      if (res.ok) {
        load(false);
      } else {
        alert("Gagal memperbarui status lembur");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan");
    }
  };

  useEffect(() => {
    load(!data);

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") load(false);
    }, 60000);

    const handleFCM = () => load(false);
    window.addEventListener("fcm_message", handleFCM);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") load(false);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("fcm_message", handleFCM);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-50/70 pb-24">
        <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
          <div className="max-w-5xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-2xl" />
                <div>
                  <Skeleton className="h-6 w-32 mb-1" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </div>
            <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="px-4 md:px-8 max-w-5xl mx-auto pt-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <div className="space-y-4 mt-8">
            <Skeleton className="h-32 rounded-2xl w-full" />
            <Skeleton className="h-32 rounded-2xl w-full" />
            <Skeleton className="h-32 rounded-2xl w-full" />
          </div>
        </div>
      </div>
    );
  }

  const { metrics, activeWorkOrders, audit } = data;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/owner/dashboard" className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 text-slate-600 transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">
                  Monitor Produksi (SFM)
                </h1>
                <p className="text-xs font-semibold text-slate-400">Shop Floor Management • Read-only</p>
              </div>
            </div>
            <button
              onClick={() => load(true)}
              className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-primary" : ""} />
            </button>
          </div>

          {/* ── Executive Metric Cards ──────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <MetricCard icon={ChefHat} label="WO Aktif" value={metrics.activeCount} color="text-primary bg-rose-50" />
            <MetricCard icon={AlertTriangle} label="Stuck" value={metrics.stuckCount} color={metrics.stuckCount > 0 ? "text-rose-600 bg-rose-50" : "text-slate-500 bg-slate-50"} />
            <MetricCard icon={AlertTriangle} label="Perlu Ditutup" value={metrics.needsCloseCount} color={metrics.needsCloseCount > 0 ? "text-amber-600 bg-amber-50" : "text-slate-500 bg-slate-50"} />
            <MetricCard icon={Snowflake} label="Di Freezer" value={metrics.totalFrozenTrays || 0} color="text-blue-600 bg-blue-50" sub="loyang beku" />
            <MetricCard icon={CheckCircle2} label="Hari Ini" value={metrics.todayCompletedCount} color="text-emerald-600 bg-emerald-50" sub="selesai" />
            <div className="col-span-2 md:col-span-1 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <Package size={12} className="text-amber-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Yield</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black tabular-nums text-slate-800">{metrics.todayYieldPct}%</span>
                <span className="text-[10px] text-slate-400">({metrics.todayGoodPacks} packs)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-5 pt-5">
        {/* --- 2-Freezer Inventory Status Pipeline --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-sky-200 shadow-sm flex items-center justify-center text-sky-600">
                <Snowflake size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 bg-sky-100/60 px-2 py-0.5 rounded-md">WIP (Bahan Setengah Jadi)</span>
                <h4 className="text-base font-black text-slate-800">Freezer Rak Dapur</h4>
                <p className="text-xs text-slate-500 font-medium">Stok loyang baru dicetak siap prepack</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-sky-700">{freezerRakTotal.loyang} <span className="text-xs font-bold text-sky-600">Loyang</span></div>
              <div className="text-xs font-bold text-sky-600/80">≈ {freezerRakTotal.pcs} pcs churros</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-emerald-200 shadow-sm flex items-center justify-center text-emerald-600">
                <Package size={24} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-md">Ready Stock (Siap Jual)</span>
                <h4 className="text-base font-black text-slate-800">Freezer Peti Toko</h4>
                <p className="text-xs text-slate-500 font-medium">Thinwall siap kirim kasir & packing ekspedisi</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-emerald-700">{freezerPetiTotal.regular + freezerPetiTotal.full} <span className="text-xs font-bold text-emerald-600">Pack</span></div>
              <div className="text-xs font-bold text-emerald-600/80">Reg: {freezerPetiTotal.regular} | Full: {freezerPetiTotal.full}</div>
            </div>
          </div>
        </div>

        {/* --- Shift Reports & Overtime Claims Review --- */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ClipboardList size={14} /> Laporan Shift & Review Lembur Crew ({shiftReports.length})
            </h2>
            {shiftReports.some((r) => r.overtimeClaim?.isOvertimeEligible && r.overtimeClaim?.status === "pending_owner") && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full animate-pulse">
                Ada Lembur Perlu Persetujuan
              </span>
            )}
          </div>

          {shiftReports.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <p className="text-xs text-slate-400">Belum ada laporan shift tercatat.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shiftReports.slice(0, 5).map((r) => {
                const ot = r.overtimeClaim;
                const cooking = r.activities?.cookingAndMolding;
                const prepack = r.activities?.thinwallPrepack;
                const sauce = r.activities?.sauceRepack;
                const sugar = r.activities?.sugarRepack;
                const packOrder = r.activities?.orderPacking;

                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {r.reportNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {r.date || r.createdAt?.split("T")[0]}
                        </span>
                        <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {r.crewNames?.join(", ") || "Crew"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                          Speed: {r.speedScore ?? 100}% ({r.totalDurationMinutes}m)
                        </span>
                        {r.photoUrls && r.photoUrls.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedPhoto(r.photoUrls[0])}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Camera size={13} /> Foto
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-bold">Masak Adonan:</span>
                        <span className="font-black text-slate-800">
                          {cooking?.targets?.map((t: any) => `${t.batches} adonan (${t.pcs} pcs)`).join(", ") || "-"}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-bold">Prepack Thinwall:</span>
                        <span className="font-black text-slate-800">
                          {prepack ? `Reg: ${prepack.items?.reduce((s: number, i: any) => s + (i.regularPacks || 0), 0) || 0} | Full: ${prepack.items?.reduce((s: number, i: any) => s + (i.fullPacks || 0), 0) || 0}` : "-"}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-bold">Repack & Packing:</span>
                        <span className="font-black text-slate-800 text-[11px] block">
                          Saus: {sauce?.items?.reduce((s: number, i: any) => s + (i.outputPcs || 0), 0) || 0}c | Gula: {sugar?.items?.reduce((s: number, i: any) => s + (i.outputPacks || 0), 0) || 0}p | Paket: {packOrder?.totalPackagesPacked || 0}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-bold">Sisa Bahan:</span>
                        <span className="font-bold text-slate-700 text-[11px] truncate block">
                          {r.rawMaterialRemaining?.map((m: any) => `${m.name}: ${m.physicalStock}${m.unit}`).join(" | ") || "Sesuai"}
                        </span>
                      </div>
                    </div>

                    {/* Overtime Review Section */}
                    {ot?.isOvertimeEligible && (
                      <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-amber-900">Klaim Lembur:</span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              ot.status === "approved" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                              ot.status === "rejected" ? "bg-red-100 text-red-800 border-red-300" :
                              "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                            }`}>
                              {ot.status === "approved" ? "Disetujui" : ot.status === "rejected" ? "Ditolak" : "Perlu Persetujuan"}
                            </span>
                          </div>
                          <p className="text-xs text-amber-800 mt-0.5">{ot.reason}</p>
                        </div>
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          {ot.status !== "approved" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOvertime(r.id, "approved")}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-1 active:scale-95"
                            >
                              <Check size={12} /> Setujui
                            </button>
                          )}
                          {ot.status !== "rejected" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOvertime(r.id, "rejected")}
                              className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold border border-red-200 active:scale-95"
                            >
                              Tolak
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Active Work Orders ────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 px-1">
            Work Order Berjalan ({activeWorkOrders.length})
          </h2>
          {activeWorkOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <ChefHat size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-400">Tidak ada work order aktif saat ini.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeWorkOrders.map((wo) => (
                <WOCar key={wo.id} wo={wo} />
              ))}
            </div>
          )}
        </div>

        {/* ── Audit Trail (7-day digest) ─────────────────────────────── */}
        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 px-1">
            Audit 7 Hari Terakhir ({audit.length})
          </h2>
          {audit.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
              <p className="text-xs text-slate-400">Belum ada aktivitas produksi.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left font-bold">WO #</th>
                      <th className="px-4 py-3 text-left font-bold">Tipe</th>
                      <th className="px-4 py-3 text-left font-bold hidden sm:table-cell">Crew</th>
                      <th className="px-4 py-3 text-center font-bold">Good</th>
                      <th className="px-4 py-3 text-center font-bold">Defect</th>
                      <th className="px-4 py-3 text-center font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 font-extrabold text-slate-800">{a.woNumber}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{WO_TYPE_LABELS[a.woType] || a.woType}</td>
                        <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{a.assignedCrewName}</td>
                        <td className="px-4 py-3 text-center font-black text-emerald-600 tabular-nums">{a.goodPacks}</td>
                        <td className="px-4 py-3 text-center font-black text-rose-500 tabular-nums">{a.defectPacks}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                            a.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Camera size={14} className="text-slate-500" /> Foto Bukti Shift / Freezer
              </span>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center bg-slate-950">
              <img
                src={selectedPhoto}
                alt="Bukti Shift"
                className="max-h-[75vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function MetricCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className={color.split(" ")[0]} />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black tabular-nums text-slate-800">{value}</span>
        {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

function WOCar({ wo }: { wo: ActiveWorkOrder }) {
  return (
    <div className={`rounded-2xl md:rounded-3xl bg-white border shadow-sm p-4 md:p-5 transition-all ${wo.stuck ? "border-rose-300 ring-1 ring-rose-200" : "border-slate-200/80"}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${wo.stuck ? "bg-rose-500 animate-pulse" : "bg-emerald-400"}`} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-extrabold text-slate-800">{wo.woNumber}</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{WO_TYPE_LABELS[wo.woType] || wo.woType}</span>
              {wo.stuck && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 uppercase animate-pulse">Stuck!</span>
              )}
              {wo.paused && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase animate-pulse">PAUSED</span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{wo.productName}{wo.variantNames ? ` • ${wo.variantNames}` : ""}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold text-slate-400">{wo.assignedCrewName}</p>
          <p className="text-[10px] font-semibold text-slate-300">Mulai: {fmtTime(wo.startedAt)}</p>
        </div>
      </div>

      {/* Step progress bar */}
      <div className="flex items-center gap-1 mb-3">
        {ALL_STEPS.map((step, idx) => {
          const isDone = idx < wo.currentStepIndex;
          const isCurrent = idx === wo.currentStepIndex;
          return (
            <div key={step} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-1.5 rounded-full w-full transition-all ${
                  isDone ? "bg-primary" : isCurrent ? "bg-primary/40 animate-pulse" : "bg-slate-100"
                }`}
              />
              <span className={`text-[8px] font-bold ${isDone ? "text-primary" : isCurrent ? "text-primary/70" : "text-slate-300"}`}>
                {STEP_LABELS[step]?.split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="p-2 rounded-xl bg-slate-50">
          <span className="text-[9px] font-bold text-slate-400 block">Target</span>
          <span className="text-xs font-black text-slate-800 tabular-nums">{wo.targetPacks}</span>
          <span className="text-[8px] text-slate-400"> packs</span>
        </div>
        <div className="p-2 rounded-xl bg-emerald-50">
          <span className="text-[9px] font-bold text-emerald-600 block">Good</span>
          <span className="text-xs font-black text-emerald-700 tabular-nums">{wo.goodPacks}</span>
        </div>
        <div className="p-2 rounded-xl bg-rose-50">
          <span className="text-[9px] font-bold text-rose-600 block">Defect</span>
          <span className="text-xs font-black text-rose-700 tabular-nums">{wo.defectPacks}</span>
        </div>
        <div className="p-2 rounded-xl bg-slate-50">
          <span className="text-[9px] font-bold text-slate-400 block">Step Timer</span>
          <span className="text-xs font-black text-slate-800 tabular-nums">{elapsedShort(wo.currentStepStartedAt) || "-"}</span>
        </div>
      </div>

      {/* Extra info chips */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {wo.paused && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <AlertTriangle size={8} /> Paused: {wo.pausedReason}
          </span>
        )}
        {(wo.totalPauseMs || 0) > 0 && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 flex items-center gap-1">
            ⏱ {Math.round((wo.totalPauseMs || 0) / 60000)}m dijeda
          </span>
        )}
        {wo.needsClose && (
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 animate-pulse">
            <CheckCircle2 size={8} /> PERLU DITUTUP
          </span>
        )}
        {wo.batchCode && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Batch: {wo.batchCode}</span>
        )}
        {wo.freezerInAt && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-1">
            <Snowflake size={8} /> Freezer sejak {fmtTime(wo.freezerInAt)}
          </span>
        )}
      </div>
    </div>
  );
}
