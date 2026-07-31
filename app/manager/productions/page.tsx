"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  Loader2, ChefHat, Package, Calendar, Table, LayoutGrid, Plus, Check, X,
  Snowflake, AlertTriangle, RefreshCw, Search, Award, CheckCircle2, Tag
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/formatters";
import type { WorkOrder, Variant } from "@/types";

function fmt(n: number) {
  return formatNumber(n);
}

export default function ManagerProductionsPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"wo_produksi" | "audit_ledger">("wo_produksi");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVariantFilter, setSelectedVariantFilter] = useState("all");

  // Data States
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);

  // Output Logging Modal
  const [activeWoForLog, setActiveWoForLog] = useState<{ wo: WorkOrder; action: "GOOD_OUTPUT" | "SCRAP" } | null>(null);
  const [logQty, setLogQty] = useState("10");
  const [scrapReason, setScrapReason] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);

  // New WO Modal
  const [showNewWoModal, setShowNewWoModal] = useState(false);
  const [newWoForm, setNewWoForm] = useState({
    variantId: "",
    targetPacks: "50",
    notes: "",
  });
  const [creatingWo, setCreatingWo] = useState(false);

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
      const activeDateStr = activeTab === "audit_ledger" && date ? date : "";
      const [woRes, varRes] = await Promise.all([
        fetchWithAuth(`/api/sfm/work-orders?date=${activeDateStr}&search=${encodeURIComponent(searchQuery)}`),
        fetchWithAuth("/api/variants"),
      ]);

      if (woRes.ok) setWorkOrders(await woRes.json());
      if (varRes.ok) setVariants(await varRes.json());
    } catch (err) {
      console.error("loadAllData error:", err);
    } finally {
      setLoading(false);
    }
  }, [date, activeTab, searchQuery, fetchWithAuth]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Filter Work Orders by Variant Filter Selection
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((w) => {
      if (selectedVariantFilter !== "all") {
        const matchesVariant = w.variantIds?.includes(selectedVariantFilter) || w.productId === selectedVariantFilter;
        if (!matchesVariant) return false;
      }
      return true;
    });
  }, [workOrders, selectedVariantFilter]);

  // Executive Metric Calculations
  const metrics = useMemo(() => {
    const totalGoodPacks = filteredWorkOrders.reduce((sum, w) => sum + (w.summaryState?.totalGoodPacks || 0), 0);
    const totalDefectPacks = filteredWorkOrders.reduce((sum, w) => sum + (w.summaryState?.totalDefectPacks || 0), 0);
    const totalProduced = totalGoodPacks + totalDefectPacks;
    const yieldRate = totalProduced > 0 ? Number(((totalGoodPacks / totalProduced) * 100).toFixed(1)) : 100;
    const totalFreezerLoyang = filteredWorkOrders.reduce((sum, w) => sum + (w.summaryState?.totalTrayInFreezer || 0), 0);

    return {
      totalGoodPacks,
      totalDefectPacks,
      yieldRate,
      totalFreezerLoyang,
    };
  }, [filteredWorkOrders]);

  async function handleCreateWo() {
    setCreatingWo(true);
    try {
      const selectedVar = variants.find(v => v.id === newWoForm.variantId);
      const res = await fetchWithAuth("/api/sfm/work-orders", {
        method: "POST",
        body: JSON.stringify({
          productId: newWoForm.variantId || "churros-frozen",
          productName: selectedVar ? `Churros (${selectedVar.name})` : "Churros Frozen",
          variantIds: newWoForm.variantId ? [newWoForm.variantId] : [],
          targetPacks: parseInt(newWoForm.targetPacks) || 50,
          notes: newWoForm.notes,
        }),
      });

      if (res.ok) {
        setShowNewWoModal(false);
        setNewWoForm({ variantId: "", targetPacks: "50", notes: "" });
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
      const res = await fetchWithAuth(`/api/sfm/work-orders/${activeWoForLog.wo.id}/log`, {
        method: "POST",
        body: JSON.stringify({
          action: activeWoForLog.action,
          valueAdded: parseFloat(logQty) || 0,
          defectCount: activeWoForLog.action === "SCRAP" ? (parseInt(logQty) || 1) : 0,
          defectReason: scrapReason,
          notes: logNotes,
        }),
      });

      if (res.ok) {
        setActiveWoForLog(null);
        setLogQty("10");
        setScrapReason("");
        setLogNotes("");
        await loadAllData();
      }
    } finally {
      setSubmittingLog(false);
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
                  Laporan & Operasional Produksi
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  Standard Shop Floor Execution & Daily Production Audit Ledger
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

          {/* Search, Filter Varian & Tabs Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
              {[
                { key: "wo_produksi", label: "Work Order Produksi", icon: ChefHat },
                { key: "audit_ledger", label: "Laporan Audit & Riwayat", icon: Award },
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
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Product/Variant Search Filter */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Varian (Original, Keju...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 pr-3 w-40 sm:w-52 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>

              {/* Variant Dropdown Filter */}
              <select
                value={selectedVariantFilter}
                onChange={(e) => setSelectedVariantFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="all">Semua Varian Rasa</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>

              {activeTab === "audit_ledger" && (
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-9 pl-8 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              )}

              {/* View Switcher Toggle (Tabel vs Kartu) */}
              <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    viewMode === "table" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-500 hover:bg-slate-100"
                  }`}
                  title="Tampilan Tabel"
                >
                  <Table size={14} /> <span className="hidden md:inline">Tabel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    viewMode === "grid" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-500 hover:bg-slate-100"
                  }`}
                  title="Tampilan Kartu"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-black shrink-0">
              <Package size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Total Hasil Produksi</span>
              <p className="text-base sm:text-lg font-black text-slate-800 tabular-nums">{fmt(metrics.totalGoodPacks)} Pack</p>
              <span className="text-[10px] font-bold text-emerald-600 block truncate">Good Quality Output</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center font-black shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Cacat / Scrap (Waste)</span>
              <p className="text-base sm:text-lg font-black text-rose-700 tabular-nums">{fmt(metrics.totalDefectPacks)} Pack</p>
              <span className="text-[10px] font-bold text-rose-500 block truncate">Audit HPP & Scrap Transparan</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black shrink-0">
              <Snowflake size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Stok Buffer Freezer</span>
              <p className="text-base sm:text-lg font-black text-slate-800 tabular-nums">{fmt(metrics.totalFreezerLoyang)} Loyang Beku</p>
              <span className="text-[10px] font-bold text-indigo-600 block truncate">WIP Ready for Order Packing</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center font-black shrink-0">
              <Award size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">Tingkat Keberhasilan</span>
              <p className="text-base sm:text-lg font-black text-slate-800 tabular-nums">{metrics.yieldRate}% Yield</p>
              <span className="text-[10px] font-bold text-amber-600 block truncate">Rasio Pack Bagus vs Scrap</span>
            </div>
          </div>
        </div>

        {/* ── TAB 1: WORK ORDER PRODUKSI ── */}
        {activeTab === "wo_produksi" && (
          <div className="space-y-4 animate-in fade-in">
            {viewMode === "table" ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto hide-scrollbar">
                  <table className="min-w-[850px] w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-extrabold">
                        <th className="py-3.5 px-4 font-extrabold">WO Monospace</th>
                        <th className="py-3.5 px-4 font-extrabold">Nama Produk & Varian</th>
                        <th className="py-3.5 px-4 font-extrabold text-right">Target Pack</th>
                        <th className="py-3.5 px-4 font-extrabold text-right">Hasil Bagus</th>
                        <th className="py-3.5 px-4 font-extrabold text-right">Cacat (Scrap)</th>
                        <th className="py-3.5 px-4 font-extrabold">Status WO</th>
                        <th className="py-3.5 px-4 font-extrabold">Crew Pelaksana</th>
                        <th className="py-3.5 px-4 font-extrabold text-center">Catat Hasil / Scrap</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {filteredWorkOrders.map((wo) => (
                        <tr key={wo.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-3.5 px-4 font-mono font-extrabold text-slate-500 whitespace-nowrap">
                            {wo.woNumber}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors">
                              {wo.productName}
                            </div>
                            {wo.notes && <div className="text-[10px] text-slate-400 font-medium truncate max-w-xs">{wo.notes}</div>}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-800">
                            {fmt(wo.targetPacks)} Pack
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-emerald-600">
                            {fmt(wo.summaryState?.totalGoodPacks || 0)} Pack
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-rose-600">
                            {fmt(wo.summaryState?.totalDefectPacks || 0)} Pack
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                              wo.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              wo.status === "IN_PROGRESS" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-slate-100 text-slate-700 border-slate-200"
                            }`}>
                              {wo.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-600">
                            {wo.assignedCrewName}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWoForLog({ wo, action: "GOOD_OUTPUT" });
                                  setLogQty("10");
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center gap-1 shadow-2xs"
                              >
                                <CheckCircle2 size={12} /> Catat Hasil
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWoForLog({ wo, action: "SCRAP" });
                                  setLogQty("1");
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-[11px] flex items-center gap-1 border border-rose-200"
                              >
                                <AlertTriangle size={12} /> Scrap
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredWorkOrders.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                            Belum ada Work Order produksi ditemukan. Klik "+ Buat Work Order" di kanan atas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Mobile Grab/Gojek PWA Card View */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWorkOrders.map((wo) => (
                  <div key={wo.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/60">
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
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">Crew Pelaksana: {wo.assignedCrewName}</p>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs font-bold">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Target Production:</span>
                          <span className="text-slate-800 font-extrabold">{fmt(wo.targetPacks)} Pack</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Hasil Produksi Bagus:</span>
                          <span className="text-emerald-700 font-extrabold">{fmt(wo.summaryState?.totalGoodPacks || 0)} Pack</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Cacat / Scrap (Waste):</span>
                          <span className="text-rose-600 font-extrabold">{fmt(wo.summaryState?.totalDefectPacks || 0)} Pack</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWoForLog({ wo, action: "GOOD_OUTPUT" });
                          setLogQty("10");
                        }}
                        className="py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1 shadow-xs transition-all active:scale-98"
                      >
                        <CheckCircle2 size={14} /> Catat Hasil
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWoForLog({ wo, action: "SCRAP" });
                          setLogQty("1");
                        }}
                        className="py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs flex items-center justify-center gap-1 border border-rose-200 transition-all active:scale-98"
                      >
                        <AlertTriangle size={14} /> Scrap
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: LAPORAN AUDIT & RIWAYAT PRODUKSI (DAILY PRODUCTION AUDIT LEDGER) ── */}
        {activeTab === "audit_ledger" && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black">
                    <Award size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">Daily Production Audit Ledger</h3>
                    <p className="text-xs font-semibold text-slate-400">Laporan audit rinci riwayat produksi per tanggal & filtrasi varian produk</p>
                  </div>
                </div>

                {selectedVariantFilter !== "all" && (
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                    <Tag size={14} className="text-indigo-600" />
                    <span className="text-xs font-extrabold text-indigo-900">
                      Menampilkan Riwayat Produksi Varian: <u>{variants.find(v => v.id === selectedVariantFilter)?.name || selectedVariantFilter}</u>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedVariantFilter("all")}
                      className="text-indigo-600 hover:text-indigo-900 font-black ml-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto hide-scrollbar">
                <table className="min-w-[850px] w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-extrabold">
                      <th className="py-3.5 px-4 font-extrabold">Tanggal & Waktu</th>
                      <th className="py-3.5 px-4 font-extrabold">Kode WO</th>
                      <th className="py-3.5 px-4 font-extrabold">Nama Produk & Varian Rasa</th>
                      <th className="py-3.5 px-4 font-extrabold text-right">Hasil Bagus (Good)</th>
                      <th className="py-3.5 px-4 font-extrabold text-right">Defect (Scrap)</th>
                      <th className="py-3.5 px-4 font-extrabold">Status WO</th>
                      <th className="py-3.5 px-4 font-extrabold">Crew Pelaksana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {filteredWorkOrders.map((wo) => (
                      <tr key={wo.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(wo.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-extrabold text-slate-700 whitespace-nowrap">
                          {wo.woNumber}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-extrabold text-slate-800">{wo.productName}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-emerald-600">
                          {fmt(wo.summaryState?.totalGoodPacks || 0)} Pack
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-black text-rose-600">
                          {fmt(wo.summaryState?.totalDefectPacks || 0)} Pack
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            wo.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {wo.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-600">
                          {wo.assignedCrewName}
                        </td>
                      </tr>
                    ))}

                    {filteredWorkOrders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                          Tidak ada catatan audit produksi ditemukan untuk filter ini.
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

      {/* Modal / Drawer Catat Hasil Produksi / Scrap (2-Step Generic Action) */}
      {activeWoForLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-extrabold text-slate-400 block">{activeWoForLog.wo.woNumber}</span>
                <h3 className="text-base font-black text-slate-800">
                  {activeWoForLog.action === "GOOD_OUTPUT" ? "Catat Hasil Produksi Bagus" : "Catat Produk Cacat / Scrap"}
                </h3>
              </div>
              <button type="button" onClick={() => setActiveWoForLog(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">
                  {activeWoForLog.action === "GOOD_OUTPUT" ? "Jumlah Hasil Produksi (Pack Bagus)" : "Jumlah Item Rusak / Cacat (Pack)"}
                </label>
                <Input
                  type="number"
                  placeholder="Nilai kustom..."
                  value={logQty}
                  onChange={(e) => setLogQty(e.target.value)}
                  className={`h-11 font-black text-sm ${activeWoForLog.action === "GOOD_OUTPUT" ? "text-emerald-700" : "text-rose-600"}`}
                />
                
                {/* SAP/Odoo Dynamic Quick Preset Chips */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {["1", "5", "10", "25", "50"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setLogQty(chip)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition-all ${
                        logQty === chip
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      +{chip} Pack
                    </button>
                  ))}
                </div>
              </div>

              {activeWoForLog.action === "SCRAP" && (
                <div>
                  <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Alasan Cacat / Scrap</label>
                  <Input
                    placeholder="Contoh: Patah saat pencetakan, Gosong..."
                    value={scrapReason}
                    onChange={(e) => setScrapReason(e.target.value)}
                    className="h-10 text-xs font-bold"
                  />
                </div>
              )}

              <div>
                <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Catatan Tambahan</label>
                <Input
                  placeholder="Catatan pengerjaan..."
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="h-10 text-xs font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSubmitLog}
                  disabled={submittingLog}
                  className={`w-full h-11 rounded-2xl text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md ${
                    activeWoForLog.action === "GOOD_OUTPUT" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {submittingLog ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 
                  {activeWoForLog.action === "GOOD_OUTPUT" ? "Simpan Hasil Produksi" : "Simpan Log Scrap"}
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
              <div>
                <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Pilih Varian Produk</label>
                <select
                  value={newWoForm.variantId}
                  onChange={(e) => setNewWoForm(p => ({ ...p, variantId: e.target.value }))}
                  className="h-11 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-extrabold text-xs text-slate-800"
                >
                  <option value="">Semua Varian / Generic Churros</option>
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Target Quantity (Pack)</label>
                <Input
                  type="number"
                  value={newWoForm.targetPacks}
                  onChange={(e) => setNewWoForm(p => ({ ...p, targetPacks: e.target.value }))}
                  className="h-10 text-xs font-bold"
                />
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
