"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
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

export default function InventoryPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab") as Tab;
      if (t && ["produk", "bahan", "packaging", "operasional", "addon", "opname"].includes(t)) {
        return t;
      }
    }
    return "produk";
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
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

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const pendingOpnameCount = opnames.filter((o) => !o.reviewedBy).length;

  const TABS: { key: Tab; label: string }[] = [
    { key: "produk", label: "Produk Jadi" },
    { key: "bahan", label: "Bahan Baku" },
    { key: "packaging", label: "Kemasan & Packaging" },
    { key: "operasional", label: "Operasional" },
    { key: "addon", label: "Add-On" },
    { key: "opname", label: `Review Opname${pendingOpnameCount > 0 ? ` (${pendingOpnameCount})` : ""}` },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pt-4 pb-32 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex items-center gap-3">
          <Link href="/manager/dashboard" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-800">Inventory & Gudang</h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Manajemen stok real-time</p>
          </div>
        </div>

        {/* SEARCH & FILTER BAR */}
        {tab !== "opname" && (
          <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-200 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari ${tab === 'produk' ? 'produk varian' : 'bahan baku'}...`}
              className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1 rounded-full">
                <Loader2 size={12} className="opacity-0" />
                <span className="absolute inset-0 flex items-center justify-center font-bold text-[10px]">X</span>
              </button>
            )}
          </div>
        )}

        {/* HORIZONTAL TABS */}
        <div className="overflow-x-auto hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 min-w-max pb-2">
            {TABS.map((t) => {
              const isActive = tab === t.key;
              const hasAlert = t.key === "opname" && pendingOpnameCount > 0;
              return (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${
                    isActive 
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                  {hasAlert && !isActive && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENT AREA */}
        <div>
          {tab === "produk" && (
            <ProductList
              variants={variants}
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
              ingredients={ingredients}
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
