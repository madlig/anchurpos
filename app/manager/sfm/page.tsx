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
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVariantFilter, setSelectedVariantFilter] = useState("all");
  const [selectedWoTypeFilter, setSelectedWoTypeFilter] = useState<string>("all");

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
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
          targetQty: (newWoForm.woType === "REPACK_SAOS" || newWoForm.woType === "GENERAL_TASK") ? parseFloat(newWoForm.targetQty) : 0,
          targetUom: (newWoForm.woType === "REPACK_SAOS" || newWoForm.woType === "GENERAL_TASK") ? newWoForm.targetUom : "",
          notes: newWoForm.notes,
        }),
      });

      if (res.ok) {
        setShowNewWoModal(false);
        setNewWoForm({ woType: "PRODUKSI", variantId: "", targetBatches: "3", targetPacks: "48", targetQty: "100", targetUom: "cup", notes: "" });
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
              <div className="w-10 h-10 rounded-2xl bg-indigo-900 text-white flex items-center justify-center shrink-0 shadow-sm">
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
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
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
                        ? "bg-indigo-900 text-white border-indigo-900 shadow-xs"
                        : "bg-slate-100/80 text-slate-600 border-slate-200/80 hover:bg-slate-200/60"
                    }`}
                  >
                    <Icon size={14} /> {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        
        {/* Executive Metric Cards */}
        {activeTab === "wo_active" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total WO Aktif</p>
              <p className="text-2xl font-black text-indigo-700 mt-1">{filteredWorkOrders.length}</p>
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
        )}

        {/* Work Orders List (Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkOrders.map((wo) => (
            <div key={wo.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-extrabold text-indigo-900 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
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
                      <div className="flex justify-between"><span className="text-slate-500">Progress Loyang:</span> <span className="text-indigo-600 font-extrabold">{wo.summaryState?.totalTrayPrinted || 0} / {wo.targetLoyang}</span></div>
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
                <span className="flex items-center gap-1"><Clock size={12}/> {new Date(wo.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
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
                      { val: "PACKING_PESANAN", label: "Packing Pesanan" },
                      { val: "STOCK_OPNAME", label: "Stock Opname" }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setNewWoForm({ ...newWoForm, woType: opt.val as SFMWorkOrderType })}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-left ${
                          newWoForm.woType === opt.val ? "bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-500/20" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Varian / Produk */}
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">2. Varian Produk *</label>
                  <select
                    required
                    value={newWoForm.variantId}
                    onChange={(e) => setNewWoForm({ ...newWoForm, variantId: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="" disabled>Pilih Varian...</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Dynamic Target Inputs based on woType */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 space-y-4">
                  <label className="text-xs font-black text-indigo-900 uppercase tracking-wider block">3. Target (Otomatis Menyesuaikan)</label>
                  
                  {newWoForm.woType === "PRODUKSI" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 mb-1 block">Target Batch Memasak</label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          required
                          value={newWoForm.targetBatches}
                          onChange={(e) => setNewWoForm({ ...newWoForm, targetBatches: e.target.value })}
                          className="h-10 text-sm font-black text-indigo-700 bg-white"
                        />
                        <p className="text-[10px] font-medium text-slate-400 mt-1">Estimasi: {parseFloat(newWoForm.targetBatches || "0") * 12} Loyang</p>
                      </div>
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
                          className="h-10 text-sm font-black text-indigo-700 bg-white"
                        />
                        <p className="text-[10px] font-medium text-slate-400 mt-1">Estimasi: {parseInt(newWoForm.targetPacks || "0") * 12} Pcs</p>
                      </div>
                    </div>
                  )}

                  {(newWoForm.woType === "REPACK_SAOS" || newWoForm.woType === "GENERAL_TASK" || newWoForm.woType === "STOCK_OPNAME") && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 mb-1 block">Jumlah Target</label>
                        <Input
                          type="number"
                          min="1"
                          required
                          value={newWoForm.targetQty}
                          onChange={(e) => setNewWoForm({ ...newWoForm, targetQty: e.target.value })}
                          className="h-10 text-sm font-black text-indigo-700 bg-white"
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
                          className="h-10 text-sm font-black text-indigo-700 bg-white"
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
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                className="px-6 py-2.5 rounded-xl font-extrabold text-xs text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-all"
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
