"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";
import { formatNumber, formatDateTime } from "@/lib/formatters";
import { Loader2, Plus, X, Check, AlertTriangle, Search, ChevronDown, ChevronUp, ClipboardList, MoreHorizontal } from "lucide-react";
import type { Ingredient } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────
import { MutasiModal } from "./components/MutasiModal";

type Tab = "produk" | "bahan" | "operasional" | "addon" | "opname";

interface VariantStock {
  id: string; name: string; currentStock: number; minStock: number; sortOrder: number;
}

interface OpnameItem {
  ingredientId: string;
  inputMethod: string;
  physicalStock: number | null;
  fullPackages: number | null;
  openPackageFullness: string | null;
  physicalStockConverted: number | null;
  systemStock: number;
  difference: number;
}

interface OpnameRecord {
  id: string;
  date: string;
  crewId: string;
  items: OpnameItem[];
  totalIngredientsChecked: number;
  totalIngredientsAll: number;
  hasDiscrepancy: boolean;
  reviewedBy: string | null;
  reviewAction: string | null;
}

interface IngredientInfo {
  id: string;
  name: string;
  baseUnit: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab") as Tab;
      if (t && ["produk", "bahan", "operasional", "addon", "opname"].includes(t)) {
        return t;
      }
    }
    return "produk";
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Produk Jadi
  const [variants, setVariants] = useState<VariantStock[]>([]);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [opnameValue, setOpnameValue] = useState("");
  const [opnameNote, setOpnameNote] = useState("");

  // Bahan Baku
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [newStockValue, setNewStockValue] = useState("");
  const [stockNote, setStockNote] = useState("");

  // Review Opname states
  const [opnames, setOpnames] = useState<OpnameRecord[]>([]);
  const [expandedOpnameId, setExpandedOpnameId] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Map<string, Map<string, boolean>>>(new Map());
  const [reviewNote, setReviewNote] = useState("");
  const [opnameSubmittingId, setOpnameSubmittingId] = useState("");
  const [opnameError, setOpnameError] = useState("");

  // Mutasi Modal states
  const [isMutasiOpen, setIsMutasiOpen] = useState(false);
  const [mutasiItemId, setMutasiItemId] = useState("");
  const [mutasiItemName, setMutasiItemName] = useState("");
  const [mutasiItemUnit, setMutasiItemUnit] = useState("");
  const [mutasiItemType, setMutasiItemType] = useState<"variant" | "ingredient">("ingredient");
  const [mutasiFilter, setMutasiFilter] = useState<"hari" | "minggu" | "bulan">("bulan");
  const [mutasiDate, setMutasiDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [mutasiMovements, setMutasiMovements] = useState<any[]>([]);
  const [loadingMutasi, setLoadingMutasi] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadMutasiMovements = useCallback(async (id: string, type: "variant" | "ingredient", filter: "hari" | "minggu" | "bulan", dateVal: string) => {
    setLoadingMutasi(true);
    try {
      const res = await fetchWithAuth(`/api/ingredients/${id}/movements?type=${type}&filter=${filter}&date=${dateVal}`);
      if (res.ok) {
        setMutasiMovements(await res.json());
      } else {
        setMutasiMovements([]);
      }
    } catch {
      setMutasiMovements([]);
    } finally {
      setLoadingMutasi(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (isMutasiOpen && mutasiItemId) {
      loadMutasiMovements(mutasiItemId, mutasiItemType, mutasiFilter, mutasiDate);
    }
  }, [isMutasiOpen, mutasiItemId, mutasiItemType, mutasiFilter, mutasiDate, loadMutasiMovements]);

  function openMutasiModal(id: string, name: string, unit: string, type: "variant" | "ingredient") {
    setMutasiItemId(id);
    setMutasiItemName(name);
    setMutasiItemUnit(unit);
    setMutasiItemType(type);
    setMutasiFilter("bulan");
    const now = new Date();
    setMutasiDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    setIsMutasiOpen(true);
  }

  // moved to MutasiModal
  const loadVariants = useCallback(async () => {
    const res = await fetchWithAuth("/api/products/stocks");
    if (res.ok) setVariants(await res.json());
  }, [fetchWithAuth]);

  const loadIngredients = useCallback(async () => {
    const res = await fetchWithAuth("/api/ingredients");
    if (res.ok) setIngredients(await res.json());
  }, [fetchWithAuth]);

  const loadOpnames = useCallback(async () => {
    const res = await fetchWithAuth("/api/stock-opname");
    if (res.ok) setOpnames(await res.json());
  }, [fetchWithAuth]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadVariants(), loadIngredients(), loadOpnames()]).finally(() => setLoading(false));
  }, [loadVariants, loadIngredients, loadOpnames]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setSearchQuery("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.replaceState(null, "", url.toString());
    }
  };

  function toggleAdjustment(opnameId: string, ingredientId: string) {
    setAdjustments((prev) => {
      const next = new Map(prev);
      const opnameAdj = new Map(next.get(opnameId) ?? new Map());
      opnameAdj.set(ingredientId, !opnameAdj.get(ingredientId));
      next.set(opnameId, opnameAdj);
      return next;
    });
  }

  async function handleReview(opnameId: string) {
    setOpnameSubmittingId(opnameId);
    setOpnameError("");
    try {
      const opname = opnames.find((o) => o.id === opnameId);
      if (!opname) return;

      const opnameAdj = adjustments.get(opnameId) ?? new Map();
      const adjList = opname.items
        .filter((item) => item.difference !== 0)
        .map((item) => ({
          ingredientId: item.ingredientId,
          applyAdjustment: opnameAdj.get(item.ingredientId) ?? false,
        }));

      const res = await fetchWithAuth(`/api/stock-opname/${opnameId}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          reviewNote: reviewNote || undefined,
          adjustments: adjList,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setOpnameError(d.error ?? "Gagal mereview");
        return;
      }

      setExpandedOpnameId(null);
      setReviewNote("");
      setLoading(true);
      await Promise.all([loadVariants(), loadIngredients(), loadOpnames()]).finally(() => setLoading(false));
    } catch {
      setOpnameError("Terjadi kesalahan koneksi");
    } finally {
      setOpnameSubmittingId("");
    }
  }
  function fmtDate(iso: string) {
    return formatDateTime(iso);
  }

  function fmtStock(n: number | null | undefined, unit: string) {
    if (n == null) return "-";
    return `${formatNumber(n)} ${unit}`;
  }

  // Opname produk jadi
  async function handleVariantOpname(id: string) {
    const val = parseInt(opnameValue, 10);
    if (isNaN(val) || val < 0) return;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/products/stocks`, {
        method: "PATCH",
        body: JSON.stringify({ id, currentStock: val, note: opnameNote || null }),
      });
      if (res.ok) {
        setEditingVariantId(null); setOpnameValue(""); setOpnameNote("");
        await loadVariants();
      }
    } finally { setSubmitting(false); }
  }

  // Update bahan baku stock
  async function handleStockEdit(id: string) {
    const val = parseFloat(newStockValue);
    if (isNaN(val) || val < 0) return;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/ingredients/${id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ newStock: val, note: stockNote || null }),
      });
      if (res.ok) {
        setEditingStock(null); setNewStockValue(""); setStockNote("");
        await loadIngredients();
      }
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
    </div>
  );

  const pendingOpnameCount = opnames.filter((o) => !o.reviewedBy).length;

  const TABS: { key: Tab; label: string }[] = [
    { key: "produk", label: "Produk Jadi" },
    { key: "bahan", label: "Bahan Baku" },
    { key: "operasional", label: "Stok Operasional" },
    { key: "addon", label: "Stok Add-On" },
    { key: "opname", label: `Review Opname${pendingOpnameCount > 0 ? ` (${pendingOpnameCount})` : ""}` },
  ];

  const lowVariants = variants.filter(v => v.currentStock < v.minStock);
  const lowIngredients = ingredients.filter(i => i.currentStock < i.minStock);

  return (
    <div className="min-h-screen" style={{ background: "#FCABB4" }}>

      {/* ── Header (Glassmorphism, sticky) ── */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-primary/20 shadow-sm">
        <div className="px-5 pt-6 pb-4">
          <h1 className="text-2xl font-black mb-1" style={{ color: "#1E293B" }}>Inventori</h1>
          <p className="text-sm font-semibold text-slate-500">Kelola stok dan bahan baku</p>

          {/* Search bar */}
          <div className="flex items-center gap-2 mt-4 px-4 py-3 bg-brand-50/80 rounded-xl border border-slate-100 focus-within:ring-2 focus-within:ring-primary focus-within:border-pink-200 transition-all">
            <Search size={18} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder={tab === "produk" ? "Cari varian..." : tab === "bahan" ? "Cari bahan baku..." : "Cari pengeluaran..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400"
              data-testid="inventory-search"
            />
          </div>
        </div>

        {/* Tabs — Scrollable */}
        <div className="flex overflow-x-auto no-scrollbar px-2 pb-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              data-testid={`tab-${t.key}`}
              className={`whitespace-nowrap px-4 py-3 text-sm transition-all border-b-2 font-bold ${
                tab === t.key 
                  ? "border-primary text-primary" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-24 md:px-8 md:max-w-4xl">

        {/* ── TAB: Produk Jadi ── */}
        {tab === "produk" && (
          <>
            {lowVariants.length > 0 && (
              <div
                style={{ padding: "10px 14px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}
              >
                <AlertTriangle size={15} style={{ color: "#DC2626", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", fontWeight: "500", color: "#DC2626" }}>
                  {lowVariants.length} varian stok rendah
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {variants
                .filter(v => !searchQuery || (v.name && v.name.toLowerCase().includes(searchQuery.toLowerCase())))
                .length === 0 ? (
                  <div className="py-16 text-center col-span-full bg-white rounded-3xl border border-dashed border-slate-200">
                    <p className="text-sm font-bold text-slate-400">
                      {searchQuery ? "Tidak ditemukan" : "Belum ada data varian"}
                    </p>
                  </div>
                ) : (
                  variants
                    .filter(v => !searchQuery || (v.name && v.name.toLowerCase().includes(searchQuery.toLowerCase())))
                    .map(v => {
                      const isLow = v.currentStock < v.minStock;
                      const barPct = Math.min(100, (v.currentStock / Math.max(v.minStock * 2, 1)) * 100);
                      const barColor = isLow ? "#DC2626" : v.currentStock < v.minStock * 1.5 ? "#D97706" : "#10B981";
                      const isEditing = editingVariantId === v.id;
                      
                      return (
                        <div
                          key={v.id}
                          className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col transition-all ${
                            isLow ? "border-red-200 ring-2 ring-red-500/10" : "border-slate-100 hover:border-pink-200"
                          }`}
                          data-testid={`variant-stock-${v.id}`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                isLow ? "bg-red-50 text-red-600 animate-pulse" : "bg-primary/10 text-primary"
                              }`}>
                                <span className="text-lg font-black">{v.name?.[0]?.toUpperCase() || "?"}</span>
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-800 line-clamp-1">{v.name}</p>
                                <p className="text-xs font-bold text-slate-400 mt-0.5">Min: {v.minStock}</p>
                              </div>
                            </div>
                            
                            {!isEditing && (
                              <div className="relative">
                                <button 
                                  onClick={() => setOpenMenuId(openMenuId === v.id ? null : v.id)}
                                  className="p-2 text-slate-400 hover:text-slate-700 bg-brand-50 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                  <MoreHorizontal size={16} />
                                </button>
                                {openMenuId === v.id && (
                                  <>
                                    <div className="fixed inset-0 z-0" onClick={() => setOpenMenuId(null)} />
                                    <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-slate-100 p-1 z-10">
                                      <button
                                        onClick={() => { setOpenMenuId(null); openMutasiModal(v.id, v.name, "pcs", "variant"); }}
                                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-brand-50 hover:text-indigo-600 rounded-xl transition-colors"
                                      >
                                        Kartu Stok
                                      </button>
                                      <button
                                        onClick={() => { setOpenMenuId(null); setEditingVariantId(v.id); setOpnameValue(String(v.currentStock)); }}
                                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-brand-50 hover:text-primary rounded-xl transition-colors"
                                      >
                                        Stock Opname
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="mt-auto">
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Sisa Stok</span>
                              <span className={`text-2xl font-black ${isLow ? "text-red-600" : "text-slate-800"}`}>
                                {v.currentStock} <span className="text-xs font-bold text-slate-400">pcs</span>
                              </span>
                            </div>

                            {!isEditing ? (
                              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                                <div 
                                  className="h-1.5 rounded-full transition-all duration-500 ease-out" 
                                  style={{ width: `${barPct}%`, backgroundColor: barColor }} 
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-slate-100">
                                <div className="flex gap-2 items-center">
                                  <Input
                                    type="number"
                                    value={opnameValue}
                                    onChange={e => setOpnameValue(e.target.value)}
                                    placeholder="Jumlah aktual"
                                    className="flex-1 h-10 rounded-xl border-slate-200 text-sm font-bold"
                                    data-testid={`opname-input-${v.id}`}
                                  />
                                  <span className="text-xs font-bold text-slate-400">pcs</span>
                                </div>
                                <Input
                                  value={opnameNote}
                                  onChange={e => setOpnameNote(e.target.value)}
                                  placeholder="Catatan opname (opsional)"
                                  className="h-10 rounded-xl border-slate-200 text-sm"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleVariantOpname(v.id)}
                                    disabled={submitting}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-black text-white bg-primary hover:bg-primary transition-colors"
                                    data-testid={`save-opname-${v.id}`}
                                  >
                                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                                    Simpan
                                  </button>
                                  <button
                                    onClick={() => { setEditingVariantId(null); setOpnameValue(""); setOpnameNote(""); }}
                                    className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-slate-500 shadow-sm hover:bg-slate-200 transition-colors"
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                )
              }
            </div>
          </>
        )}

        {/* ── TAB: Bahan Baku / Operasional / Add-On ── */}
        {(tab === "bahan" || tab === "operasional" || tab === "addon") && (
          (() => {
            const currentCategory = tab === "bahan" ? "bahan_baku" : tab === "operasional" ? "operasional" : "add_on";
            const filteredIngredients = ingredients.filter(i => i.category === currentCategory);
            const lowFiltered = filteredIngredients.filter(i => i.currentStock < i.minStock);

            return (
              <>
                {lowFiltered.length > 0 && (
                  <div
                    style={{ padding: "10px 14px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}
                  >
                    <AlertTriangle size={15} style={{ color: "#DC2626", flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", fontWeight: "500", color: "#DC2626" }}>
                      {lowFiltered.length} item stok rendah
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredIngredients
                    .filter(i => !searchQuery || (i.name && i.name.toLowerCase().includes(searchQuery.toLowerCase())))
                    .length === 0 ? (
                      <div className="py-16 text-center col-span-full bg-white rounded-3xl border border-dashed border-slate-200">
                        <p className="text-sm font-bold text-slate-400">
                          {searchQuery ? "Tidak ditemukan" : "Belum ada data"}
                        </p>
                      </div>
                    ) : (
                      filteredIngredients
                        .filter(i => !searchQuery || (i.name && i.name.toLowerCase().includes(searchQuery.toLowerCase())))
                        .map(ing => {
                          const current = ing.currentStock ?? 0;
                          const min = ing.minStock ?? 0;
                          const isLow = current < min;
                          const barPct = Math.min(100, (current / Math.max(min * 2, 1)) * 100);
                          const barColor = isLow ? "#DC2626" : current < min * 1.5 ? "#D97706" : "#10B981";
                          const isEditing = editingStock === ing.id;
                          
                          return (
                            <div
                              key={ing.id}
                              className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col transition-all ${
                                isLow ? "border-red-200 ring-2 ring-red-500/10" : "border-slate-100 hover:border-pink-200"
                              }`}
                              data-testid={`ingredient-${ing.id}`}
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                    isLow ? "bg-red-50 text-red-600 animate-pulse" : "bg-indigo-50 text-indigo-600"
                                  }`}>
                                    <span className="text-lg font-black">{ing.name?.[0]?.toUpperCase() || "?"}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-slate-800 line-clamp-1">{ing.name}</p>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5">Min: {min} {ing.baseUnit}</p>
                                  </div>
                                </div>
                                
                                {!isEditing && (
                                  <div className="relative">
                                    <button 
                                      onClick={() => setOpenMenuId(openMenuId === ing.id ? null : ing.id)}
                                      className="p-2 text-slate-400 hover:text-slate-700 bg-brand-50 hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                      <MoreHorizontal size={16} />
                                    </button>
                                    {openMenuId === ing.id && (
                                      <>
                                        <div className="fixed inset-0 z-0" onClick={() => setOpenMenuId(null)} />
                                        <div className="absolute right-0 mt-2 w-32 bg-white rounded-2xl shadow-xl border border-slate-100 p-1 z-10">
                                          <button
                                            onClick={() => { setOpenMenuId(null); openMutasiModal(ing.id, ing.name, ing.baseUnit, "ingredient"); }}
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-brand-50 hover:text-indigo-600 rounded-xl transition-colors"
                                          >
                                            Kartu Stok
                                          </button>
                                          <button
                                            onClick={() => { setOpenMenuId(null); setEditingStock(ing.id); setNewStockValue(String(current)); }}
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-brand-50 hover:text-primary rounded-xl transition-colors"
                                          >
                                            Edit Stok
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="mt-auto">
                                <div className="flex justify-between items-end mb-2">
                                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Sisa Stok</span>
                                  <span className={`text-2xl font-black ${isLow ? "text-red-600" : "text-slate-800"}`}>
                                    {formatNumber(current)} <span className="text-xs font-bold text-slate-400">{ing.baseUnit}</span>
                                  </span>
                                </div>

                                {!isEditing ? (
                                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1 overflow-hidden">
                                    <div 
                                      className="h-1.5 rounded-full transition-all duration-500 ease-out" 
                                      style={{ width: `${barPct}%`, backgroundColor: barColor }} 
                                    />
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-slate-100">
                                    <div className="flex gap-2 items-center">
                                      <Input
                                        type="number"
                                        value={newStockValue}
                                        onChange={e => setNewStockValue(e.target.value)}
                                        placeholder={`Stok baru (${ing.baseUnit})`}
                                        className="flex-1 h-10 rounded-xl border-slate-200 text-sm font-bold"
                                      />
                                      <span className="text-xs font-bold text-slate-400">{ing.baseUnit}</span>
                                    </div>
                                    <Input
                                      value={stockNote}
                                      onChange={e => setStockNote(e.target.value)}
                                      placeholder="Catatan (opsional)"
                                      className="h-10 rounded-xl border-slate-200 text-sm"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleStockEdit(ing.id)}
                                        disabled={submitting}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-black text-white bg-primary hover:bg-primary transition-colors"
                                      >
                                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                                        Simpan
                                      </button>
                                      <button
                                        onClick={() => { setEditingStock(null); setNewStockValue(""); setStockNote(""); }}
                                        className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-slate-500 shadow-sm hover:bg-slate-200 transition-colors"
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                    )
                  }
                </div>
              </>
            );
          })()
        )}

        {/* ── TAB: Review Opname Crew ── */}
        {tab === "opname" && (
          <div className="space-y-6">
            {opnameError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "14px", padding: "12px 16px" }}>
                <p style={{ fontSize: "13px", color: "#B91C1C", fontWeight: "600" }}>{opnameError}</p>
              </div>
            )}

            {/* Menunggu Review */}
            <div>
              <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E", marginBottom: "12px" }}>
                Menunggu Review ({pendingOpnameCount})
              </p>

              {opnames.filter((o) => !o.reviewedBy).length === 0 ? (
                <div style={{ background: "#fff", borderRadius: "16px", padding: "32px 16px", textAlign: "center", border: "1px solid #F1F5F9" }}>
                  <ClipboardList className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p style={{ fontSize: "13px", fontWeight: "600", color: "#94A3B8" }}>Tidak ada opname menunggu review</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {opnames
                    .filter((o) => !o.reviewedBy)
                    .map((opname) => {
                      const isExpanded = expandedOpnameId === opname.id;
                      const discrepancyItems = opname.items.filter((i) => i.difference !== 0);

                      return (
                        <div
                          key={opname.id}
                          style={{ background: "#fff", borderRadius: "16px", border: "1px solid #F1F5F9", overflow: "hidden" }}
                        >
                          <button
                            onClick={() => setExpandedOpnameId(isExpanded ? null : opname.id)}
                            className="w-full p-4 flex items-center justify-between text-left border-none bg-transparent cursor-pointer outline-none font-sans"
                          >
                            <div>
                              <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>
                                {fmtDate(opname.date)}
                              </p>
                              <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                                {opname.totalIngredientsChecked}/{opname.totalIngredientsAll} bahan dicek
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {opname.hasDiscrepancy && (
                                <span style={{ fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "100px", background: "#FEF3C7", color: "#D97706", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <AlertTriangle size={11} />
                                  {discrepancyItems.length} selisih
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronUp size={16} className="text-slate-400" />
                              ) : (
                                <ChevronDown size={16} className="text-slate-400" />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-4">
                              {discrepancyItems.length === 0 ? (
                                <p style={{ fontSize: "12px", color: "#16A34A", fontWeight: "600" }}>
                                  Tidak ada selisih — semua cocok
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Daftar Selisih Stok
                                  </p>
                                  {discrepancyItems.map((item) => {
                                    const ing = ingredients.find(i => i.id === item.ingredientId);
                                    const unit = ing?.baseUnit ?? "";
                                    const physical = item.inputMethod === "packaged" ? item.physicalStockConverted ?? 0 : item.physicalStock ?? 0;
                                    const isChecked = adjustments.get(opname.id)?.get(item.ingredientId) ?? false;

                                    return (
                                      <div
                                        key={item.ingredientId}
                                        style={{ background: "#F8FAFC", borderRadius: "12px", padding: "10px 12px", border: "1px solid #F1F5F9" }}
                                      >
                                        <div className="flex items-start justify-between mb-1">
                                          <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>
                                            {ing?.name ?? item.ingredientId}
                                          </p>
                                          <span
                                            style={{
                                              fontSize: "12px",
                                              fontWeight: "700",
                                              color: item.difference < 0 ? "#DC2626" : "#16A34A",
                                            }}
                                          >
                                            {item.difference > 0 ? "+" : ""}
                                            {fmtStock(item.difference, unit)}
                                          </span>
                                        </div>
                                        <p style={{ fontSize: "11px", color: "#94A3B8" }}>
                                          Sistem: {fmtStock(item.systemStock, unit)} | Fisik: {fmtStock(physical, unit)}
                                        </p>
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleAdjustment(opname.id, item.ingredientId)}
                                            style={{ accentColor: "#E85D8C" }}
                                            className="rounded border-slate-300 h-3.5 w-3.5"
                                          />
                                          <span style={{ fontSize: "11px", color: "#475569", fontWeight: "500" }}>
                                            Sesuaikan stok sistem ke angka fisik
                                          </span>
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <div className="space-y-3 pt-2">
                                <Input
                                  placeholder="Catatan review (opsional)"
                                  value={reviewNote}
                                  onChange={(e) => setReviewNote(e.target.value)}
                                  className="h-10 rounded-xl border-slate-200 text-sm bg-white"
                                />

                                <button
                                  onClick={() => handleReview(opname.id)}
                                  disabled={opnameSubmittingId === opname.id}
                                  style={{
                                    width: "100%",
                                    height: "38px",
                                    borderRadius: "12px",
                                    background: "linear-gradient(135deg,#E85D8C,#C94A73)",
                                    color: "#fff",
                                    fontSize: "12px",
                                    fontWeight: "700",
                                    border: "none",
                                    cursor: opnameSubmittingId === opname.id ? "default" : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px"
                                  }}
                                  className="tap-target"
                                >
                                  {opnameSubmittingId === opname.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                  Selesaikan Review
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Sudah Direview */}
            <div>
              <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E", marginBottom: "12px" }}>
                Sudah Direview
              </p>

              {opnames.filter((o) => o.reviewedBy).length === 0 ? (
                <div style={{ background: "#fff", borderRadius: "16px", padding: "24px 16px", textAlign: "center", border: "1px solid #F1F5F9" }}>
                  <p style={{ fontSize: "12px", color: "#94A3B8" }}>Belum ada opname yang selesai direview</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {opnames
                    .filter((o) => o.reviewedBy)
                    .map((opname) => (
                      <div
                        key={opname.id}
                        style={{ background: "#fff", borderRadius: "14px", padding: "12px 14px", border: "1px solid #F1F5F9" }}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>
                            {fmtDate(opname.date)}
                          </p>
                          <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>
                            {opname.totalIngredientsChecked} bahan dicek · Reviewer: {opname.reviewedBy}
                          </p>
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            padding: "3px 9px",
                            borderRadius: "100px",
                            background: opname.reviewAction === "adjusted" ? "#EFF6FF" : "#F1F5F9",
                            color: opname.reviewAction === "adjusted" ? "#2563EB" : "#64748B",
                          }}
                        >
                          {opname.reviewAction === "adjusted" ? "Disesuaikan" : "Tanpa Koreksi"}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Mutasi Modal ── */}
        <MutasiModal
          isOpen={isMutasiOpen}
          onClose={() => setIsMutasiOpen(false)}
          mutasiItemName={mutasiItemName}
          mutasiItemUnit={mutasiItemUnit}
          mutasiFilter={mutasiFilter}
          setMutasiFilter={setMutasiFilter}
          mutasiDate={mutasiDate}
          setMutasiDate={setMutasiDate}
          loadingMutasi={loadingMutasi}
          mutasiMovements={mutasiMovements}
        />

      </div>
    </div>
  );
}
