"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  Loader2, ChefHat, Package, Calendar, Table, LayoutGrid, Plus, Check, X,
  Clock, Snowflake, Flame, Layers, Award, AlertTriangle, ShieldCheck, RefreshCw,
  TrendingUp, CheckCircle2, SlidersHorizontal, ArrowRight, UserCheck, Star
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/formatters";
import type { WorkOrder, WorkOrderLog, CrewKpiLog, Variant, Ingredient } from "@/types";

function fmt(n: number) {
  return formatNumber(n);
}

export default function ManagerProductionsPage() {
  const { getToken, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"wo_produksi" | "prepacking" | "packing" | "kpi_audit">("wo_produksi");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Data States
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [kpiLogs, setKpiLogs] = useState<CrewKpiLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Active WO Stepper / Logging Drawer
  const [activeWoForLog, setActiveWoForLog] = useState<WorkOrder | null>(null);
  const [logForm, setLogForm] = useState<{
    stage: "DOUGH_MIXING" | "TRAY_PRINTING" | "FREEZER_CHECKPOINT" | "FINAL_PACKING";
    valueAdded: string;
    unit: "BATCH" | "LOYANG" | "PACK" | "PCS";
    defectCount: string;
    defectReason: string;
    notes: string;
  }>({
    stage: "DOUGH_MIXING",
    valueAdded: "1.5",
    unit: "BATCH",
    defectCount: "0",
    defectReason: "",
    notes: "",
  });
  const [submittingLog, setSubmittingLog] = useState(false);

  // New WO Modal
  const [showNewWoModal, setShowNewWoModal] = useState(false);
  const [newWoForm, setNewWoForm] = useState({
    targetBatches: "3",
    targetLoyang: "30",
    targetPacks: "150",
    notes: "",
  });
  const [creatingWo, setCreatingWo] = useState(false);

  // Neatness Evaluation Modal (Owner/Manager)
  const [evalKpiWo, setEvalKpiWo] = useState<WorkOrder | null>(null);
  const [neatnessChecklist, setNeatnessChecklist] = useState({
    workstationClean: true,
    trayArrangementNeat: true,
    freezerOrganization: true,
    vacuumSealTight: true,
  });
  const [submittingKpiEval, setSubmittingKpiEval] = useState(false);

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const token = await getToken();
      return fetch(url, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
      });
    },
    [getToken]
  );

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [woRes, varRes, ingRes, kpiRes] = await Promise.all([
        fetchWithAuth(`/api/sfm/work-orders?date=${date}`),
        fetchWithAuth("/api/variants"),
        fetchWithAuth("/api/ingredients"),
        fetchWithAuth(`/api/sfm/kpi?date=${date}`),
      ]);

      if (woRes.ok) setWorkOrders(await woRes.json());
      if (varRes.ok) setVariants(await varRes.json());
      if (ingRes.ok) setIngredients(await ingRes.json());
      if (kpiRes.ok) setKpiLogs(await kpiRes.json());
    } catch (err) {
      console.error("loadAllData error:", err);
    } finally {
      setLoading(false);
    }
  }, [date, fetchWithAuth]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Executive Metric Calculations
  const metrics = useMemo(() => {
    const totalWo = workOrders.length;
    const completedWo = workOrders.filter(w => w.status === "COMPLETED").length;
    const totalLoyang = workOrders.reduce((sum, w) => sum + (w.summaryState?.totalTrayPrinted || 0), 0);
    const targetLoyang = workOrders.reduce((sum, w) => sum + (w.targetLoyang || 0), 0) || 1;
    const efficiencyRate = Math.min(100, Math.round((totalLoyang / targetLoyang) * 100));

    const totalFreezerLoyang = workOrders.reduce((sum, w) => sum + (w.summaryState?.totalTrayInFreezer || 0), 0);
    const totalGoodPacks = workOrders.reduce((sum, w) => sum + (w.summaryState?.totalGoodPacks || 0), 0);
    const totalDefectPacks = workOrders.reduce((sum, w) => sum + (sum + (w.summaryState?.totalDefectPacks || 0)), 0);

    return {
      totalWo,
      completedWo,
      totalLoyang,
      targetLoyang,
      efficiencyRate,
      totalFreezerLoyang,
      totalGoodPacks,
      totalDefectPacks,
    };
  }, [workOrders]);

  async function handleCreateWo() {
    setCreatingWo(true);
    try {
      const res = await fetchWithAuth("/api/sfm/work-orders", {
        method: "POST",
        body: JSON.stringify({
          targetBatches: parseFloat(newWoForm.targetBatches) || 3,
          targetLoyang: parseInt(newWoForm.targetLoyang) || 30,
          targetPacks: parseInt(newWoForm.targetPacks) || 150,
          notes: newWoForm.notes,
        }),
      });

      if (res.ok) {
        setShowNewWoModal(false);
        setNewWoForm({ targetBatches: "3", targetLoyang: "30", targetPacks: "150", notes: "" });
        await loadAllData();
      }
    } finally {
      setCreatingWo(false);
    }
  }

  async function handleSubmitLog() {
    if (!activeWoForLog) return;
    setSubmittingLog(true);
    try {
      const res = await fetchWithAuth(`/api/sfm/work-orders/${activeWoForLog.id}/log`, {
        method: "POST",
        body: JSON.stringify({
          stage: logForm.stage,
          valueAdded: parseFloat(logForm.valueAdded) || 0,
          unit: logForm.unit,
          defectCount: parseInt(logForm.defectCount) || 0,
          defectReason: logForm.defectReason,
          notes: logForm.notes,
        }),
      });

      if (res.ok) {
        setActiveWoForLog(null);
        setLogForm({ stage: "DOUGH_MIXING", valueAdded: "1.5", unit: "BATCH", defectCount: "0", defectReason: "", notes: "" });
        await loadAllData();
      }
    } finally {
      setSubmittingLog(false);
    }
  }

  async function handleSubmitKpiEval() {
    if (!evalKpiWo) return;
    setSubmittingKpiEval(true);
    try {
      const res = await fetchWithAuth("/api/sfm/kpi", {
        method: "POST",
        body: JSON.stringify({
          workOrderId: evalKpiWo.id,
          crewId: evalKpiWo.assignedCrewId,
          crewName: evalKpiWo.assignedCrewName,
          goodPacks: evalKpiWo.summaryState?.totalGoodPacks || 50,
          defectPacks: evalKpiWo.summaryState?.totalDefectPacks || 0,
          totalTargetPacks: evalKpiWo.targetPacks,
          neatnessChecklist,
        }),
      });

      if (res.ok) {
        setEvalKpiWo(null);
        await loadAllData();
      }
    } finally {
      setSubmittingKpiEval(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      {/* Sticky Native App Header (Grab/Gojek PWA Theme) */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ChefHat size={20} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">
                  Hub Operasional Produksi & Pengemasan
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  Shop Floor Execution & Monitoring Batch Adonan, Freezer, & Final Packing
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadAllData}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 flex items-center justify-center text-slate-700 transition-all active:scale-95"
                title="Refresh Data"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>

              <button
                type="button"
                onClick={() => setShowNewWoModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Buat Work Order</span>
              </button>
            </div>
          </div>

          {/* Date Selector & Tabs Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div className="overflow-x-auto hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
              <div className="flex items-center gap-1.5 min-w-max">
                {[
                  { key: "wo_produksi", label: "👩‍🍳 Produksi Loyang", icon: ChefHat },
                  { key: "prepacking", label: "❄️ Pre-Packing Freezer", icon: Snowflake },
                  { key: "packing", label: "🛍️ Repack & Packing", icon: Package },
                  { key: "kpi_audit", label: "📊 KPI & Audit Owner", icon: Award },
                ].map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key as any)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                        isActive
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-100/80 text-slate-600 border-slate-200/80 hover:bg-slate-200/60"
                      }`}
                    >
                      <Icon size={14} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 pl-8 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>

              {/* View Switcher Toggle (Tabel vs Kartu) */}
              <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    viewMode === "table" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-500 hover:bg-slate-100"
                  }`}
                  title="Tampilan Tabel (List View)"
                >
                  <Table size={14} /> <span className="hidden md:inline">Tabel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    viewMode === "grid" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-500 hover:bg-slate-100"
                  }`}
                  title="Tampilan Kartu (Grid View)"
                >
                  <LayoutGrid size={14} /> <span className="hidden md:inline">Kartu</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 md:px-8 max-w-6xl mx-auto space-y-4 pt-5">
        {/* Executive Metric Cards Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center font-black shrink-0">
              <ChefHat size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Output Produksi Loyang</span>
              <p className="text-lg font-black text-slate-800 tabular-nums">
                {metrics.totalLoyang} / {metrics.targetLoyang} Loyang
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${metrics.efficiencyRate}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black shrink-0">
              <Snowflake size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Stok Buffer Freezer</span>
              <p className="text-lg font-black text-slate-800 tabular-nums">{metrics.totalFreezerLoyang} Loyang Beku</p>
              <span className="text-[10px] font-bold text-indigo-600">Siap Dikeluarkan untuk Packing</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-black shrink-0">
              <Package size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Hasil Vacuum Pack Bagus</span>
              <p className="text-lg font-black text-slate-800 tabular-nums">{metrics.totalGoodPacks} Pack Siap Jual</p>
              <span className="text-[10px] font-bold text-emerald-600">100% Quality Checked</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center font-black shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Defect / Rusak (Scrap)</span>
              <p className="text-lg font-black text-rose-700 tabular-nums">{metrics.totalDefectPacks} Pack Rusak</p>
              <span className="text-[10px] font-bold text-rose-500">Audit HPP & Scrap Transparan</span>
            </div>
          </div>
        </div>

        {/* ── TAB 1: WORK ORDER & PRODUKSI LOYANG ── */}
        {activeTab === "wo_produksi" && (
          <div className="space-y-4 animate-in fade-in">
            {viewMode === "table" ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-extrabold">
                        <th className="py-3.5 px-4 font-extrabold">WO Monospace</th>
                        <th className="py-3.5 px-4 font-extrabold">Nama Produk</th>
                        <th className="py-3.5 px-4 font-extrabold text-right">Target Adonan</th>
                        <th className="py-3.5 px-4 font-extrabold text-right">Target Loyang</th>
                        <th className="py-3.5 px-4 font-extrabold text-right">Loyang Terbuat</th>
                        <th className="py-3.5 px-4 font-extrabold">Status Stage</th>
                        <th className="py-3.5 px-4 font-extrabold">Crew Dapur</th>
                        <th className="py-3.5 px-4 font-extrabold text-center">Action Incremental</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {workOrders.map((wo) => (
                        <tr key={wo.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-3.5 px-4 font-mono font-extrabold text-slate-500 whitespace-nowrap">
                            {wo.woNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors">
                              {wo.productName}
                            </div>
                            {wo.notes && <div className="text-[10px] text-slate-400 font-medium">{wo.notes}</div>}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-800">
                            {wo.summaryState?.totalDoughBatchesDone || 0} / {wo.targetBatches} Batch
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-800">
                            {wo.targetLoyang} Loyang
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-amber-600">
                            {wo.summaryState?.totalTrayPrinted || 0} Loyang
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                              wo.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              wo.status === "IN_PROGRESS" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-slate-100 text-slate-700 border-slate-200"
                            }`}>
                              {wo.currentStage} ({wo.status})
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-600">
                            {wo.assignedCrewName}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveWoForLog(wo);
                                setLogForm({ stage: "DOUGH_MIXING", valueAdded: "1.5", unit: "BATCH", defectCount: "0", defectReason: "", notes: "" });
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-2xs"
                            >
                              <Plus size={12} /> Log Task Incremental
                            </button>
                          </td>
                        </tr>
                      ))}

                      {workOrders.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                            Belum ada Work Order produksi untuk tanggal ini. Klik "+ Buat Work Order" di kanan atas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Mobile Grab/Gojek PWA Card View */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {workOrders.map((wo) => (
                  <div key={wo.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/60">
                          {wo.woNumber}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          wo.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {wo.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-black text-slate-800">{wo.productName}</h3>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">Crew Penanggung Jawab: {wo.assignedCrewName}</p>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs font-bold">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Adonan Selesai:</span>
                          <span className="text-slate-800 font-extrabold">{wo.summaryState?.totalDoughBatchesDone || 0} / {wo.targetBatches} Batch</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Loyang Dicetak:</span>
                          <span className="text-amber-700 font-extrabold">{wo.summaryState?.totalTrayPrinted || 0} / {wo.targetLoyang} Loyang</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Pack Bagus (Vacuum):</span>
                          <span className="text-emerald-700 font-extrabold">{wo.summaryState?.totalGoodPacks || 0} / {wo.targetPacks} Pack</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveWoForLog(wo);
                        setLogForm({ stage: "DOUGH_MIXING", valueAdded: "1.5", unit: "BATCH", defectCount: "0", defectReason: "", notes: "" });
                      }}
                      className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
                    >
                      <Plus size={16} /> Input Task Incremental (+1.5 Adonan / +5 Loyang)
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: PRE-PACKING & FREEZER BUFFER ── */}
        {activeTab === "prepacking" && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-black">
                  <Snowflake size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Manajemen Stok Buffer Pre-Packing Freezer</h3>
                  <p className="text-xs font-semibold text-slate-400">Churros polos hasil cetak loyang yang dibekukan di freezer sebelum diberi saos glaze</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {workOrders.map((w) => (
                  <div key={w.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-extrabold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {w.woNumber}
                      </span>
                      <span className="text-xs font-extrabold text-indigo-600">
                        {w.freezerInAt ? `Freezer In: ${new Date(w.freezerInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Belum Beku'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800">{w.productName}</h4>
                      <p className="text-xs font-semibold text-slate-500">Stok Loyang Beku: <strong className="text-indigo-700 font-black">{w.summaryState?.totalTrayInFreezer || 0} Loyang</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: REPACK & FINAL PACKING (SAUS GLAZE & CINNAMON) ── */}
        {activeTab === "packing" && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-black">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Repack Saos Glaze, Gula Tabur & Packing Pesanan</h3>
                  <p className="text-xs font-semibold text-slate-400">Proses finishing pemberian saus glaze, gula kayu manis, & vacuum pack akhir</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
                  <h4 className="font-extrabold text-sm text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" /> Aturan Glaze & Gula Tabur
                  </h4>
                  <p className="text-slate-600">
                    Saus Glaze (Pouch/Cup) dan Gula Kayu Manis Tabur <strong>hanya disiapkan saat proses Order Packing</strong> agar churros di freezer tetap renyah dan kualitas terjamin.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                  <h4 className="font-extrabold text-sm text-amber-900 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600" /> Transparansi Defect (Scrap)
                  </h4>
                  <p className="text-slate-600">
                    Setiap churros yang patah atau rusak saat pengemasan dicatat ke dalam log Defect untuk perhitungan HPP & transparansi stok akhir.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: AUDIT KPI & RIWAYAT OWNER ── */}
        {activeTab === "kpi_audit" && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center font-black">
                  <Award size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Evaluasi Performa & Auditing KPI Kru</h3>
                  <p className="text-xs font-semibold text-slate-400">Parameter Kecepatan, Ketepatan Yield Rate, & Rating Evaluasi Kerapihan oleh Owner/Manager</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-extrabold">
                      <th className="py-3.5 px-4 font-extrabold">Tanggal</th>
                      <th className="py-3.5 px-4 font-extrabold">Nama Kru</th>
                      <th className="py-3.5 px-4 font-extrabold text-right">Durasi Real</th>
                      <th className="py-3.5 px-4 font-extrabold text-right">Yield Rate %</th>
                      <th className="py-3.5 px-4 font-extrabold text-right">Skor Kerapihan</th>
                      <th className="py-3.5 px-4 font-extrabold text-right">Skor KPI Akhir</th>
                      <th className="py-3.5 px-4 font-extrabold text-center">Evaluasi Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {kpiLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-extrabold text-slate-500 whitespace-nowrap">{log.date}</td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-800 whitespace-nowrap">{log.crewName}</td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-800">{log.durationMinutes} Menit</td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-emerald-600">{log.yieldRatePercentage}%</td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-800">{log.neatnessScore}/100</td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-indigo-600 text-sm">{log.finalKpiScore} Pts</td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Verified OK
                          </span>
                        </td>
                      </tr>
                    ))}

                    {kpiLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                          Belum ada catatan evaluasi KPI kru pada tanggal ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal / Drawer Input Log Incremental Task (Untuk Kru) */}
      {activeWoForLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-extrabold text-slate-400 block">{activeWoForLog.woNumber}</span>
                <h3 className="text-base font-black text-slate-800">Catat Incremental Task Dapur</h3>
              </div>
              <button type="button" onClick={() => setActiveWoForLog(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Tahap Aktivitas (Checkpoint Stage)</label>
                <select
                  value={logForm.stage}
                  onChange={(e) => setLogForm(p => ({ ...p, stage: e.target.value as any }))}
                  className="h-11 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-extrabold text-xs text-slate-800"
                >
                  <option value="DOUGH_MIXING">1. Pembuatan Adonan (Batch Mixing)</option>
                  <option value="TRAY_PRINTING">2. Cetak Churros Ke Loyang (Shaping)</option>
                  <option value="FREEZER_CHECKPOINT">3. Masukkan Loyang Ke Freezer</option>
                  <option value="FINAL_PACKING">4. Vacuum Pack & Label (Final Pack)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Jumlah Tambahan (+Value)</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Contoh: 1.5"
                    value={logForm.valueAdded}
                    onChange={(e) => setLogForm(p => ({ ...p, valueAdded: e.target.value }))}
                    className="h-11 font-black text-sm text-indigo-700"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Defect / Patah (Scrap)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={logForm.defectCount}
                    onChange={(e) => setLogForm(p => ({ ...p, defectCount: e.target.value }))}
                    className="h-11 font-black text-sm text-rose-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Catatan Kru / Keterangan</label>
                <Input
                  placeholder="Catatan pengerjaan / alasan churros patah..."
                  value={logForm.notes}
                  onChange={(e) => setLogForm(p => ({ ...p, notes: e.target.value }))}
                  className="h-11 font-bold text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSubmitLog}
                  disabled={submittingLog}
                  className="w-full h-11 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md"
                >
                  {submittingLog ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Incremental Task Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Drawer Buat Work Order Baru (Owner/Manager) */}
      {showNewWoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">Buat Work Order Produksi Baru</h3>
              <button type="button" onClick={() => setShowNewWoModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Target Batch</label>
                  <Input
                    type="number"
                    value={newWoForm.targetBatches}
                    onChange={(e) => setNewWoForm(p => ({ ...p, targetBatches: e.target.value }))}
                    className="h-10 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Target Loyang</label>
                  <Input
                    type="number"
                    value={newWoForm.targetLoyang}
                    onChange={(e) => setNewWoForm(p => ({ ...p, targetLoyang: e.target.value }))}
                    className="h-10 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Target Pack</label>
                  <Input
                    type="number"
                    value={newWoForm.targetPacks}
                    onChange={(e) => setNewWoForm(p => ({ ...p, targetPacks: e.target.value }))}
                    className="h-10 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Catatan Penugasan</label>
                <Input
                  placeholder="Catatan khusus dari Owner..."
                  value={newWoForm.notes}
                  onChange={(e) => setNewWoForm(p => ({ ...p, notes: e.target.value }))}
                  className="h-10 text-xs font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCreateWo}
                  disabled={creatingWo}
                  className="w-full h-11 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md"
                >
                  {creatingWo ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Terbitkan Work Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
