"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  Loader2, Plus, Trash2, Save, BookOpen, Package, Layers, RefreshCw, Box, 
  SlidersHorizontal, AlertCircle, CheckCircle2, DollarSign, Calculator, ChevronRight, GitFork, ArrowDownRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchableSelect, SearchableOption } from "@/components/shared/SearchableSelect";
import { formatNumber } from "@/lib/formatters";

interface Product {
  id: string;
  name: string;
  packPerBatch: number;
}

interface Variant {
  id: string;
  productId: string;
  name: string;
}

interface Ingredient {
  id: string;
  name: string;
  baseUnit: string;
  defaultCostPerBaseUnit: number;
  category?: string;
}

interface RecipeItem {
  id?: string;
  ingredientId: string;
  qtyPerBatch: number;
  unit: string;
}

interface PackagingRecipeItem {
  id?: string;
  ingredientId: string;
  qtyPerPack: number;
  unit: string;
}

interface PrepackRecipeItem {
  id?: string;
  ingredientId: string;
  qtyPerPack: number;
  unit: string;
}

export default function BomPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"food" | "packaging" | "prepack" | "breakdown">("food");

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  // Food Recipe States
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);

  // Packaging Recipe States
  const [selectedPkgProductId, setSelectedPkgProductId] = useState("");
  const [pkgRecipes, setPkgRecipes] = useState<PackagingRecipeItem[]>([]);

  // Pre-Packing Sub-Assembly Recipe States
  const [selectedPrepackItemId, setSelectedPrepackItemId] = useState("");
  const [prepackRecipes, setPrepackRecipes] = useState<PrepackRecipeItem[]>([]);

  // Breakdown Multi-Level View States
  const [breakdownProductId, setBreakdownProductId] = useState("");
  const [breakdownVariantId, setBreakdownVariantId] = useState("");
  const [breakdownFoodRecipes, setBreakdownFoodRecipes] = useState<RecipeItem[]>([]);
  const [breakdownPkgRecipes, setBreakdownPkgRecipes] = useState<PackagingRecipeItem[]>([]);
  const [allPrepackRecipesMap, setAllPrepackRecipesMap] = useState<Record<string, PrepackRecipeItem[]>>({});

  const [loadingData, setLoadingData] = useState(true);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

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

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/products").then((r) => (r.ok ? r.json() : [])),
      fetchWithAuth("/api/variants").then((r) => (r.ok ? r.json() : [])),
      fetchWithAuth("/api/ingredients").then((r) => (r.ok ? r.json() : [])),
      fetchWithAuth("/api/recipes/prepack").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([p, v, i, pre]) => {
        const prodList = Array.isArray(p) ? p : [];
        const ingList = Array.isArray(i) ? i : [];
        const preList = Array.isArray(pre) ? pre : [];
        setProducts(prodList);
        setVariants(Array.isArray(v) ? v : []);
        setIngredients(ingList);

        // Group prepack recipes by targetItemId
        const preMap: Record<string, PrepackRecipeItem[]> = {};
        for (const item of preList) {
          if (!preMap[item.targetItemId]) preMap[item.targetItemId] = [];
          preMap[item.targetItemId].push(item);
        }
        setAllPrepackRecipesMap(preMap);

        if (prodList.length > 0) {
          setSelectedPkgProductId(prodList[0].id);
          setBreakdownProductId(prodList[0].id);
        }
        if (ingList.length > 0) {
          const defaultPrepack = ingList.find(item => item.category === "add_on" || item.category === "packaging") || ingList[0];
          setSelectedPrepackItemId(defaultPrepack.id);
        }
      })
      .finally(() => setLoadingData(false));
  }, [fetchWithAuth]);

  // Fetch Food Recipe
  useEffect(() => {
    if (!selectedVariantId) {
      setRecipes([]);
      return;
    }

    setLoadingRecipes(true);
    fetchWithAuth(`/api/recipes?variantId=${selectedVariantId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setRecipes(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoadingRecipes(false));
  }, [selectedVariantId, fetchWithAuth]);

  // Fetch Packaging Recipe
  useEffect(() => {
    if (!selectedPkgProductId) {
      setPkgRecipes([]);
      return;
    }

    setLoadingRecipes(true);
    fetchWithAuth(`/api/recipes/packaging?productId=${selectedPkgProductId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setPkgRecipes(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoadingRecipes(false));
  }, [selectedPkgProductId, fetchWithAuth]);

  // Fetch Pre-packing Recipe
  useEffect(() => {
    if (!selectedPrepackItemId) {
      setPrepackRecipes([]);
      return;
    }

    setLoadingRecipes(true);
    fetchWithAuth(`/api/recipes/prepack?targetItemId=${selectedPrepackItemId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setPrepackRecipes(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoadingRecipes(false));
  }, [selectedPrepackItemId, fetchWithAuth]);

  // Fetch Breakdown Recipe Data
  useEffect(() => {
    if (activeTab !== "breakdown" || !breakdownProductId) return;

    setLoadingBreakdown(true);
    Promise.all([
      fetchWithAuth(`/api/recipes/packaging?productId=${breakdownProductId}`).then(r => r.ok ? r.json() : []),
      breakdownVariantId ? fetchWithAuth(`/api/recipes?variantId=${breakdownVariantId}`).then(r => r.ok ? r.json() : []) : Promise.resolve([]),
    ])
      .then(([pkgData, foodData]) => {
        setBreakdownPkgRecipes(Array.isArray(pkgData) ? pkgData : []);
        setBreakdownFoodRecipes(Array.isArray(foodData) ? foodData : []);
      })
      .finally(() => setLoadingBreakdown(false));
  }, [activeTab, breakdownProductId, breakdownVariantId, fetchWithAuth]);

  // Cost calculations
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const packPerBatch = selectedProduct?.packPerBatch || 1;

  const totalFoodCostPerBatch = useMemo(() => {
    return recipes.reduce((sum, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      if (!ing) return sum;
      return sum + ing.defaultCostPerBaseUnit * item.qtyPerBatch;
    }, 0);
  }, [recipes, ingredients]);

  const foodCostPerPack = totalFoodCostPerBatch / packPerBatch;

  const totalPackagingCostPerPack = useMemo(() => {
    return pkgRecipes.reduce((sum, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      if (!ing) return sum;
      return sum + ing.defaultCostPerBaseUnit * item.qtyPerPack;
    }, 0);
  }, [pkgRecipes, ingredients]);

  const selectedPrepackItem = ingredients.find((i) => i.id === selectedPrepackItemId);
  const totalPrepackCostPerPack = useMemo(() => {
    return prepackRecipes.reduce((sum, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      if (!ing) return sum;
      return sum + ing.defaultCostPerBaseUnit * item.qtyPerPack;
    }, 0);
  }, [prepackRecipes, ingredients]);

  // Food Recipe Handlers
  const handleAddIngredient = () => {
    setRecipes([...recipes, { ingredientId: "", qtyPerBatch: 0, unit: "" }]);
  };

  const handleRemoveIngredient = (index: number) => {
    const newR = [...recipes];
    newR.splice(index, 1);
    setRecipes(newR);
  };

  const handleIngredientChange = (index: number, field: keyof RecipeItem, value: any) => {
    const newR = [...recipes];
    newR[index] = { ...newR[index], [field]: value };
    if (field === "ingredientId") {
      const ing = ingredients.find((i) => i.id === value);
      if (ing) newR[index].unit = ing.baseUnit;
    }
    setRecipes(newR);
  };

  const handleSaveFoodRecipe = async () => {
    if (!selectedVariantId || !selectedProductId) {
      setError("Pilih Produk dan Varian terlebih dahulu");
      return;
    }

    if (recipes.some((r) => !r.ingredientId || r.qtyPerBatch <= 0)) {
      setError("Pastikan semua bahan telah dipilih dan kuantitas > 0");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetchWithAuth("/api/recipes", {
        method: "POST",
        body: JSON.stringify({
          productId: selectedProductId,
          variantId: selectedVariantId,
          recipes,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Gagal menyimpan resep");
      }

      setSuccess("Resep adonan makanan berhasil disimpan!");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan resep");
    } finally {
      setSubmitting(false);
    }
  };

  // Packaging Recipe Handlers
  const handleAddPkgIngredient = () => {
    setPkgRecipes([...pkgRecipes, { ingredientId: "", qtyPerPack: 1, unit: "pcs" }]);
  };

  const handleRemovePkgIngredient = (index: number) => {
    const newP = [...pkgRecipes];
    newP.splice(index, 1);
    setPkgRecipes(newP);
  };

  const handlePkgChange = (index: number, field: keyof PackagingRecipeItem, value: any) => {
    const newP = [...pkgRecipes];
    newP[index] = { ...newP[index], [field]: value };
    if (field === "ingredientId") {
      const ing = ingredients.find((i) => i.id === value);
      if (ing) newP[index].unit = ing.baseUnit;
    }
    setPkgRecipes(newP);
  };

  const handleSavePkgRecipe = async () => {
    if (!selectedPkgProductId) {
      setError("Pilih Produk Jadi terlebih dahulu");
      return;
    }

    if (pkgRecipes.some((r) => !r.ingredientId || r.qtyPerPack <= 0)) {
      setError("Pastikan semua kemasan telah dipilih dan kuantitas > 0");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetchWithAuth("/api/recipes/packaging", {
        method: "POST",
        body: JSON.stringify({
          productId: selectedPkgProductId,
          items: pkgRecipes,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Gagal menyimpan resep kemasan");
      }

      setSuccess("Resep kemasan (Packaging BOM) berhasil disimpan!");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan resep kemasan");
    } finally {
      setSubmitting(false);
    }
  };

  // Prepack Recipe Handlers
  const handleAddPrepackIngredient = () => {
    setPrepackRecipes([...prepackRecipes, { ingredientId: "", qtyPerPack: 1, unit: "pcs" }]);
  };

  const handleRemovePrepackIngredient = (index: number) => {
    const newP = [...prepackRecipes];
    newP.splice(index, 1);
    setPrepackRecipes(newP);
  };

  const handlePrepackChange = (index: number, field: keyof PrepackRecipeItem, value: any) => {
    const newP = [...prepackRecipes];
    newP[index] = { ...newP[index], [field]: value };
    if (field === "ingredientId") {
      const ing = ingredients.find((i) => i.id === value);
      if (ing) newP[index].unit = ing.baseUnit;
    }
    setPrepackRecipes(newP);
  };

  const handleSavePrepackRecipe = async () => {
    if (!selectedPrepackItemId) {
      setError("Pilih Target Item Pre-Pack terlebih dahulu");
      return;
    }

    if (prepackRecipes.some((r) => !r.ingredientId || r.qtyPerPack <= 0)) {
      setError("Pastikan semua komponen bahan & kemasan telah dipilih dan kuantitas > 0");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetchWithAuth("/api/recipes/prepack", {
        method: "POST",
        body: JSON.stringify({
          targetItemId: selectedPrepackItemId,
          items: prepackRecipes,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Gagal menyimpan resep pre-pack");
      }

      setSuccess("Resep Pre-Packing & Repack (Sub-Assembly BOM) berhasil disimpan!");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan resep pre-pack");
    } finally {
      setSubmitting(false);
    }
  };

  const productOptions: SearchableOption[] = useMemo(() => products.map(p => ({ id: p.id, name: p.name })), [products]);
  const variantOptions: SearchableOption[] = useMemo(() => {
    if (!selectedProductId) return variants.map(v => ({ id: v.id, name: v.name }));
    const filtered = variants.filter(v => v.productId === selectedProductId || !v.productId);
    return filtered.map(v => ({ id: v.id, name: v.name }));
  }, [variants, selectedProductId]);

  const breakdownVariantOptions: SearchableOption[] = useMemo(() => {
    if (!breakdownProductId) return [];
    return variants.filter(v => v.productId === breakdownProductId || !v.productId).map(v => ({ id: v.id, name: v.name }));
  }, [variants, breakdownProductId]);
  
  const ingredientOptions: SearchableOption[] = useMemo(() => ingredients.map(i => ({ 
    id: i.id, 
    name: i.name, 
    subtext: `${i.category?.replace('_', ' ') || 'bahan'} • HPP: Rp ${formatNumber(i.defaultCostPerBaseUnit || 0)}/${i.baseUnit}` 
  })), [ingredients]);
  
  const prepackTargetOptions: SearchableOption[] = useMemo(() => {
    return [...ingredients]
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { add_on: 1, packaging: 2, bahan_baku: 3, operasional: 4 };
        const pA = priorityOrder[a.category || "bahan_baku"] || 5;
        const pB = priorityOrder[b.category || "bahan_baku"] || 5;
        if (pA !== pB) return pA - pB;
        return a.name.localeCompare(b.name);
      })
      .map(i => ({ 
        id: i.id, 
        name: i.name, 
        subtext: `[${(i.category || 'item').toUpperCase().replace('_', ' ')}] Satuan: ${i.baseUnit}` 
      }));
  }, [ingredients]);

  // Breakdown Multi-Level Tree Calculations
  const selectedBreakdownProduct = products.find(p => p.id === breakdownProductId);
  const selectedBreakdownVariant = variants.find(v => v.id === breakdownVariantId);
  const breakdownPackPerBatch = selectedBreakdownProduct?.packPerBatch || 1;

  const breakdownFoodCostPerBatch = useMemo(() => {
    return breakdownFoodRecipes.reduce((sum, item) => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      return sum + (ing?.defaultCostPerBaseUnit || 0) * item.qtyPerBatch;
    }, 0);
  }, [breakdownFoodRecipes, ingredients]);

  const breakdownFoodCostPerPack = breakdownFoodCostPerBatch / breakdownPackPerBatch;

  const breakdownPkgTotalCost = useMemo(() => {
    return breakdownPkgRecipes.reduce((sum, item) => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      let cost = (ing?.defaultCostPerBaseUnit || 0) * item.qtyPerPack;
      
      // Add subpack BOM costs if this item has prepackRecipe
      const subRecipes = allPrepackRecipesMap[item.ingredientId];
      if (subRecipes && subRecipes.length > 0) {
        const subCost = subRecipes.reduce((subSum, sub) => {
          const subIng = ingredients.find(i => i.id === sub.ingredientId);
          return subSum + (subIng?.defaultCostPerBaseUnit || 0) * sub.qtyPerPack;
        }, 0);
        cost = subCost * item.qtyPerPack;
      }

      return sum + cost;
    }, 0);
  }, [breakdownPkgRecipes, ingredients, allPrepackRecipesMap]);

  const totalFinishedGoodsHpp = breakdownFoodCostPerPack + breakdownPkgTotalCost;

  if (loadingData) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
      </div>
    );
  }

  const TABS = [
    { key: "food", label: "Resep Adonan Makanan", icon: Layers, desc: "Resep Komposisi Adonan Makanan per Batch" },
    { key: "packaging", label: "Resep Kemasan Produk", icon: Package, desc: "BOM Kemasan per Pack Produk Jadi" },
    { key: "prepack", label: "Resep Pre-Packing & Repack", icon: RefreshCw, desc: "Sub-Assembly BOM Repack Gula & Saos" },
    { key: "breakdown", label: "Ringkasan Isian Produk (Assembly Tree)", icon: GitFork, desc: "Struktur Pohon Isian & HPP Terpadu" },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      
      {/* Native App Header (Gojek/Grab Style) */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                <BookOpen size={20} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">
                  Bill of Materials (BOM) & Resep
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  Master Takaran Adonan, Kemasan & Sub-Assembly (ERP Standard)
                </p>
              </div>
            </div>
          </div>

          {/* Horizontal Scroll Tabs (Gojek / Grab Style) */}
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pt-1">
            <div className="flex items-center gap-1.5 min-w-max">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setActiveTab(t.key as any); setError(""); setSuccess(""); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                      isActive 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                        : 'bg-slate-100/80 text-slate-600 border-slate-200/80 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-4 pt-5">

        {/* Notifications */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        {/* TAB 1: FOOD RECIPE */}
        {activeTab === "food" && (
          <div className="space-y-4">
            
            {/* Selection Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">Pilih Produk & Varian Perisa Target</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Produk Induk *</label>
                  <SearchableSelect
                    options={productOptions}
                    value={selectedProductId}
                    onChange={(val) => {
                      setSelectedProductId(val);
                      setSelectedVariantId("");
                    }}
                    placeholder="Pilih Produk Induk..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Varian Rasa / Perisa *</label>
                  <SearchableSelect
                    options={variantOptions}
                    value={selectedVariantId}
                    onChange={(val) => setSelectedVariantId(val)}
                    placeholder="Pilih Varian Rasa..."
                  />
                </div>
              </div>
            </div>

            {selectedVariantId && (
              <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Komposisi Adonan (Batch BOM)</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Takaran Adonan per {packPerBatch} Pack Output Batch</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95"
                  >
                    <Plus size={14} /> Tambah Bahan
                  </button>
                </div>

                {loadingRecipes ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-slate-400" size={24} />
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recipes.map((item, idx) => {
                      const ing = ingredients.find((i) => i.id === item.ingredientId);
                      const rowSubtotal = (ing?.defaultCostPerBaseUnit || 0) * (item.qtyPerBatch || 0);

                      return (
                        <div key={idx} style={{ zIndex: 100 - idx }} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 relative">
                          {/* Left: SearchableSelect */}
                          <div className="flex-1 min-w-0">
                            <SearchableSelect
                              options={ingredientOptions}
                              value={item.ingredientId}
                              onChange={(val) => handleIngredientChange(idx, "ingredientId", val)}
                              placeholder="Pilih Bahan Baku..."
                            />
                          </div>

                          {/* Right Controls */}
                          <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                            {/* Takaran Input Badge Pill */}
                            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                              <Input
                                type="number"
                                step="any"
                                placeholder="Takaran"
                                value={item.qtyPerBatch || ""}
                                onChange={(e) => handleIngredientChange(idx, "qtyPerBatch", parseFloat(e.target.value) || 0)}
                                className="h-8 w-20 text-xs font-black text-slate-800 border-none bg-transparent px-1 focus-visible:ring-0 shadow-none text-right"
                              />
                              <span className="text-[11px] font-extrabold text-slate-500 shrink-0">
                                {item.unit || "unit"}
                              </span>
                            </div>

                            {/* Subtotal HPP */}
                            <div className="text-right min-w-[110px]">
                              <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Subtotal HPP</span>
                              <span className="text-xs font-black text-slate-800">Rp {formatNumber(rowSubtotal)}</span>
                            </div>

                            {/* Delete Trash Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(idx)}
                              className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shrink-0 border border-rose-100/60 active:scale-95"
                              title="Hapus Bahan"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {recipes.length === 0 && (
                      <div className="p-8 rounded-2xl bg-slate-50 text-center border border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-400">Belum ada bahan baku dalam resep ini. Klik 'Tambah Bahan'.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* HPP Cost Summary Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <Calculator size={20} className="text-indigo-300" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Kalkulator HPP Adonan</p>
                      <p className="text-xs font-bold text-slate-300">Estimasi Total HPP per Batch Produksi</p>
                    </div>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-lg font-black tracking-tight text-white">
                      Rp {formatNumber(totalFoodCostPerBatch)} <span className="text-xs font-bold text-indigo-300">/ Batch</span>
                    </p>
                    <p className="text-xs font-extrabold text-indigo-300">
                      (Rp {formatNumber(Math.round(foodCostPerPack))} / Pack)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveFoodRecipe}
                  disabled={submitting}
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Resep Adonan Makanan
                </button>

              </div>
            )}

          </div>
        )}

        {/* TAB 2: PACKAGING RECIPE */}
        {activeTab === "packaging" && (
          <div className="space-y-4">
            
            {/* Selection Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">Pilih Produk Jadi Target</h2>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Produk Jadi *</label>
                <SearchableSelect
                  options={productOptions}
                  value={selectedPkgProductId}
                  onChange={(val) => setSelectedPkgProductId(val)}
                  placeholder="Pilih Produk Jadi..."
                />
              </div>
            </div>

            {selectedPkgProductId && (
              <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Komposisi Kemasan (Packaging BOM)</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Potong Stok Kemasan per 1 Pack Produk Jadi Terjual/Kemas</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddPkgIngredient}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95"
                  >
                    <Plus size={14} /> Tambah Kemasan
                  </button>
                </div>

                {loadingRecipes ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-slate-400" size={24} />
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pkgRecipes.map((item, idx) => {
                      const ing = ingredients.find((i) => i.id === item.ingredientId);
                      const rowSubtotal = (ing?.defaultCostPerBaseUnit || 0) * (item.qtyPerPack || 0);

                      return (
                        <div key={idx} style={{ zIndex: 100 - idx }} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 relative">
                          {/* Left: SearchableSelect */}
                          <div className="flex-1 min-w-0">
                            <SearchableSelect
                              options={ingredientOptions}
                              value={item.ingredientId}
                              onChange={(val) => handlePkgChange(idx, "ingredientId", val)}
                              placeholder="Pilih Item Kemasan..."
                            />
                          </div>

                          {/* Right Controls */}
                          <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                            {/* Takaran Input Badge Pill */}
                            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                              <Input
                                type="number"
                                step="any"
                                placeholder="Qty / Pack"
                                value={item.qtyPerPack || ""}
                                onChange={(e) => handlePkgChange(idx, "qtyPerPack", parseFloat(e.target.value) || 0)}
                                className="h-8 w-20 text-xs font-black text-slate-800 border-none bg-transparent px-1 focus-visible:ring-0 shadow-none text-right"
                              />
                              <span className="text-[11px] font-extrabold text-slate-500 shrink-0">
                                {item.unit || "pcs"}
                              </span>
                            </div>

                            {/* Subtotal HPP */}
                            <div className="text-right min-w-[110px]">
                              <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Subtotal HPP</span>
                              <span className="text-xs font-black text-slate-800">Rp {formatNumber(rowSubtotal)}</span>
                            </div>

                            {/* Delete Trash Button */}
                            <button
                              type="button"
                              onClick={() => handleRemovePkgIngredient(idx)}
                              className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shrink-0 border border-rose-100/60 active:scale-95"
                              title="Hapus Kemasan"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {pkgRecipes.length === 0 && (
                      <div className="p-8 rounded-2xl bg-slate-50 text-center border border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-400">Belum ada kemasan dalam resep ini. Klik 'Tambah Kemasan'.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* HPP Cost Summary Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <Package size={20} className="text-indigo-300" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Estimasi HPP Kemasan</p>
                      <p className="text-xs font-bold text-slate-300">Biaya Packaging per 1 Pack Produk</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-black tracking-tight text-white">
                      Rp {formatNumber(Math.round(totalPackagingCostPerPack))} <span className="text-xs font-bold text-indigo-300">/ Pack</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSavePkgRecipe}
                  disabled={submitting}
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Resep Kemasan Produk
                </button>

              </div>
            )}

          </div>
        )}

        {/* TAB 3: PRE-PACKING & REPACK SUB-ASSEMBLY BOM */}
        {activeTab === "prepack" && (
          <div className="space-y-4">
            
            {/* Selection Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">Pilih Item Target Hasil Kemas (Sub-Assembly)</h2>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Item Hasil Kemas (misal: Pouch Gula Tabur Clip 4x6 / Cup Saos Glaze 25ml) *</label>
                <SearchableSelect
                  options={prepackTargetOptions}
                  value={selectedPrepackItemId}
                  onChange={(val) => setSelectedPrepackItemId(val)}
                  placeholder="Pilih Item Target Hasil Kemas..."
                />
              </div>
            </div>

            {selectedPrepackItemId && (
              <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Komposisi Racikan & Kemasan Sub-Assembly</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Takaran Per 1 {selectedPrepackItem?.baseUnit || 'Pack'} Hasil Kemas Crew</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddPrepackIngredient}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95"
                  >
                    <Plus size={14} /> Tambah Komponen
                  </button>
                </div>

                {loadingRecipes ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-slate-400" size={24} />
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {prepackRecipes.map((item, idx) => {
                      const ing = ingredients.find((i) => i.id === item.ingredientId);
                      const rowSubtotal = (ing?.defaultCostPerBaseUnit || 0) * (item.qtyPerPack || 0);

                      return (
                        <div key={idx} style={{ zIndex: 100 - idx }} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 relative">
                          {/* Left: SearchableSelect */}
                          <div className="flex-1 min-w-0">
                            <SearchableSelect
                              options={ingredientOptions}
                              value={item.ingredientId}
                              onChange={(val) => handlePrepackChange(idx, "ingredientId", val)}
                              placeholder="Pilih Bahan / Kemasan Komponen..."
                            />
                          </div>

                          {/* Right Controls */}
                          <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                            {/* Takaran Input Badge Pill */}
                            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                              <Input
                                type="number"
                                step="any"
                                placeholder="Takaran"
                                value={item.qtyPerPack || ""}
                                onChange={(e) => handlePrepackChange(idx, "qtyPerPack", parseFloat(e.target.value) || 0)}
                                className="h-8 w-20 text-xs font-black text-slate-800 border-none bg-transparent px-1 focus-visible:ring-0 shadow-none text-right"
                              />
                              <span className="text-[11px] font-extrabold text-slate-500 shrink-0">
                                {item.unit || "unit"}
                              </span>
                            </div>

                            {/* Subtotal HPP */}
                            <div className="text-right min-w-[110px]">
                              <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Subtotal HPP</span>
                              <span className="text-xs font-black text-slate-800">Rp {formatNumber(rowSubtotal)}</span>
                            </div>

                            {/* Delete Trash Button */}
                            <button
                              type="button"
                              onClick={() => handleRemovePrepackIngredient(idx)}
                              className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shrink-0 border border-rose-100/60 active:scale-95"
                              title="Hapus Komponen"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {prepackRecipes.length === 0 && (
                      <div className="p-8 rounded-2xl bg-slate-50 text-center border border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-400">Belum ada komponen dalam resep ini. Klik 'Tambah Komponen'.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* HPP Cost Summary Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <RefreshCw size={20} className="text-indigo-300" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Estimasi HPP Pre-Pack</p>
                      <p className="text-xs font-bold text-slate-300">Biaya Racikan & Kemasan per 1 {selectedPrepackItem?.baseUnit || 'Pack'}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-black tracking-tight text-white">
                      Rp {formatNumber(Math.round(totalPrepackCostPerPack))} <span className="text-xs font-bold text-indigo-300">/ {selectedPrepackItem?.baseUnit || 'Pack'}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSavePrepackRecipe}
                  disabled={submitting}
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Resep Pre-Packing (Sub-Assembly BOM)
                </button>

              </div>
            )}

          </div>
        )}

        {/* TAB 4: BREAKDOWN MULTI-LEVEL ASSEMBLY TREE */}
        {activeTab === "breakdown" && (
          <div className="space-y-4">
            
            {/* Selection Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
              <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">Pilih Produk & Varian Untuk Melihat Pohon Struktur Isian</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Produk Induk *</label>
                  <SearchableSelect
                    options={productOptions}
                    value={breakdownProductId}
                    onChange={(val) => {
                      setBreakdownProductId(val);
                      setBreakdownVariantId("");
                    }}
                    placeholder="Pilih Produk Induk..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Varian Rasa / Perisa</label>
                  <SearchableSelect
                    options={breakdownVariantOptions}
                    value={breakdownVariantId}
                    onChange={(val) => setBreakdownVariantId(val)}
                    placeholder="Pilih Varian Rasa..."
                  />
                </div>
              </div>
            </div>

            {breakdownProductId && (
              <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-sm space-y-6">
                
                {/* Header Summary */}
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <GitFork size={18} className="text-indigo-600" />
                      {selectedBreakdownProduct?.name} {selectedBreakdownVariant ? `(${selectedBreakdownVariant.name})` : ""}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Tampilan Structure Tree (Multi-Level BOM ERP) & Rincian Transparan Komponen Isi Pack
                    </p>
                  </div>

                  <div className="px-4 py-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-right">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase block">Total HPP Barang Jadi</span>
                    <span className="text-lg font-black text-indigo-950">
                      Rp {formatNumber(Math.round(totalFinishedGoodsHpp))} <span className="text-xs font-bold text-indigo-600">/ Pack</span>
                    </span>
                  </div>
                </div>

                {loadingBreakdown ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-slate-400" size={24} />
                  </div>
                ) : (
                  <div className="space-y-6">
                    
                    {/* SECTION 1: FOOD BOM (BATCH) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Layers size={15} className="text-slate-600" /> 1. Komponen Adonan Makanan (Food BOM)
                        </h4>
                        <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                          Subtotal HPP: Rp {formatNumber(Math.round(breakdownFoodCostPerPack))} / Pack
                        </span>
                      </div>

                      {breakdownFoodRecipes.length === 0 ? (
                        <p className="text-xs font-bold text-slate-400 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          Belum ada resep adonan yang diatur untuk varian ini.
                        </p>
                      ) : (
                        <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2">
                          {breakdownFoodRecipes.map(r => {
                            const ing = ingredients.find(i => i.id === r.ingredientId);
                            const cost = (ing?.defaultCostPerBaseUnit || 0) * r.qtyPerBatch;
                            return (
                              <div key={r.ingredientId} className="flex justify-between items-center text-xs font-medium border-b border-slate-200/50 pb-2 last:border-0 last:pb-0">
                                <span className="text-slate-700 font-bold flex items-center gap-1.5">
                                  <ChevronRight size={14} className="text-slate-400" />
                                  {ing?.name || r.ingredientId} ({r.qtyPerBatch} {r.unit} / Batch)
                                </span>
                                <span className="font-extrabold text-slate-800">Rp {formatNumber(Math.round(cost / breakdownPackPerBatch))} / Pack</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* SECTION 2: PACKAGING & SUB-ASSEMBLY PREPACK BOM */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Package size={15} className="text-slate-600" /> 2. Komponen Kemasan & Sub-Assembly (Packaging & Prepack BOM)
                        </h4>
                        <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                          Subtotal HPP: Rp {formatNumber(Math.round(breakdownPkgTotalCost))} / Pack
                        </span>
                      </div>

                      {breakdownPkgRecipes.length === 0 ? (
                        <p className="text-xs font-bold text-slate-400 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          Belum ada kemasan atau item pendamping yang diatur untuk produk ini.
                        </p>
                      ) : (
                        <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-3">
                          {breakdownPkgRecipes.map(r => {
                            const ing = ingredients.find(i => i.id === r.ingredientId);
                            const subRecipes = allPrepackRecipesMap[r.ingredientId];
                            const hasSub = subRecipes && subRecipes.length > 0;

                            let unitCost = ing?.defaultCostPerBaseUnit || 0;
                            if (hasSub) {
                              unitCost = subRecipes.reduce((sSum, s) => {
                                const sIng = ingredients.find(i => i.id === s.ingredientId);
                                return sSum + (sIng?.defaultCostPerBaseUnit || 0) * s.qtyPerPack;
                              }, 0);
                            }
                            const totalRowCost = unitCost * r.qtyPerPack;

                            return (
                                <div key={r.ingredientId} className="space-y-1.5 border-b border-slate-200/60 pb-2.5 last:border-0 last:pb-0">
                                  <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-900 flex items-center gap-1.5">
                                      <ChevronRight size={14} className="text-indigo-600" />
                                      {ing?.name || r.ingredientId} ({r.qtyPerPack} {r.unit} / Pack)
                                      {ing?.category === "add_on" && (
                                        <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                          Included Add-On
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-black text-slate-900">Rp {formatNumber(Math.round(totalRowCost))}</span>
                                  </div>

                                  {/* Render Subpack Components Tree */}
                                  {hasSub && (
                                    <div className="pl-6 space-y-1 border-l-2 border-indigo-200 my-1 py-1">
                                      <p className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                        <GitFork size={12} /> Resep Racikan Pre-Pack Sub-Assembly:
                                      </p>
                                      {subRecipes.map(s => {
                                        const sIng = ingredients.find(i => i.id === s.ingredientId);
                                        const sCost = (sIng?.defaultCostPerBaseUnit || 0) * s.qtyPerPack;
                                        return (
                                          <div key={s.ingredientId} className="flex justify-between items-center text-[11px] text-slate-600 font-medium">
                                            <span className="flex items-center gap-1">
                                              <ArrowDownRight size={12} className="text-slate-400" />
                                              {sIng?.name || s.ingredientId} ({s.qtyPerPack} {s.unit})
                                            </span>
                                            <span className="font-bold text-slate-700">Rp {formatNumber(Math.round(sCost))}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
