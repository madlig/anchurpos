"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  Loader2, ChefHat, Package, Calendar, Table, LayoutGrid, Plus, Check, X,
  Snowflake, AlertTriangle, RefreshCw, Search, Award, CheckCircle2, Tag, Eye, Clock, Layers, Box
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/formatters";
import type { WorkOrder, Variant, SFMWorkOrderType } from "@/types";

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

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showNewWoModal, setShowNewWoModal] = useState(false);
  const [creatingWo, setCreatingWo] = useState(false);
  const [newWoForm, setNewWoForm] = useState({
    woType: "PRODUKSI" as SFMWorkOrderType,
    variantId: "",
    targetBatches: "3", // For PRODUKSI
    targetPacks: "48", // For PACKING
    targetQty: "100", // For REPACK
    targetUom: "cup", // For REPACK
    notes: "",
    productionTargets: [] as { variantId: string; variantName: string; targetBatches: string }[],
    opnameScope: "Semua" as "Semua" | "Bahan Baku" | "Kemasan" | "Produk Jadi" | "Spesifik",
    opnameItems: [] as string[],
    sourceOrderId: "",
  });

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    });
  }, [getToken]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const dateParams = activeTab === "audit_ledger" 
        ? `startDate=${startDate}&endDate=${endDate}` 
        : "";
      const [woRes, varRes, ordersRes] = await Promise.all([
        fetchWithAuth(`/api/sfm/work-orders?${dateParams}&search=${encodeURIComponent(searchQuery)}`),
        fetchWithAuth("/api/variants"),
        fetchWithAuth("/api/orders"),
      ]);

      if (woRes.ok) setWorkOrders(await woRes.json());
      if (varRes.ok) setVariants(await varRes.json());
      if (ordersRes.ok) {
        const allOrders = await ordersRes.json();
        setPendingOrders(Array.isArray(allOrders) ? allOrders.filter(o => o.status === "pending" && !o.hasWorkOrder) : []);
      }
    } catch (err) {
      console.error("loadAllData error:", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, activeTab, searchQuery, fetchWithAuth]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((w) => {
      if (selectedVariantFilter !== "all") {
        const matchesVariant = w.variantIds?.includes(selectedVariantFilter) || w.productId === selectedVariantFilter;
        if (!matchesVariant) return false;
      }
      if (selectedWoTypeFilter !== "all") {
        if ((w.woType || "PRODUKSI") !== selectedWoTypeFilter) return false;
      }
      return true;
    });
  }, [workOrders, selectedVariantFilter, selectedWoTypeFilter]);

  async function handleCreateWo(e: React.FormEvent) {
    e.preventDefault();
    setCreatingWo(true);
    try {
      const selectedVar = variants.find(v => v.id === newWoForm.variantId);
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
          notes: newWoForm.notes,
        }),
      });

      if (res.ok) {
        setShowNewWoModal(false);
        setNewWoForm({ 
          woType: "PRODUKSI", variantId: "", targetBatches: "3", targetPacks: "48", targetQty: "100", targetUom: "cup", notes: "",
          productionTargets: [], opnameScope: "Semua", opnameItems: [], sourceOrderId: ""
        });
        await loadAllData();
      }
    } finally {
      setCreatingWo(false);
    }
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
                onClick={loadAllData}
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
              <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
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
                <option value="all">Semua Tipe Task</option>
                <option value="PRODUKSI">Produksi Dapur</option>
                <option value="REPACK_SAOS">Repack Saos / Gula</option>
                <option value="PACKING_PESANAN">Packing Pesanan</option>
                <option value="STOCK_OPNAME">Stock Opname</option>
                <option value="GENERAL_TASK">General Task</option>
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
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split("T")[0];
                        setStartDate(today);
                        setEndDate(today);
                      }}
                      className="px-2 py-1 text-[10px] font-extrabold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const d7 = new Date(today);
                        d7.setDate(d7.getDate() - 6);
                        setStartDate(d7.toISOString().split("T")[0]);
                        setEndDate(today.toISOString().split("T")[0]);
                      }}
                      className="px-2 py-1 text-[10px] font-extrabold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
                    >
                      7 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                        setStartDate(firstDay.toISOString().split("T")[0]);
                        setEndDate(today.toISOString().split("T")[0]);
                      }}
                      className="px-2 py-1 text-[10px] font-extrabold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
                    >
                      Bulan Ini
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        
        {/* Executive Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {activeTab === "audit_ledger" ? "Total WO Periode Ini" : "Total WO Aktif"}
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">{filteredWorkOrders.length}</p>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Proses Dapur</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {filteredWorkOrders.filter(w => w.woType === "PRODUKSI").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Proses Packing</p>
            <p className="text-2xl font-black text-blue-600 mt-1">
              {filteredWorkOrders.filter(w => w.woType === "PACKING_PESANAN" || w.woType === "REPACK_SAOS").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Hasil Pcs</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              {formatNumber(filteredWorkOrders.reduce((sum, w) => sum + (w.summaryState?.totalGoodPcs || 0), 0))}
            </p>
          </div>
        </div>

        {/* Work Orders List (Grid vs Table) */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkOrders.map((wo) => (
            <div key={wo.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
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

                <h3 className="text-sm font-black text-slate-800">{wo.productName}</h3>
                
                <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-semibold space-y-1.5">
                  {wo.woType === "PRODUKSI" ? (
                    <>
                      <div className="flex justify-between"><span className="text-slate-500">Target Loyang:</span> <span className="text-slate-800 font-extrabold">{wo.targetLoyang} Loyang</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Progress Loyang:</span> <span className="text-slate-900 font-extrabold">{wo.summaryState?.totalTrayPrinted || 0} / {wo.targetLoyang}</span></div>
                    </>
                  ) : wo.woType === "PACKING_PESANAN" ? (
                    <>
                      <div className="flex justify-between"><span className="text-slate-500">Target Pack:</span> <span className="text-slate-800 font-extrabold">{wo.targetPacks} Pack</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Hasil Packing:</span> <span className="text-emerald-600 font-extrabold">{wo.summaryState?.totalGoodPacks || 0} / {wo.targetPacks}</span></div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between"><span className="text-slate-500">Target {wo.targetUom}:</span> <span className="text-slate-800 font-extrabold">{wo.targetQty}</span></div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1 font-bold text-slate-700">
                  <Clock size={12} className="text-slate-400" />
                  {new Date(wo.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(wo.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
                <span>PIC: {wo.assignedCrewName}</span>
              </div>
            </div>
          ))}
          
          {filteredWorkOrders.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <Box size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-bold">Tidak ada Work Order yang ditemukan.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4">Nomor & Tipe</th>
                  <th className="px-5 py-4">Tanggal (MFD)</th>
                  <th className="px-5 py-4">Produk</th>
                  <th className="px-5 py-4">Target vs Aktual</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkOrders.map(wo => (
                  <tr key={wo.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-mono font-bold text-slate-800">{wo.woNumber}</div>
                      <div className="text-[10px] text-slate-500 font-black mt-1 uppercase">{wo.woType}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-extrabold text-slate-800 text-xs">
                        {new Date(wo.createdAt).toLocaleDateString("id-ID", { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Pukul {new Date(wo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800">{wo.productName}</div>
                      <div className="text-xs text-slate-500 mt-1">PIC: {wo.assignedCrewName}</div>
                    </td>
                    <td className="px-5 py-4">
                      {wo.woType === "PRODUKSI" ? (
                        <span className="font-bold text-slate-700">{wo.summaryState?.totalTrayPrinted || 0} / {wo.targetLoyang} <span className="text-slate-400 text-xs font-semibold">Loyang</span></span>
                      ) : wo.woType === "PACKING_PESANAN" ? (
                        <span className="font-bold text-slate-700">{wo.summaryState?.totalGoodPacks || 0} / {wo.targetPacks} <span className="text-slate-400 text-xs font-semibold">Pack</span></span>
                      ) : (
                        <span className="font-bold text-slate-700">{wo.summaryState?.totalGoodPcs || 0} / {wo.targetQty} <span className="text-slate-400 text-xs font-semibold">{wo.targetUom}</span></span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        wo.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        wo.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {wo.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredWorkOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
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

      {/* Dynamic Create Work Order Modal */}
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
                        onClick={() => setNewWoForm({ ...newWoForm, woType: opt.val as SFMWorkOrderType, variantId: "", sourceOrderId: "" })}
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
