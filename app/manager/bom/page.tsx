"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Plus, Trash2, Save, BookOpen, Package, Layers, RefreshCw, Box } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchableSelect, SearchableOption } from "@/components/shared/SearchableSelect";

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
  const [activeTab, setActiveTab] = useState<"food" | "packaging" | "prepack">("food");

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

  const [loadingData, setLoadingData] = useState(true);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
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
    ])
      .then(([p, v, i]) => {
        const prodList = Array.isArray(p) ? p : [];
        const ingList = Array.isArray(i) ? i : [];
        setProducts(prodList);
        setVariants(Array.isArray(v) ? v : []);
        setIngredients(ingList);

        if (prodList.length > 0) {
          setSelectedPkgProductId(prodList[0].id);
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

  const selectedPkgProduct = products.find((p) => p.id === selectedPkgProductId);
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
      setTimeout(() => setSuccess(""), 3000);
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
      setTimeout(() => setSuccess(""), 3000);
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
      setTimeout(() => setSuccess(""), 3000);
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
  const ingredientOptions: SearchableOption[] = useMemo(() => ingredients.map(i => ({ id: i.id, name: i.name, subtext: `${i.category?.replace('_', ' ') || 'bahan'} • ${i.baseUnit}` })), [ingredients]);
  
  const prepackTargetOptions: SearchableOption[] = useMemo(() => {
    return ingredients.map(i => ({ id: i.id, name: i.name, subtext: `${i.category?.replace('_', ' ') || 'item'} (${i.baseUnit})` }));
  }, [ingredients]);

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="text-slate-800" size={24} /> Bill of Materials (BOM) & Resep ERP
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Kelola Komposisi Adonan Makanan, Resep Kemasan Produk, dan Sub-Assembly Pre-Packing
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => { setActiveTab("food"); setError(""); setSuccess(""); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "food"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Layers size={14} /> Resep Adonan Makanan
        </button>
        <button
          onClick={() => { setActiveTab("packaging"); setError(""); setSuccess(""); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "packaging"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Package size={14} /> Resep Kemasan Produk
        </button>
        <button
          onClick={() => { setActiveTab("prepack"); setError(""); setSuccess(""); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "prepack"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <RefreshCw size={14} /> Resep Pre-Packing & Repack (Sub-Assembly)
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-xs">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs">
          {success}
        </div>
      )}

      {/* TAB 1: FOOD RECIPE */}
      {activeTab === "food" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Pilih Produk & Varian Perisa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Produk Induk</label>
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
                <label className="text-xs font-bold text-slate-600 mb-1 block">Varian Rasa / Perisa</label>
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
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Komposisi Bahan Adonan (Per 1 Batch Output)</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Output Standard: {packPerBatch} Pack/Batch</p>
                </div>
                <button
                  onClick={handleAddIngredient}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center gap-1"
                >
                  <Plus size={14} /> Tambah Bahan
                </button>
              </div>

              {loadingRecipes ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-slate-400" size={24} />
                </div>
              ) : (
                <div className="space-y-3">
                  {recipes.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <SearchableSelect
                          options={ingredientOptions}
                          value={item.ingredientId}
                          onChange={(val) => handleIngredientChange(idx, "ingredientId", val)}
                          placeholder="Pilih Bahan Baku..."
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          step="any"
                          placeholder="Takaran"
                          value={item.qtyPerBatch || ""}
                          onChange={(e) => handleIngredientChange(idx, "qtyPerBatch", parseFloat(e.target.value) || 0)}
                          className="h-10 text-xs font-bold"
                        />
                      </div>
                      <div className="w-16 text-xs font-bold text-slate-500 flex items-center px-2">
                        {item.unit || "unit"}
                      </div>
                      <button
                        onClick={() => handleRemoveIngredient(idx)}
                        className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  {recipes.length === 0 && (
                    <p className="text-center py-6 text-xs text-slate-400 font-semibold">Belum ada bahan dalam resep ini. Klik 'Tambah Bahan'.</p>
                  )}
                </div>
              )}

              {/* HPP Cost Summary */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-600">Estimasi HPP Bahan Adonan:</span>
                <span className="text-slate-800">
                  Rp {totalFoodCostPerBatch.toLocaleString("id-ID")} / Batch (Rp {foodCostPerPack.toLocaleString("id-ID", { maximumFractionDigits: 0 })} / Pack)
                </span>
              </div>

              <button
                onClick={handleSaveFoodRecipe}
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Resep Adonan
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PACKAGING RECIPE */}
      {activeTab === "packaging" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Pilih Produk Jadi Target</h2>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Produk Jadi</label>
              <SearchableSelect
                options={productOptions}
                value={selectedPkgProductId}
                onChange={(val) => setSelectedPkgProductId(val)}
                placeholder="Pilih Produk Jadi..."
              />
            </div>
          </div>

          {selectedPkgProductId && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Komposisi Kemasan / Packaging (Per 1 Pack Hasil Jual)</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Dipotong saat packing produk atau penjualan POS</p>
                </div>
                <button
                  onClick={handleAddPkgIngredient}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center gap-1"
                >
                  <Plus size={14} /> Tambah Kemasan
                </button>
              </div>

              {loadingRecipes ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-slate-400" size={24} />
                </div>
              ) : (
                <div className="space-y-3">
                  {pkgRecipes.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <SearchableSelect
                          options={ingredientOptions}
                          value={item.ingredientId}
                          onChange={(val) => handlePkgChange(idx, "ingredientId", val)}
                          placeholder="Pilih Kemasan..."
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          step="any"
                          placeholder="Qty / Pack"
                          value={item.qtyPerPack || ""}
                          onChange={(e) => handlePkgChange(idx, "qtyPerPack", parseFloat(e.target.value) || 0)}
                          className="h-10 text-xs font-bold"
                        />
                      </div>
                      <div className="w-16 text-xs font-bold text-slate-500 flex items-center px-2">
                        {item.unit || "pcs"}
                      </div>
                      <button
                        onClick={() => handleRemovePkgIngredient(idx)}
                        className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  {pkgRecipes.length === 0 && (
                    <p className="text-center py-6 text-xs text-slate-400 font-semibold">Belum ada kemasan dalam resep ini. Klik 'Tambah Kemasan'.</p>
                  )}
                </div>
              )}

              {/* HPP Cost Summary */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-600">Estimasi HPP Kemasan:</span>
                <span className="text-slate-800">
                  Rp {totalPackagingCostPerPack.toLocaleString("id-ID", { maximumFractionDigits: 0 })} / Pack
                </span>
              </div>

              <button
                onClick={handleSavePkgRecipe}
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Resep Kemasan
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PRE-PACKING & REPACK SUB-ASSEMBLY BOM */}
      {activeTab === "prepack" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Pilih Item Target Hasil Kemas (Sub-Assembly Item)</h2>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Item Target Hasil Kemas (misal: Pouch Gula Tabur Clip 4x6 / Cup Saos Glaze 25ml)</label>
              <SearchableSelect
                options={prepackTargetOptions}
                value={selectedPrepackItemId}
                onChange={(val) => setSelectedPrepackItemId(val)}
                placeholder="Pilih Item Target Hasil Kemas..."
              />
            </div>
          </div>

          {selectedPrepackItemId && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Komposisi Racikan & Kemasan (Per 1 {selectedPrepackItem?.baseUnit || 'Pack'} Hasil Kemas)</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Dipotong dari stok bahan baku & kemasan saat crew melakukan Work Order Pre-Packing</p>
                </div>
                <button
                  onClick={handleAddPrepackIngredient}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center gap-1"
                >
                  <Plus size={14} /> Tambah Komponen
                </button>
              </div>

              {loadingRecipes ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-slate-400" size={24} />
                </div>
              ) : (
                <div className="space-y-3">
                  {prepackRecipes.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <SearchableSelect
                          options={ingredientOptions}
                          value={item.ingredientId}
                          onChange={(val) => handlePrepackChange(idx, "ingredientId", val)}
                          placeholder="Pilih Bahan / Kemasan..."
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          step="any"
                          placeholder="Takaran"
                          value={item.qtyPerPack || ""}
                          onChange={(e) => handlePrepackChange(idx, "qtyPerPack", parseFloat(e.target.value) || 0)}
                          className="h-10 text-xs font-bold"
                        />
                      </div>
                      <div className="w-16 text-xs font-bold text-slate-500 flex items-center px-2">
                        {item.unit || "unit"}
                      </div>
                      <button
                        onClick={() => handleRemovePrepackIngredient(idx)}
                        className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  {prepackRecipes.length === 0 && (
                    <p className="text-center py-6 text-xs text-slate-400 font-semibold">Belum ada komponen dalam resep pre-pack ini. Klik 'Tambah Komponen'.</p>
                  )}
                </div>
              )}

              {/* Cost Summary */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-600">Estimasi HPP Komponen Pre-Pack:</span>
                <span className="text-slate-800">
                  Rp {totalPrepackCostPerPack.toLocaleString("id-ID", { maximumFractionDigits: 0 })} / {selectedPrepackItem?.baseUnit || 'Pack'}
                </span>
              </div>

              <button
                onClick={handleSavePrepackRecipe}
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Resep Pre-Packing (Sub-Assembly BOM)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
