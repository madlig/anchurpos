"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2, ChefHat, Clock, AlertTriangle, Snowflake,
  CheckCircle2, Package, ArrowLeft, RefreshCw, ThermometerSnowflake,
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
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(async (url: string) => {
    const token = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [getToken]);

  const load = useCallback(async (showSkeleton = false) => {
    if (showSkeleton === true) setLoading(true);
    try {
      const res = await fetchWithAuth("/api/owner/sfm-summary");
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("SFM load error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load(!data);

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") load(false);
    }, 30000);

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
