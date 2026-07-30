"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  Loader2, Search, ArrowLeft, Package, AlertTriangle, ClipboardList, 
  Layers, CheckCircle2, ChevronRight, Filter, ShieldAlert, Sparkles, X, Plus
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Ingredient } from "@/types";

import { MutasiModal } from "./components/MutasiModal";
import { ProductList } from "./components/ProductList";
import { IngredientList } from "./components/IngredientList";
import { OpnameReviewList } from "./components/OpnameReviewList";

type Tab = "produk" | "bahan" | "packaging" | "operasional" | "addon" | "opname";

interface VariantStock {
  id: string; name: string; currentStock: number; minStock: number; sortOrder: number;
}

interface OpnameRecord {
  id: string; date: string; crewId: string; items: any[];
  totalIngredientsChecked: number; totalIngredientsAll: number;
  hasDiscrepancy: boolean; reviewedBy: string | null; reviewAction: string | null;
}

function InventoryContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("produk");

  useEffect(() => {
    const t = searchParams.get("tab") as Tab;
    if (t && ["produk", "bahan", "packaging", "operasional", "addon", "opname"].includes(t)) {
      setTab(t);
    }
  }, [searchParams]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const [variants, setVariants] = useState<VariantStock[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [opnames, setOpnames] = useState<OpnameRecord[]>([]);

  // Shared state for 3-dots menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { 
      ...options, 
      headers: { 
        Authorization: `Bearer ${token}`, 
        "Content-Type": "application/json", 
        ...options?.headers 
      } 
    });
  }, [getToken]);

  const loadMutasiMovements = useCallback(async (id: string, type: "variant" | "ingredient", filter: "hari" | "minggu" | "bulan", dateVal: string) => {
    setLoadingMutasi(true);
    try {
      const res = await fetchWithAuth(`/api/ingredients/${id}/movements?type=${type}&filter=${filter}&date=${dateVal}`);
      if (res.ok) setMutasiMovements(await res.json());
      else setMutasiMovements([]);
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
    setMutasiItemId(id); setMutasiItemName(name); setMutasiItemUnit(unit); setMutasiItemType(type);
    setMutasiFilter("bulan");
    const now = new Date();
    setMutasiDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    setIsMutasiOpen(true);
  }

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

  const reloadAll = useCallback(async () => {
    await Promise.all([loadVariants(), loadIngredients(), loadOpnames()]);
  }, [loadVariants, loadIngredients, loadOpnames]);

  useEffect(() => {
    setLoading(true);
    reloadAll().finally(() => setLoading(false));
  }, [reloadAll]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setSearchQuery("");
    setOpenMenuId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.replaceState(null, "", url.toString());
    }
  };

  // Executive Summaries
  const pendingOpnameCount = useMemo(() => opnames.filter((o) => !o.reviewedBy).length, [opnames]);
  
  const lowStockCount = useMemo(() => {
    const lowV = variants.filter(v => v.currentStock < v.minStock).length;
    const lowI = ingredients.filter(i => i.currentStock < i.minStock).length;
    return lowV + lowI;
  }, [variants, ingredients]);

  const totalItemCount = variants.length + ingredients.length;

  const TABS: { key: Tab; label: string }[] = [
    { key: "produk", label: "Produk Jadi" },
    { key: "bahan", label: "Bahan Baku" },
    { key: "packaging", label: "Kemasan & Packaging" },
    { key: "operasional", label: "Operasional" },
    { key: "addon", label: "Add-On" },
    { key: "opname", label: `Review Opname${pendingOpnameCount > 0 ? ` (${pendingOpnameCount})` : ""}` },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      
      {/* ── Native App Sticky Header ── */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto space-y-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                <Package size={20} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">
                  Inventori & Stok Gudang
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  Manajemen Stok Real-time & Adjustment Opname
                </p>
              </div>
            </div>

            <Link
              href="/manager/stock-adjustments"
              className="px-3.5 md:px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Plus size={16} /> Adjustment Stok
            </Link>
          </div>

          {/* ── Horizontal Scroll Tabs (Gojek / Grab Style) ── */}
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pt-1">
            <div className="flex items-center gap-1.5 min-w-max">
              {TABS.map((t) => {
                const isActive = tab === t.key;
                const hasAlert = t.key === "opname" && pendingOpnameCount > 0;
                return (
                  <button
                    key={t.key}
                    onClick={() => handleTabChange(t.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                      isActive 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                        : 'bg-slate-100/80 text-slate-600 border-slate-200/80 hover:bg-slate-200/60'
                    }`}
                  >
                    {t.label}
                    {hasAlert && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="px-4 md:px-8 max-w-6xl mx-auto space-y-5 pt-5">

        {/* ── Executive Summary Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Layers size={14} className="text-indigo-500" /> Total Item Inventori
              </span>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                Terdaftar
              </span>
            </div>
            <div className="text-2xl font-black text-slate-800 tabular-nums">
              {totalItemCount} Item
            </div>
            <p className="text-xs font-semibold text-slate-400">Varian produk, bahan & packaging</p>
          </div>

          <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={14} className="text-amber-500" /> Peringatan Stok Low
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                lowStockCount > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}>
                {lowStockCount > 0 ? "Perlu Restok" : "Stok Aman"}
              </span>
            </div>
            <div className="text-2xl font-black text-slate-800 tabular-nums">
              {lowStockCount} Item
            </div>
            <p className="text-xs font-semibold text-slate-400">Item mendekati atau di bawah batas min</p>
          </div>

          <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ClipboardList size={14} className="text-rose-500" /> Opname Pending Review
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                pendingOpnameCount > 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50 text-slate-600 border-slate-200"
              }`}>
                {pendingOpnameCount > 0 ? "Perlu Akses" : "Selesai"}
              </span>
            </div>
            <div className="text-2xl font-black text-slate-800 tabular-nums">
              {pendingOpnameCount} Opname
            </div>
            <p className="text-xs font-semibold text-slate-400">Hasil cek stok crew menanti verifikasi</p>
          </div>

        </div>

        {/* ── Search & Filter Controls ── */}
        {tab !== "opname" && (
          <div className="bg-white rounded-2xl md:rounded-3xl p-3 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Cari nama ${tab === 'produk' ? 'produk varian' : 'bahan / kemasan'}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              onClick={() => setOnlyLowStock(prev => !prev)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                onlyLowStock 
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm" 
                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
              }`}
            >
              <AlertTriangle size={14} /> Hanya Stok Low
            </button>

          </div>
        )}

        {/* ── Main Tab Contents ── */}
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 bg-white rounded-3xl border border-slate-200/80 p-4" />
            <div className="h-24 bg-white rounded-3xl border border-slate-200/80 p-4" />
            <div className="h-24 bg-white rounded-3xl border border-slate-200/80 p-4" />
          </div>
        ) : (
          <div>
            {tab === "produk" && (
              <ProductList
                variants={onlyLowStock ? variants.filter(v => v.currentStock < v.minStock) : variants}
                searchQuery={searchQuery}
                fetchWithAuth={fetchWithAuth}
                loadVariants={loadVariants}
                openMutasiModal={openMutasiModal}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
            )}

            {(tab === "bahan" || tab === "packaging" || tab === "operasional" || tab === "addon") && (
              <IngredientList
                ingredients={onlyLowStock ? ingredients.filter(i => i.currentStock < i.minStock) : ingredients}
                searchQuery={searchQuery}
                tab={tab}
                fetchWithAuth={fetchWithAuth}
                loadIngredients={loadIngredients}
                openMutasiModal={openMutasiModal}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
            )}

            {tab === "opname" && (
              <OpnameReviewList
                opnames={opnames}
                ingredients={ingredients}
                fetchWithAuth={fetchWithAuth}
                onReviewComplete={reloadAll}
              />
            )}
          </div>
        )}

        {/* Mutasi Modal */}
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

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    }>
      <InventoryContent />
    </Suspense>
  );
}
