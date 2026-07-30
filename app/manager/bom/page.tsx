"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Plus, Trash2, Save, BookOpen, Package, Layers } from "lucide-react";
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

export default function BomPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"food" | "packaging">("food");

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
        setProducts(prodList);
        setVariants(Array.isArray(v) ? v : []);
        setIngredients(Array.isArray(i) ? i : []);

        if (prodList.length > 0) {
          setSelectedPkgProductId(prodList[0].id);
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

  // Food Recipe Handlers
  const handleAddIngredient = () => {
    setRecipes([...recipes, { ingredientId: "", qtyPerBatch: 0, unit: "" }]);
  };

  const handleRemoveIngredient = (index: number) => {
    const newR = [...recipes];
    newR.splice(index, 1);
    setRecipes(newR);
  };

  const handleChange = (index: number, field: keyof RecipeItem, value: any) => {
    const newR = [...recipes];
    newR[index] = { ...newR[index], [field]: value };
    if (field === "ingredientId") {
      const ing = ingredients.find((i) => i.id === value);
      if (ing) newR[index].unit = ing.baseUnit;
    }
    setRecipes(newR);
  };

  const handleSaveFoodRecipe = async () => {
    if (!selectedProductId || !selectedVariantId) {
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

  const productOptions: SearchableOption[] = useMemo(() => products.map(p => ({ id: p.id, name: p.name })), [products]);
  const variantOptions: SearchableOption[] = useMemo(() => {
    if (!selectedProductId) return variants.map(v => ({ id: v.id, name: v.name }));
    const filtered = variants.filter(v => v.productId === selectedProductId || !v.productId);
    return filtered.map(v => ({ id: v.id, name: v.name }));
  }, [variants, selectedProductId]);
  const ingredientOptions: SearchableOption[] = useMemo(() => ingredients.map(i => ({ id: i.id, name: i.name, subtext: i.baseUnit })), [ingredients]);

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="text-primary" size={24} />
            Master BOM & Resep Produksi
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Kelola resep adonan makanan (BOM Bahan Baku) dan resep kemasan (BOM Packaging) untuk perhitungan HPP presisi.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab("food")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "food" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers size={14} />
            Resep Adonan
          </button>
          <button
            onClick={() => setActiveTab("packaging")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "packaging" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Package size={14} />
            Resep Kemasan (BOM)
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          {success}
        </div>
      )}

      {/* TAB 1: RESEP ADONAN MAKANAN */}
      {activeTab === "food" && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                1. Pilih Produk
              </label>
              <SearchableSelect
                options={productOptions}
                value={selectedProductId}
                onChange={(val) => {
                  setSelectedProductId(val);
                  setSelectedVariantId("");
                }}
                placeholder="🔍 Ketik atau pilih produk..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                2. Pilih Varian Rasa
              </label>
              <SearchableSelect
                options={variantOptions}
                value={selectedVariantId}
                onChange={(val) => setSelectedVariantId(val)}
                disabled={!selectedProductId}
                placeholder="🔍 Ketik atau pilih varian..."
              />
            </div>
          </div>

          {selectedVariantId && (
            <>
              {/* Cost Summary */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase">HPP Adonan / Batch</div>
                  <div className="text-base font-extrabold text-slate-800">
                    Rp {totalFoodCostPerBatch.toLocaleString("id-ID")}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Estimasi HPP Bahan / Pack</div>
                  <div className="text-base font-extrabold text-emerald-600">
                    Rp {Math.round(foodCostPerPack).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>

              {/* Recipe List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Daftar Bahan Baku Makanan Per Adonan (Batch)
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus size={14} /> Tambah Bahan
                  </button>
                </div>

                {loadingRecipes ? (
                  <div className="py-8 text-center text-slate-400">
                    <Loader2 className="animate-spin inline" size={20} />
                  </div>
                ) : recipes.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-2xl">
                    Belum ada bahan makanan yang didaftarkan. Klik Tambah Bahan.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recipes.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <SearchableSelect
                          options={ingredientOptions}
                          value={item.ingredientId}
                          onChange={(val) => handleChange(idx, "ingredientId", val)}
                          placeholder="🔍 Cari bahan baku..."
                          className="flex-1"
                        />

                        <Input
                          type="number"
                          step="any"
                          placeholder="Jumlah"
                          value={item.qtyPerBatch || ""}
                          onChange={(e) => handleChange(idx, "qtyPerBatch", parseFloat(e.target.value) || 0)}
                          className="w-28 h-11 text-xs font-bold"
                        />

                        <span className="w-12 text-xs font-bold text-slate-500">{item.unit || "-"}</span>

                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveFoodRecipe}
                disabled={submitting}
                className="w-full h-12 rounded-2xl bg-primary text-white font-extrabold text-sm shadow-md shadow-primary/20 hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Simpan Resep Adonan
              </button>
            </>
          )}
        </div>
      )}

      {/* TAB 2: RESEP KEMASAN (PACKAGING BOM) */}
      {activeTab === "packaging" && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Pilih Produk Jadi (Yang Dipacking)
            </label>
            <SearchableSelect
              options={productOptions}
              value={selectedPkgProductId}
              onChange={(val) => setSelectedPkgProductId(val)}
              placeholder="🔍 Ketik atau pilih produk..."
            />
          </div>

          {selectedPkgProductId && (
            <>
              {/* Cost Summary Packaging */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="text-[11px] font-bold text-amber-800 uppercase">HPP Kemasan Per 1 Pack</div>
                <div className="text-base font-extrabold text-amber-900 mt-0.5">
                  Rp {Math.round(totalPackagingCostPerPack).toLocaleString("id-ID")}
                </div>
              </div>

              {/* Packaging Recipe List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Daftar Kemasan per 1 Pack ({selectedPkgProduct?.name})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddPkgIngredient}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus size={14} /> Tambah Kemasan
                  </button>
                </div>

                {loadingRecipes ? (
                  <div className="py-8 text-center text-slate-400">
                    <Loader2 className="animate-spin inline" size={20} />
                  </div>
                ) : pkgRecipes.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-2xl">
                    Belum ada bahan kemasan terdaftar. Klik Tambah Kemasan.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pkgRecipes.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <SearchableSelect
                          options={ingredientOptions}
                          value={item.ingredientId}
                          onChange={(val) => handlePkgChange(idx, "ingredientId", val)}
                          placeholder="🔍 Cari kemasan/bahan..."
                          className="flex-1"
                        />

                        <Input
                          type="number"
                          step="any"
                          placeholder="Qty"
                          value={item.qtyPerPack || ""}
                          onChange={(e) => handlePkgChange(idx, "qtyPerPack", parseFloat(e.target.value) || 0)}
                          className="w-28 h-10 text-xs font-bold"
                        />

                        <span className="w-12 text-xs font-bold text-slate-500">{item.unit || "pcs"}</span>

                        <button
                          type="button"
                          onClick={() => handleRemovePkgIngredient(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSavePkgRecipe}
                disabled={submitting}
                className="w-full h-12 rounded-2xl bg-primary text-white font-extrabold text-sm shadow-md shadow-primary/20 hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Simpan Resep Kemasan (Packaging BOM)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
