"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2, ChefHat, Package, Calendar, Table, LayoutGrid, Plus, Check, X,
  Snowflake, AlertTriangle, RefreshCw, Search, Award, CheckCircle2, Clock,
  Layers, Box, Users, TrendingDown, Timer, ClipboardList, ChevronRight,
  ArrowDownToLine, Beaker, Palette, PlayCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatNumber } from "@/lib/formatters";
import type { WorkOrder, WorkOrderLog, Variant, SFMWorkOrderType, SFMTaskStep } from "@/types";

// --- Constants ---
const PRODUKSI_STEPS: { key: SFMTaskStep; label: string; icon: any }[] = [
  { key: "DOUGH_COOKING", label: "Masak Adonan", icon: Beaker },
  { key: "MIXING_EGG", label: "Mixer Telur", icon: Palette },
  { key: "TRAY_MOLDING", label: "Cetak Loyang", icon: Layers },
  { key: "FREEZER_CHECKPOINT", label: "Freezer", icon: Snowflake },
  { key: "PRE_PACK", label: "Pre-Pack", icon: Package },
];

const STUCK_THRESHOLD_MS = 3.5 * 60 * 60 * 1000; // 3.5 jam
const PRODUCING_STAGES = new Set(["DOUGH_COOKING", "MIXING_EGG", "TRAY_MOLDING"]);

// --- Helpers (outside component, pure functions) ---
function fmtDur(min: number): string {
  if (min <= 0) return "-";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}j ${m}m` : `${h}j`;
}

function fmtTimerMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

function getStageInfo(stage: string): { label: string; color: string; bg: string; isProducing: boolean; isFreezer: boolean; isDone: boolean } {
  switch (stage) {
    case "DOUGH_COOKING": return { label: "Masak Adonan", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", isProducing: true, isFreezer: false, isDone: false };
    case "MIXING_EGG": return { label: "Mixer Telur", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", isProducing: true, isFreezer: false, isDone: false };
    case "TRAY_MOLDING": return { label: "Cetak Loyang", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", isProducing: true, isFreezer: false, isDone: false };
    case "FREEZER_CHECKPOINT": return { label: "Freezer", color: "text-sky-700", bg: "bg-sky-50 border-sky-200", isProducing: false, isFreezer: true, isDone: false };
    case "PRE_PACK": return { label: "Pre-Pack", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", isProducing: false, isFreezer: false, isDone: false };
    case "FINAL_PACK": return { label: "Selesai", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", isProducing: false, isFreezer: false, isDone: true };
    default: return { label: stage || "Draft", color: "text-slate-600", bg: "bg-slate-50 border-slate-200", isProducing: false, isFreezer: false, isDone: false };
  }
}

function isStuck(wo: WorkOrder): boolean {
  if (wo.status === "COMPLETED" || wo.status === "CANCELLED") return false;
  if (!PRODUCING_STAGES.has(wo.currentStage)) return false;
  if (wo.pausedAt) return false;
  const stepStartedAt = wo.currentStepStartedAt || wo.startedAt || wo.createdAt;
  const started = new Date(stepStartedAt).getTime();
  return (Date.now() - started) > STUCK_THRESHOLD_MS;
}

function getYieldPct(wo: WorkOrder): number {
  let good = wo.summaryState?.totalGoodPcs || 0;
  let defect = wo.summaryState?.totalDefectPcs || 0;
  
  if (wo.variantState) {
    good = 0;
    defect = 0;
    Object.values(wo.variantState).forEach((v: any) => {
      good += v.goodPcs || 0;
      defect += v.defectPcs || 0;
    });
  }

  const total = good + defect;
  if (total <= 0) return 0;
  return Math.round((good / total) * 100);
}

function getProgressPct(wo: WorkOrder): number {
  if (wo.woType === "PRODUKSI") {
    const t = wo.targetLoyang || 1;
    let printed = wo.summaryState?.totalTrayPrinted || 0;
    if (wo.variantState) {
      printed = 0;
      Object.values(wo.variantState).forEach((v: any) => {
        printed += v.loyangPrinted || 0;
      });
    }
    return Math.min(100, Math.round((printed / t) * 100));
  }
  if (wo.woType === "PACKING_PESANAN") {
    const t = wo.targetPacks || 1;
    return Math.min(100, Math.round(((wo.summaryState?.totalGoodPacks || 0) / t) * 100));
  }
  const t = wo.targetQty || 1;
  return Math.min(100, Math.round(((wo.summaryState?.totalGoodPcs || 0) / t) * 100));
}

function getActiveTimerMs(wo: WorkOrder): number {
  if (wo.pausedAt) return 0;
  const isProduksi = wo.woType === "PRODUKSI";
  if (isProduksi && wo.currentStage === "FREEZER_CHECKPOINT" && wo.freezerInAt) {
    return Date.now() - new Date(wo.freezerInAt).getTime();
  }
  if (wo.currentStepStartedAt) {
    return Date.now() - new Date(wo.currentStepStartedAt).getTime();
  }
  return 0;
}

function getTotalDurationMin(wo: WorkOrder): number {
  const sd = wo.stepDurationsMinutes || {};
  return Object.values(sd).reduce((sum, v) => sum + (v || 0), 0);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// --- Main Component ---
export default function ManagerSFMPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"wo_active" | "audit_ledger">("wo_active");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVariantFilter, setSelectedVariantFilter] = useState("all");
  const [selectedWoTypeFilter, setSelectedWoTypeFilter] = useState<string>("all");
  const [selectedCrewFilter, setSelectedCrewFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "progress" | "duration" | "yield">("newest");

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail panel
  const [detailWo, setDetailWo] = useState<WorkOrder | null>(null);
  const [woLogs, setWoLogs] = useState<WorkOrderLog[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Live timer tick (re-render setiap 30 detik)
  const [liveTick, setLiveTick] = useState(0);

  // Modal
  const [showNewWoModal, setShowNewWoModal] = useState(false);
  const [creatingWo, setCreatingWo] = useState(false);
  const [newWoForm, setNewWoForm] = useState({
    woType: "PRODUKSI" as SFMWorkOrderType,
    variantId: "",
    targetBatches: "3",
    targetPacks: "48",
    targetQty: "100",
    targetUom: "cup",
    notes: "",
    productionTargets: [] as { variantId: string; variantName: string; targetBatches: string }[],
    opnameScope: "Semua" as "Semua" | "Bahan Baku" | "Kemasan" | "Produk Jadi" | "Spesifik",
    opnameItems: [] as string[],
    sourceOrderId: "",
    assignedCrewId: "",
    assignedCrewName: "",
    assignedCrewIds: [] as string[],
  });

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    });
  }, [getToken]);

  const loadAllData = useCallback(async (showSkeleton = false) => {
    if (showSkeleton === true) setLoading(true);
    try {
      const dateParams = activeTab === "audit_ledger"
        ? `startDate=${startDate}&endDate=${endDate}`
        : "";
      const [woRes, varRes, ordersRes, empRes] = await Promise.all([
        fetchWithAuth(`/api/sfm/work-orders?${dateParams}&search=${encodeURIComponent(searchQuery)}`),
        fetchWithAuth("/api/variants"),
        fetchWithAuth("/api/orders"),
        fetchWithAuth("/api/employees"),
      ]);

      if (woRes.ok) setWorkOrders(await woRes.json());
      if (varRes.ok) setVariants(await varRes.json());
      if (ordersRes.ok) {
        const allOrders = await ordersRes.json();
        setPendingOrders(Array.isArray(allOrders) ? allOrders.filter((o: any) => o.status === "pending" && !o.hasWorkOrder) : []);
      }
      if (empRes.ok) {
        const allEmp = await empRes.json();
        setEmployees(Array.isArray(allEmp) ? allEmp.filter((e: any) => e.isActive !== false) : []);
      }
    } catch (err) {
      console.error("loadAllData error:", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, activeTab, searchQuery, fetchWithAuth]);

  useEffect(() => {
    loadAllData(workOrders.length === 0);

    const fetchInterval = setInterval(() => {
      if (document.visibilityState === "visible") loadAllData();
    }, 30000);

    const handleFCM = () => loadAllData();
    window.addEventListener("fcm_message", handleFCM);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadAllData();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(fetchInterval);
      window.removeEventListener("fcm_message", handleFCM);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadAllData]);

  // Live tick: re-render setiap 30 detik untuk timer real-time
  useEffect(() => {
    const interval = setInterval(() => setLiveTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Crew list for filter
  const crewList = useMemo(() => employees.filter(e => e.role === "crew"), [employees]);

  const filteredWorkOrders = useMemo(() => {
    let list = workOrders.filter((w) => {
      if (selectedVariantFilter !== "all") {
        const matchesVariant =
          w.variantIds?.includes(selectedVariantFilter) ||
          w.productId === selectedVariantFilter ||
          w.productionTargets?.some(pt => pt.variantId === selectedVariantFilter);
        if (!matchesVariant) return false;
      }
      if (selectedWoTypeFilter !== "all") {
        if ((w.woType || "PRODUKSI") !== selectedWoTypeFilter) return false;
      }
      if (selectedCrewFilter !== "all") {
        if (w.assignedCrewId !== selectedCrewFilter) return false;
      }
      return true;
    });

    // Sort
    if (sortBy === "newest") {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "progress") {
      list.sort((a, b) => getProgressPct(b) - getProgressPct(a));
    } else if (sortBy === "duration") {
      list.sort((a, b) => getTotalDurationMin(b) - getTotalDurationMin(a));
    } else if (sortBy === "yield") {
      list.sort((a, b) => getYieldPct(a) - getYieldPct(b));
    }

    return list;
  }, [workOrders, selectedVariantFilter, selectedWoTypeFilter, selectedCrewFilter, sortBy]);

  // Stuck WOs (hanya tahap produksi, BUKAN freezer)
  const stuckWos = useMemo(() => filteredWorkOrders.filter(wo => isStuck(wo)), [filteredWorkOrders, liveTick]);

  // Metric computations
  const activeWos = useMemo(() => filteredWorkOrders.filter(w => w.status !== "COMPLETED" && w.status !== "CANCELLED"), [filteredWorkOrders]);
  const producingWos = useMemo(() => activeWos.filter(w => w.woType === "PRODUKSI" && PRODUCING_STAGES.has(w.currentStage)), [activeWos]);
  
  const totalFrozenTrays = useMemo(() => {
    return activeWos.reduce((total, wo) => {
      if (wo.woType !== "PRODUKSI") return total;
      if (wo.variantState) {
        return total + Object.values(wo.variantState).reduce((sum, v: any) => sum + (v.frozenTrays || 0), 0);
      }
      return total + (wo.summaryState?.totalTrayInFreezer || 0);
    }, 0);
  }, [activeWos]);
  const avgYield = useMemo(() => {
    const withOutput = filteredWorkOrders.filter(w => (w.summaryState?.totalGoodPcs || 0) + (w.summaryState?.totalDefectPcs || 0) > 0);
    if (withOutput.length === 0) return 0;
    return Math.round(withOutput.reduce((sum, w) => sum + getYieldPct(w), 0) / withOutput.length);
  }, [filteredWorkOrders]);

  // Detail panel handler
  async function openDetail(wo: WorkOrder) {
    setDetailWo(wo);
    setWoLogs([]);
    setLoadingDetail(true);
    try {
      const res = await fetchWithAuth(`/api/sfm/work-orders/${wo.id}/log`);
      if (res.ok) setWoLogs(await res.json());
    } catch (err) {
      console.error("openDetail error:", err);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetail() {
    setDetailWo(null);
    setWoLogs([]);
  }

  async function handleCreateWo(e: React.FormEvent) {
    e.preventDefault();
    setCreatingWo(true);
    try {
      const selectedVar = variants.find(v => v.id === newWoForm.variantId);
      const selectedCrew = employees.find(e => e.id === newWoForm.assignedCrewId);
      const res = await fetchWithAuth("/api/sfm/work-orders", {
        method: "POST",
        body: JSON.stringify({
          woType: newWoForm.woType,
          productId: newWoForm.variantId || "churros-frozen",
          productName: selectedVar ? `Churros (${selectedVar.name})` : "Churros Frozen",
          variantIds: newWoForm.variantId ? [newWoForm.variantId] : [],
          targetBatches: newWoForm.woType === "PRODUKSI" ? parseFloat(newWoForm.targetBatches) : 0,
          targetPacks: newWoForm.woType === "PACKING_PESANAN" ? parseInt(newWoForm.targetPacks) : 0,
          targetQty: (newWoForm.woType === "REPACK_SAOS" || newWoForm.woType === "REPACK_GULA" || newWoForm.woType === "GENERAL_TASK") ? parseFloat(newWoForm.targetQty) : 0,
          targetUom: (newWoForm.woType === "REPACK_SAOS" || newWoForm.woType === "REPACK_GULA" || newWoForm.woType === "GENERAL_TASK") ? newWoForm.targetUom : "",
          productionTargets: newWoForm.woType === "PRODUKSI" ? newWoForm.productionTargets : undefined,
          opnameScope: newWoForm.woType === "STOCK_OPNAME" ? newWoForm.opnameScope : undefined,
          opnameItems: newWoForm.woType === "STOCK_OPNAME" ? newWoForm.opnameItems : undefined,
          sourceOrderId: newWoForm.woType === "PACKING_PESANAN" ? newWoForm.sourceOrderId : undefined,
          assignedCrewIds: newWoForm.assignedCrewIds && newWoForm.assignedCrewIds.length > 0 ? newWoForm.assignedCrewIds : (newWoForm.assignedCrewId ? [newWoForm.assignedCrewId] : []),
          assignedCrewName: newWoForm.assignedCrewName || selectedCrew?.name || undefined,
          notes: newWoForm.notes,
        }),
      });

      if (res.ok) {
        setShowNewWoModal(false);
        setNewWoForm({
          woType: "PRODUKSI", variantId: "", targetBatches: "3", targetPacks: "48", targetQty: "100", targetUom: "cup", notes: "",
          productionTargets: [], opnameScope: "Semua", opnameItems: [], sourceOrderId: "", assignedCrewId: "", assignedCrewName: "", assignedCrewIds: []
        });
        await loadAllData(true);
      }
    } finally {
      setCreatingWo(false);
    }
  }

  // Reference liveTick so it's used (triggers re-render for timers)
  void liveTick;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 pb-28">
        <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-2xl" />
                <div>
                  <Skeleton className="h-6 w-48 mb-1" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            </div>
            <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      {/* Sticky Header */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                <LayoutGrid size={20} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">
                  Shop Floor Management (SFM)
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  Pusat Pengawasan Dapur & Distribusi Work Order
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadAllData(true)}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 flex items-center justify-center text-slate-700 transition-all active:scale-95"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>

              <button
                type="button"
                onClick={() => setShowNewWoModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Terbitkan Work Order</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
              {[
                { key: "wo_active", label: "Work Order Terpusat", icon: Layers },
                { key: "audit_ledger", label: "Laporan Audit", icon: Award },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 border ${
                      isActive
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-100/80 text-slate-600 border-slate-200/80 hover:bg-slate-200/60"
                    }`}
                  >
                    <Icon size={14} /> {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl mr-1">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === "table" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <Table size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <LayoutGrid size={14} />
                </button>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari WO/Varian..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 pr-3 w-36 sm:w-48 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
                />
              </div>

              <select
                value={selectedWoTypeFilter}
                onChange={(e) => setSelectedWoTypeFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="all">Semua Tipe</option>
                <option value="PRODUKSI">Produksi</option>
                <option value="REPACK_SAOS">Repack Saos</option>
                <option value="REPACK_GULA">Repack Gula</option>
                <option value="PACKING_PESANAN">Packing</option>
                <option value="STOCK_OPNAME">Opname</option>
                <option value="GENERAL_TASK">Task</option>
              </select>

              <select
                value={selectedVariantFilter}
                onChange={(e) => setSelectedVariantFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="all">Semua Varian</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>

              {/* Crew filter */}
              <select
                value={selectedCrewFilter}
                onChange={(e) => setSelectedCrewFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="all">Semua Crew</option>
                {crewList.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="newest">Terbaru</option>
                <option value="progress">Paling Dekat Selesai</option>
                <option value="duration">Durasi Terlama</option>
                <option value="yield">Yield Terendah</option>
              </select>

              {activeTab === "audit_ledger" && (
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200/90 p-1 rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-1 pl-1">
                    <Calendar size={13} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500">Dari:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 px-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">s/d</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 px-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
                    />
                  </div>
                  <div className="flex items-center gap-1 border-l border-slate-200/80 pl-1.5">
                    <button type="button" onClick={() => { const t = new Date().toISOString().split("T")[0]; setStartDate(t); setEndDate(t); }}
                      className="px-2 py-1 text-[10px] font-extrabold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-all active:scale-95">Hari Ini</button>
                    <button type="button" onClick={() => { const t = new Date(); const d7 = new Date(t); d7.setDate(d7.getDate() - 6); setStartDate(d7.toISOString().split("T")[0]); setEndDate(t.toISOString().split("T")[0]); }}
                      className="px-2 py-1 text-[10px] font-extrabold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-all active:scale-95">7 Hari</button>
                    <button type="button" onClick={() => { const t = new Date(); const f = new Date(t.getFullYear(), t.getMonth(), 1); setStartDate(f.toISOString().split("T")[0]); setEndDate(t.toISOString().split("T")[0]); }}
                      className="px-2 py-1 text-[10px] font-extrabold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-all active:scale-95">Bulan Ini</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* --- Executive Metric Cards --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center"><Layers size={16} className="text-slate-600" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">WO Aktif</p>
            </div>
            <p className="text-2xl font-black text-slate-900">{activeWos.length}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">dari {filteredWorkOrders.length} total</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center"><ChefHat size={16} className="text-emerald-600" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Produksi Dapur</p>
            </div>
            <p className="text-2xl font-black text-emerald-600">{producingWos.length}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{totalFrozenTrays} loyang beku di Freezer</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center"><TrendingDown size={16} className="text-amber-600" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rata-rata Yield</p>
            </div>
            <p className={`text-2xl font-black ${avgYield >= 90 ? "text-emerald-600" : avgYield >= 80 ? "text-amber-600" : avgYield > 0 ? "text-red-600" : "text-slate-300"}`}>
              {avgYield > 0 ? `${avgYield}%` : "-"}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">good vs total output</p>
          </div>

          <div className={`p-4 rounded-2xl border shadow-sm ${stuckWos.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${stuckWos.length > 0 ? "bg-red-100" : "bg-slate-100"}`}>
                <AlertTriangle size={16} className={stuckWos.length > 0 ? "text-red-600" : "text-slate-400"} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Perlu Perhatian</p>
            </div>
            <p className={`text-2xl font-black ${stuckWos.length > 0 ? "text-red-600" : "text-slate-900"}`}>{stuckWos.length}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{stuckWos.length > 0 ? "WO stuck di tahap produksi" : "Semua berjalan normal"}</p>
          </div>
        </div>

        {/* --- Alert Banner --- */}
        {stuckWos.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-xs font-black text-amber-800 uppercase tracking-wider">WO Perlu Perhatian — Lewat 3.5 Jam di Tahap Produksi</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {stuckWos.map(wo => {
                const dur = Date.now() - new Date(wo.startedAt || wo.createdAt).getTime();
                return (
                  <button
                    key={wo.id}
                    type="button"
                    onClick={() => openDetail(wo)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-amber-200 hover:bg-amber-100 transition-all text-xs font-bold text-amber-800 active:scale-95"
                  >
                    <Clock size={12} />
                    {wo.woNumber}
                    <span className="text-amber-500">({fmtTimerMs(dur)})</span>
                    <span className="bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-black">{getStageInfo(wo.currentStage).label}</span>
                    <ChevronRight size={12} className="text-amber-400" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* --- Work Orders List --- */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkOrders.map((wo) => {
              const stageInfo = getStageInfo(wo.currentStage);
              const stuck = isStuck(wo);
              const timerMs = getActiveTimerMs(wo);
              const yieldPct = getYieldPct(wo);
              const progressPct = getProgressPct(wo);

              return (
                <div
                  key={wo.id}
                  onClick={() => openDetail(wo)}
                  className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer ${
                    stuck ? "border-l-4 border-l-red-400 border-t border-t-red-100 border-r border-r-red-100 border-b border-b-red-100 bg-red-50/30" : "border-slate-200"
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-extrabold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                          {wo.woNumber}
                        </span>
                        <span className="text-[10px] font-black text-slate-500 uppercase">{wo.woType}</span>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        wo.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        wo.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {wo.status}
                      </span>
                    </div>

                    {/* Product */}
                    <h3 className="text-sm font-black text-slate-800">
                      {wo.woType === "PRODUKSI" && wo.productionTargets && wo.productionTargets.length > 0
                        ? `Churros (${wo.productionTargets.map(pt => `${pt.variantName}: ${pt.targetBatches}B`).join(", ")})`
                        : wo.productName || "Work Order"}
                    </h3>

                    {/* Stage + Timer */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${stageInfo.bg} ${stageInfo.color}`}>
                        {stageInfo.label}
                      </span>
                      {timerMs > 0 && wo.status !== "COMPLETED" && (
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Clock size={10} /> {fmtTimerMs(timerMs)}
                        </span>
                      )}
                      {wo.pausedAt && (
                        <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">PAUSED</span>
                      )}
                      {stuck && (
                        <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded animate-pulse">STUCK</span>
                      )}
                    </div>

                    {/* Target vs Aktual */}
                    <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-semibold space-y-1.5">
                      {wo.woType === "PRODUKSI" ? (
                        <>
                          <div className="flex justify-between"><span className="text-slate-500">Loyang:</span> <span className="text-slate-800 font-extrabold">{wo.summaryState?.totalTrayPrinted || 0} / {wo.targetLoyang || 0}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Pcs:</span> <span className="text-slate-800 font-extrabold">{wo.summaryState?.totalGoodPcs || 0}</span></div>
                        </>
                      ) : wo.woType === "PACKING_PESANAN" ? (
                        <div className="flex justify-between"><span className="text-slate-500">Pack:</span> <span className="text-slate-800 font-extrabold">{wo.summaryState?.totalGoodPacks || 0} / {wo.targetPacks || 0}</span></div>
                      ) : (
                        <div className="flex justify-between"><span className="text-slate-500">Output:</span> <span className="text-slate-800 font-extrabold">{wo.summaryState?.totalGoodPcs || 0} {wo.targetUom}</span></div>
                      )}
                      {/* Defect row */}
                      {(wo.summaryState?.totalDefectPcs || 0) > 0 && (
                        <div className="flex justify-between text-red-600"><span>Defect:</span> <span className="font-extrabold">{wo.summaryState?.totalDefectPcs} Pcs</span></div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${progressPct >= 100 ? "bg-emerald-500" : progressPct > 0 ? "bg-blue-500" : "bg-slate-200"}`} style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1 font-bold text-slate-600">
                      <Users size={11} className="text-slate-400" /> {wo.assignedCrewName || "Belum ditugaskan"}
                    </span>
                    <span>{fmtDate(wo.createdAt)} {fmtTime(wo.createdAt)}</span>
                  </div>
                </div>
              );
            })}

            {filteredWorkOrders.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <Box size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-bold">Tidak ada Work Order yang ditemukan.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Nomor & Tipe</th>
                    <th className="px-4 py-3">Produk & PIC</th>
                    <th className="px-4 py-3">Tahap Saat Ini</th>
                    <th className="px-4 py-3">Target vs Aktual</th>
                    <th className="px-4 py-3">Defect</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWorkOrders.map(wo => {
                    const stageInfo = getStageInfo(wo.currentStage);
                    const stuck = isStuck(wo);
                    const timerMs = getActiveTimerMs(wo);

                    return (
                      <tr
                        key={wo.id}
                        onClick={() => openDetail(wo)}
                        className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${
                          stuck ? "bg-red-50/30 border-l-4 border-l-red-400" : ""
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-mono font-bold text-slate-800 text-xs">{wo.woNumber}</div>
                          <div className="text-[10px] text-slate-500 font-black mt-0.5 uppercase">{wo.woType}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-800 text-xs">
                            {wo.woType === "PRODUKSI" && wo.productionTargets && wo.productionTargets.length > 0
                              ? `Churros (${wo.productionTargets.map(pt => `${pt.variantName}: ${pt.targetBatches}B`).join(", ")})`
                              : wo.productName || "Work Order"}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Users size={10} /> {wo.assignedCrewName || "Belum ditugaskan"}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${stageInfo.bg} ${stageInfo.color}`}>
                            {stageInfo.label}
                          </span>
                          {timerMs > 0 && wo.status !== "COMPLETED" && (
                            <div className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                              <Clock size={10} /> {fmtTimerMs(timerMs)}
                            </div>
                          )}
                          {wo.pausedAt && (
                            <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded ml-1">PAUSED</span>
                          )}
                          {stuck && (
                            <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded animate-pulse ml-1">STUCK</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {wo.woType === "PRODUKSI" ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-700 text-xs">{wo.summaryState?.totalTrayPrinted || 0}/{wo.targetLoyang || 0} <span className="text-slate-400 text-[10px] font-semibold">Loy</span></span>
                              <span className="text-slate-300"> · </span>
                              <span className="font-bold text-slate-700 text-xs">{wo.summaryState?.totalGoodPcs || 0} <span className="text-slate-400 text-[10px] font-semibold">Pcs</span></span>
                            </div>
                          ) : wo.woType === "PACKING_PESANAN" ? (
                            <span className="font-bold text-slate-700 text-xs">{wo.summaryState?.totalGoodPacks || 0}/{wo.targetPacks || 0} <span className="text-slate-400 text-[10px] font-semibold">Pack</span></span>
                          ) : (
                            <span className="font-bold text-slate-700 text-xs">{wo.summaryState?.totalGoodPcs || 0}/{wo.targetQty || 0} <span className="text-slate-400 text-[10px] font-semibold">{wo.targetUom}</span></span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {(wo.summaryState?.totalDefectPcs || 0) > 0 ? (
                            <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200">
                              {wo.summaryState?.totalDefectPcs} Pcs
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                            wo.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            wo.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {wo.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredWorkOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <Box size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-slate-500 font-bold">Tidak ada Work Order.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========== SIDE SHEET: WO Detail Panel ========== */}
      {detailWo && (
        <div className="fixed inset-0 z-50 animate-in fade-in">
          {/* Overlay */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeDetail} />
          {/* Panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 overflow-y-auto">
            {/* Panel Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-extrabold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">{detailWo.woNumber}</span>
                <span className="text-[10px] font-black text-slate-500 uppercase">{detailWo.woType}</span>
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  detailWo.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  detailWo.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700 border-blue-200" :
                  "bg-amber-50 text-amber-700 border-amber-200"
                }`}>{detailWo.status}</span>
              </div>
              <button type="button" onClick={closeDetail} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={16} /></button>
            </div>

            <div className="px-5 py-5 space-y-5">
              {/* Section 1: Ringkasan */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList size={14} /> Ringkasan
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                  <div>
                    <span className="text-slate-400 block text-[10px]">PIC Crew</span>
                    <span className="text-slate-800 font-extrabold flex items-center gap-1"><Users size={11} /> {detailWo.assignedCrewName || "Belum ditugaskan"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Dimulai</span>
                    <span className="text-slate-800 font-extrabold">{fmtDate(detailWo.startedAt || detailWo.createdAt)} {fmtTime(detailWo.startedAt || detailWo.createdAt)}</span>
                  </div>
                  {detailWo.completedAt && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Selesai</span>
                      <span className="text-slate-800 font-extrabold">{fmtDate(detailWo.completedAt)} {fmtTime(detailWo.completedAt)}</span>
                    </div>
                  )}
                  {detailWo.batchCode && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Batch Code</span>
                      <span className="text-slate-800 font-extrabold font-mono">{detailWo.batchCode}</span>
                    </div>
                  )}
                  {detailWo.expiredDate && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Expired</span>
                      <span className="text-slate-800 font-extrabold">{fmtDate(detailWo.expiredDate)}</span>
                    </div>
                  )}
                </div>

                {/* Target vs Aktual besar */}
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold text-xs">Target vs Aktual</span>
                  </div>
                  {detailWo.woType === "PRODUKSI" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] text-slate-400 block font-bold">Batch Adonan</span>
                        <span className="text-lg font-black text-slate-800">{detailWo.summaryState?.totalDoughBatchesDone || 0}<span className="text-slate-400 text-xs font-semibold">/{detailWo.targetBatches || 0}</span></span>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] text-slate-400 block font-bold">Loyang</span>
                        <span className="text-lg font-black text-slate-800">{detailWo.summaryState?.totalTrayPrinted || 0}<span className="text-slate-400 text-xs font-semibold">/{detailWo.targetLoyang || 0}</span></span>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] text-slate-400 block font-bold">Pack</span>
                        <span className="text-lg font-black text-emerald-700">{detailWo.summaryState?.totalGoodPacks || 0}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Total Good Pcs:</span>
                    <span className="text-slate-800 font-extrabold">{detailWo.summaryState?.totalGoodPcs || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Defect Pcs:</span>
                    <span className={`font-extrabold ${(detailWo.summaryState?.totalDefectPcs || 0) > 0 ? "text-red-600" : "text-slate-400"}`}>
                      {detailWo.summaryState?.totalDefectPcs || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Yield:</span>
                    <span className={`font-extrabold ${getYieldPct(detailWo) >= 90 ? "text-emerald-600" : getYieldPct(detailWo) >= 80 ? "text-amber-600" : "text-red-600"}`}>
                      {getYieldPct(detailWo)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Time Tracking per Step */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Timer size={14} /> Time Tracking
                </h4>
                <div className="space-y-1.5">
                  {PRODUKSI_STEPS.map((step, idx) => {
                    const isProduksi = detailWo.woType === "PRODUKSI";
                    const currentStage = detailWo.currentStage || "DOUGH_COOKING";
                    const currentIdx = isProduksi ? PRODUKSI_STEPS.findIndex(s => s.key === currentStage) : 0;
                    const isDone = idx < currentIdx;
                    const isActive = idx === currentIdx && detailWo.status !== "COMPLETED" && detailWo.status !== "CANCELLED";
                    const Icon = step.icon;
                    const stepDur = detailWo.stepDurationsMinutes?.[step.key] || 0;
                    const liveAt = isActive
                      ? (step.key === "FREEZER_CHECKPOINT" && detailWo.freezerInAt ? detailWo.freezerInAt : detailWo.currentStepStartedAt)
                      : undefined;
                    const liveMs = liveAt ? Date.now() - new Date(liveAt).getTime() : 0;

                    return (
                      <div key={step.key} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                        isActive ? "bg-emerald-50 border-emerald-200" : isDone ? "bg-white border-slate-200" : "bg-slate-50/50 border-slate-200/60"
                      }`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          isDone ? "bg-emerald-500 text-white" : isActive ? "bg-emerald-600 text-white animate-pulse" : "bg-slate-200 text-slate-400"
                        }`}>
                          {isDone ? <CheckCircle2 size={14} /> : isActive ? <span className="w-1.5 h-1.5 rounded-full bg-white" /> : <span className="w-2 h-2 rounded-full bg-slate-300" />}
                        </div>
                        <Icon size={14} className={isActive ? "text-emerald-600" : isDone ? "text-slate-500" : "text-slate-300"} />
                        <span className={`text-xs font-extrabold flex-1 ${isActive ? "text-emerald-800" : isDone ? "text-slate-600" : "text-slate-400"}`}>
                          {step.label}
                          {step.key === "FREEZER_CHECKPOINT" && (
                            <span className="ml-1 text-[10px] font-bold text-sky-500">(storage)</span>
                          )}
                        </span>
                        <span className="text-[11px] font-bold text-right shrink-0">
                          {isActive ? (
                            liveMs > 0 ? (
                              <span className="text-emerald-700 font-extrabold">{fmtTimerMs(liveMs)}</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">Dimulai</span>
                            )
                          ) : isDone ? (
                            <span className="text-slate-500">{fmtDur(stepDur)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Total durasi */}
                <div className="border-t border-slate-200 pt-2 flex justify-between text-xs font-bold">
                  <span className="text-slate-500">Total Durasi Terproses:</span>
                  <span className="text-slate-800 font-extrabold">{fmtDur(getTotalDurationMin(detailWo))}</span>
                </div>
              </div>

              {/* Section 3: Riwayat Aktivitas Crew */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <PlayCircle size={14} /> Riwayat Aktivitas Crew
                </h4>
                {loadingDetail ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-14 rounded-xl bg-white border border-slate-200 animate-pulse" />
                    ))}
                  </div>
                ) : woLogs.length > 0 ? (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {woLogs.map((log) => (
                      <div key={log.id} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-800">
                            {log.step || log.action || "Activity"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">{fmtDate(log.timestamp)} {fmtTime(log.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
                          <span className="flex items-center gap-0.5"><Users size={9} /> {log.loggedByCrewName || "Crew"}</span>
                          {(log.valueAdded || 0) > 0 && <span>Output: {log.valueAdded}</span>}
                          {(log.defectCount || 0) > 0 && <span className="text-red-600">Defect: {log.defectCount}</span>}
                          {(log.durationMinutes || 0) > 0 && <span><Clock size={9} /> {fmtDur(log.durationMinutes || 0)}</span>}
                        </div>
                        {log.notes && <p className="text-slate-400 text-[10px] italic mt-0.5">{log.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic text-center py-3">Belum ada aktivitas tercatat.</p>
                )}
              </div>

              {/* Section 4: Catatan & Info */}
              {(detailWo.notes || detailWo.batchCode || detailWo.expiredDate) && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Catatan & Info</h4>
                  {detailWo.notes && <p className="text-xs text-slate-600 font-medium">{detailWo.notes}</p>}
                  {detailWo.batchCode && (
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400">Batch Code:</span>
                      <span className="font-mono text-slate-800">{detailWo.batchCode}</span>
                    </div>
                  )}
                  {detailWo.expiredDate && (
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400">Expired:</span>
                      <span className="text-slate-800">{fmtDate(detailWo.expiredDate)}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 font-bold pt-1 border-t border-slate-200">
                    BOM bahan baku auto-deduct saat WO dirilis. Packaging materials deduct saat COMPLETED.
                  </div>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-200">
                {detailWo.status !== "COMPLETED" && detailWo.status !== "CANCELLED" && (
                  <button
                    onClick={async () => {
                      if (confirm("Yakin ingin memaksa tutup WO ini? Ini akan memotong sisa target di freezer!")) {
                        const token = await getToken();
                        await fetch(`/api/sfm/work-orders/${detailWo.id}/step`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "CLOSE_WO", currentStep: "PRE_PACK" })
                        });
                        closeDetail();
                        loadAllData();
                      }
                    }}
                    className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-sm active:scale-95 transition-all flex justify-center items-center gap-2"
                  >
                    Force Close Work Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: Create Work Order ========== */}
      {showNewWoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-lg text-slate-800">Terbitkan Work Order (SFM)</h3>
              <button onClick={() => setShowNewWoModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="create-wo-form" onSubmit={handleCreateWo} className="space-y-5">

                {/* 1. Task Type */}
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">1. Jenis Tugas *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: "PRODUKSI", label: "Produksi Dapur" },
                      { val: "REPACK_SAOS", label: "Repack Saos" },
                      { val: "REPACK_GULA", label: "Repack Gula" },
                      { val: "PACKING_PESANAN", label: "Packing Pesanan" },
                      { val: "STOCK_OPNAME", label: "Stock Opname" }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setNewWoForm({ ...newWoForm, woType: opt.val as SFMWorkOrderType, variantId: "", sourceOrderId: "", assignedCrewId: "" })}
                        className={`py-2 px-2 rounded-xl border text-[10px] sm:text-xs font-bold transition-all text-center ${
                          newWoForm.woType === opt.val ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Subjek (Varian / Pesanan) */}
                {newWoForm.woType !== "REPACK_GULA" && newWoForm.woType !== "STOCK_OPNAME" && newWoForm.woType !== "PRODUKSI" && (
                  <div>
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                      {newWoForm.woType === "PACKING_PESANAN" ? "2. Pilih Pesanan (Pending) *" : "2. Varian Produk *"}
                    </label>

                    {newWoForm.woType === "PACKING_PESANAN" ? (
                      <select
                        required
                        value={newWoForm.sourceOrderId}
                        onChange={(e) => {
                          const order = pendingOrders.find(o => o.id === e.target.value);
                          const totalQty = order?.items?.reduce((sum: number, item: any) => sum + item.qty, 0) || 0;
                          setNewWoForm({ ...newWoForm, sourceOrderId: e.target.value, targetPacks: totalQty.toString() });
                        }}
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                      >
                        <option value="" disabled>Pilih Pesanan...</option>
                        {pendingOrders.map((o) => (
                          <option key={o.id} value={o.id}>{o.customerName} - {o.orderChannel.toUpperCase()}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        required
                        value={newWoForm.variantId}
                        onChange={(e) => setNewWoForm({ ...newWoForm, variantId: e.target.value })}
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                      >
                        <option value="" disabled>Pilih Varian...</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* 2b. Assign Crew */}
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">Penanggung Jawab Crew <span className="text-slate-400 font-bold normal-case">(Opsional)</span></label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {crewList.map(c => {
                      const isSelected = newWoForm.assignedCrewIds?.includes(c.id) || newWoForm.assignedCrewId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const currentIds = newWoForm.assignedCrewIds || (newWoForm.assignedCrewId ? [newWoForm.assignedCrewId] : []);
                            const newIds = isSelected 
                              ? currentIds.filter(id => id !== c.id)
                              : [...currentIds, c.id];
                            
                            const newNames = newIds.map(id => employees.find(e => e.id === id)?.name || "").filter(Boolean).join(", ");
                            
                            setNewWoForm({
                              ...newWoForm,
                              assignedCrewIds: newIds,
                              assignedCrewId: newIds[0] || "",
                              assignedCrewName: newNames
                            });
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs font-bold transition-all ${
                            isSelected ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300"}`}>
                            {isSelected && <Check size={10} />}
                          </div>
                          <span className="truncate">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Dynamic Target Inputs based on woType */}
                <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200 space-y-4">
                  <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">3. Target (Otomatis Menyesuaikan)</label>

                  {newWoForm.woType === "PRODUKSI" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-500 block">Daftar Produksi per Varian</label>
                        <button type="button" onClick={() => setNewWoForm({ ...newWoForm, productionTargets: [...newWoForm.productionTargets, { variantId: variants[0]?.id || "", variantName: variants[0]?.name || "", targetBatches: "1" }] })} className="text-[10px] bg-slate-200 px-2 py-1 rounded text-slate-700 font-bold hover:bg-slate-300">+ Tambah</button>
                      </div>
                      {newWoForm.productionTargets.map((pt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={pt.variantId}
                            onChange={(e) => {
                              const newArr = [...newWoForm.productionTargets];
                              newArr[idx].variantId = e.target.value;
                              newArr[idx].variantName = variants.find(v => v.id === e.target.value)?.name || "";
                              setNewWoForm({ ...newWoForm, productionTargets: newArr });
                            }}
                            className="flex-1 h-9 px-2 rounded-lg border border-slate-200 text-xs font-semibold"
                          >
                            {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                          <Input
                            type="number" step="0.5" min="0.5"
                            value={pt.targetBatches}
                            onChange={(e) => {
                              const newArr = [...newWoForm.productionTargets];
                              newArr[idx].targetBatches = e.target.value;
                              setNewWoForm({ ...newWoForm, productionTargets: newArr });
                            }}
                            className="w-20 h-9 text-xs text-center font-bold"
                          />
                          <button type="button" onClick={() => setNewWoForm({ ...newWoForm, productionTargets: newWoForm.productionTargets.filter((_, i) => i !== idx) })} className="w-8 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600"><X size={14}/></button>
                        </div>
                      ))}
                      {newWoForm.productionTargets.length === 0 && <p className="text-xs text-slate-400 italic">Klik + Tambah untuk menentukan target varian</p>}
                    </div>
                  )}

                  {newWoForm.woType === "PACKING_PESANAN" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 mb-1 block">Target Kemasan (Pack)</label>
                        <Input
                          type="number"
                          min="1"
                          required
                          value={newWoForm.targetPacks}
                          onChange={(e) => setNewWoForm({ ...newWoForm, targetPacks: e.target.value })}
                          className="h-10 text-sm font-black text-slate-900 bg-white"
                        />
                        <p className="text-[10px] font-medium text-slate-400 mt-1">
                          {newWoForm.sourceOrderId ? "Otomatis diisi dari pesanan." : `Estimasi: ${parseInt(newWoForm.targetPacks || "0") * 12} Pcs`}
                        </p>
                      </div>
                    </div>
                  )}

                  {newWoForm.woType === "STOCK_OPNAME" && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 mb-1 block">Ruang Lingkup Opname</label>
                        <select
                          value={newWoForm.opnameScope}
                          onChange={(e) => setNewWoForm({ ...newWoForm, opnameScope: e.target.value as any })}
                          className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                        >
                          <option value="Semua">Semua Item Stok</option>
                          <option value="Bahan Baku">Kategori: Bahan Baku</option>
                          <option value="Kemasan">Kategori: Kemasan</option>
                          <option value="Produk Jadi">Kategori: Produk Jadi</option>
                          <option value="Spesifik">Pilih Spesifik...</option>
                        </select>
                      </div>
                      {newWoForm.opnameScope === "Spesifik" && (
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 mb-1 block">Sebutkan Item (Pisahkan dengan koma)</label>
                          <Input
                            type="text"
                            placeholder="Contoh: Terigu, Saos Coklat, Thinwall"
                            value={newWoForm.opnameItems.join(", ")}
                            onChange={(e) => setNewWoForm({ ...newWoForm, opnameItems: e.target.value.split(",").map(i => i.trim()).filter(Boolean) })}
                            className="h-10 text-sm font-bold text-slate-900 bg-white"
                            required
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {(newWoForm.woType === "REPACK_SAOS" || newWoForm.woType === "REPACK_GULA" || newWoForm.woType === "GENERAL_TASK") && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 mb-1 block">Jumlah Target</label>
                        <Input
                          type="number"
                          min="1"
                          required
                          value={newWoForm.targetQty}
                          onChange={(e) => setNewWoForm({ ...newWoForm, targetQty: e.target.value })}
                          className="h-10 text-sm font-black text-slate-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 mb-1 block">Satuan (UoM)</label>
                        <Input
                          type="text"
                          required
                          placeholder="Misal: cup, pouch"
                          value={newWoForm.targetUom}
                          onChange={(e) => setNewWoForm({ ...newWoForm, targetUom: e.target.value })}
                          className="h-10 text-sm font-black text-slate-900 bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Notes */}
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">Catatan Tambahan (Opsional)</label>
                  <textarea
                    value={newWoForm.notes}
                    onChange={(e) => setNewWoForm({ ...newWoForm, notes: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                    rows={2}
                    placeholder="Misal: Dahulukan pesanan jam 10 pagi..."
                  ></textarea>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewWoModal(false)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                form="create-wo-form"
                disabled={creatingWo}
                className="px-6 py-2.5 rounded-xl font-extrabold text-xs text-white bg-slate-900 hover:bg-black flex items-center gap-2 shadow-sm transition-all"
              >
                {creatingWo ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Terbitkan & Beri Notif
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
