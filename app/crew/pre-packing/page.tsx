"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Check, PackageOpen, Layers, RefreshCw, Box, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { SearchableSelect, SearchableOption } from "@/components/shared/SearchableSelect";
import { formatNumber } from "@/lib/formatters";

interface Ingredient {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  currentStock: number;
}

interface PrepackRecipeItem {
  id: string;
  targetItemId: string;
  ingredientId: string;
  qtyPerPack: number;
  unit: string;
}

export default function CrewPrePackingPage() {
  const { getToken } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [yieldQty, setYieldQty] = useState("");
  const [recipe, setRecipe] = useState<PrepackRecipeItem[]>([]);
  
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    });
  }, [getToken]);

  const loadIngredients = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await fetchWithAuth("/api/ingredients");
      if (res.ok) {
        const data: Ingredient[] = await res.json();
        setIngredients(data);
        if (data.length > 0) {
          const defaultItem = data.find(i => i.category === "add_on" || i.category === "packaging") || data[0];
          setSelectedTargetId(defaultItem.id);
        }
      }
    } finally {
      setLoadingItems(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  // Load BOM Prepack Recipe when selectedTargetId changes
  useEffect(() => {
    if (!selectedTargetId) {
      setRecipe([]);
      return;
    }

    setLoadingRecipe(true);
    setError("");
    fetchWithAuth(`/api/recipes/prepack?targetItemId=${selectedTargetId}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setRecipe(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoadingRecipe(false));
  }, [selectedTargetId, fetchWithAuth]);

  const selectedTargetItem = useMemo(() => {
    return ingredients.find(i => i.id === selectedTargetId);
  }, [ingredients, selectedTargetId]);

  const targetOptions: SearchableOption[] = useMemo(() => {
    return ingredients.map(i => ({
      id: i.id,
      name: i.name,
      subtext: `Kategori: ${i.category?.replace('_', ' ') || 'Item'} • Stok: ${formatNumber(i.currentStock)} ${i.baseUnit}`
    }));
  }, [ingredients]);

  const parsedYield = parseFloat(yieldQty) || 0;

  async function handleSubmitRepack() {
    if (!selectedTargetId || parsedYield <= 0) {
      setError("Pilih item target dan isi jumlah hasil kemas dengan benar (> 0)");
      return;
    }

    if (recipe.length === 0) {
      setError("Resep BOM pre-pack untuk item ini belum diatur oleh Manager di menu BOM");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetchWithAuth("/api/inventory/repack", {
        method: "POST",
        body: JSON.stringify({
          targetItemId: selectedTargetId,
          yieldQty: parsedYield,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses pre-packing");
      }

      setSuccess(`Berhasil memproses pre-packing ${parsedYield} ${selectedTargetItem?.baseUnit || 'pack'} ${selectedTargetItem?.name}!`);
      setYieldQty("");
      await loadIngredients();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memproses pre-packing");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingItems) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      {/* App Header */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <PackageOpen size={20} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">
                Work Order Pre-Packing & Repack
              </h1>
              <p className="text-xs font-semibold text-slate-400">
                Pencatatan Kemas Gula Tabur, Saos Cup & Pemrosesan Sub-Assembly (ERP Standard)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 md:px-8 max-w-4xl mx-auto space-y-4 pt-5">
        
        {/* Status Messages */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-xs flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center gap-2">
            <ShieldCheck size={16} /> {success}
          </div>
        )}

        <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-sm space-y-5">
          
          <div>
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1.5">
              1. Pilih Item Target Yang Dipack / Dibuat *
            </label>
            <SearchableSelect
              options={targetOptions}
              value={selectedTargetId}
              onChange={(val) => {
                setSelectedTargetId(val);
                setError("");
              }}
              placeholder="Cari item target (misal: Pouch Gula Tabur / Cup Saos Glaze)..."
            />
          </div>

          {selectedTargetItem && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-indigo-900">{selectedTargetItem.name}</p>
                <p className="text-[11px] font-semibold text-indigo-700 mt-0.5">
                  Kategori: {selectedTargetItem.category.replace('_', ' ')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-indigo-500 uppercase">Stok Saat Ini</p>
                <p className="text-sm font-black text-indigo-900">
                  {formatNumber(selectedTargetItem.currentStock)} {selectedTargetItem.baseUnit}
                </p>
              </div>
            </div>
          )}

          {/* BOM Recipe Ingredient Deduction Summary */}
          {selectedTargetId && (
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                2. Komponen Bahan Baku & Kemasan Terpotong (BOM Calculator)
              </label>

              {loadingRecipe ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin text-slate-400" size={20} />
                </div>
              ) : recipe.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                  ⚠️ Resep BOM untuk item ini belum diatur oleh Manager. Harap hubungi Manager untuk mengatur resep di menu BOM & Resep.
                </div>
              ) : (
                <div className="space-y-2">
                  {recipe.map((r) => {
                    const ing = ingredients.find(i => i.id === r.ingredientId);
                    const totalDeducted = r.qtyPerPack * parsedYield;
                    const remainingStock = ing ? ing.currentStock - totalDeducted : 0;
                    const isDeficit = remainingStock < 0;

                    return (
                      <div key={r.ingredientId} className={`p-3.5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs font-semibold ${
                        isDeficit ? "bg-rose-50/70 border-rose-200" : "bg-slate-50 border-slate-100"
                      }`}>
                        <div>
                          <p className="font-extrabold text-slate-800">{ing?.name || "Bahan Baku"}</p>
                          <p className="text-[11px] text-slate-400">Takaran BOM: {r.qtyPerPack} {r.unit} / {selectedTargetItem?.baseUnit || 'pack'}</p>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Terpotong</span>
                            <span className="font-black text-rose-600">
                              -{formatNumber(totalDeducted)} {r.unit}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Sisa Stok Nanti</span>
                            <span className={`font-black ${isDeficit ? 'text-rose-600' : 'text-slate-800'}`}>
                              {formatNumber(remainingStock)} {r.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="yield-qty" className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1.5">
              3. Jumlah Hasil Kemas Selesai (Yield Qty) *
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="yield-qty"
                name="yield-qty"
                type="number"
                placeholder="Contoh: 50"
                value={yieldQty}
                onChange={(e) => setYieldQty(e.target.value)}
                className="h-12 text-sm font-black text-slate-900 bg-white"
              />
              <span className="text-xs font-black text-slate-600 uppercase px-3 py-3 bg-slate-100 rounded-xl">
                {selectedTargetItem?.baseUnit || "pack"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmitRepack}
            disabled={submitting || recipe.length === 0 || parsedYield <= 0}
            className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 
            Proses Pre-Packing ({parsedYield} {selectedTargetItem?.baseUnit || 'pack'})
          </button>

        </div>

      </div>
    </div>
  );
}
