"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Plus, Trash2, Save, BookOpen, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

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
}

interface RecipeItem {
  id?: string;
  ingredientId: string;
  qtyPerBatch: number;
  unit: string;
}

export default function BomPage() {
  const { getToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  
  const [loadingData, setLoadingData] = useState(true);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/products").then(r => r.ok ? r.json() : []),
      fetchWithAuth("/api/variants").then(r => r.ok ? r.json() : []),
      fetchWithAuth("/api/ingredients").then(r => r.ok ? r.json() : [])
    ]).then(([p, v, i]) => {
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
      setIngredients(Array.isArray(i) ? i : []);
    }).finally(() => setLoadingData(false));
  }, [fetchWithAuth]);

  useEffect(() => {
    if (!selectedVariantId) {
      setRecipes([]);
      return;
    }
    
    setLoadingRecipes(true);
    fetchWithAuth(`/api/recipes?variantId=${selectedVariantId}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setRecipes(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoadingRecipes(false));
  }, [selectedVariantId, fetchWithAuth]);

  const filteredVariants = useMemo(() => {
    // Varian bersifat global, jadi tampilkan semua varian (atau bisa filter yang isProductionVariant jika perlu)
    return variants;
  }, [variants]);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const packPerBatch = selectedProduct?.packPerBatch || 1;

  const totalCostPerBatch = useMemo(() => {
    return recipes.reduce((sum, item) => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      if (!ing) return sum;
      return sum + (ing.defaultCostPerBaseUnit * item.qtyPerBatch);
    }, 0);
  }, [recipes, ingredients]);

  const costPerPack = totalCostPerBatch / packPerBatch;

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
    
    // Auto-fill unit based on ingredient
    if (field === "ingredientId") {
      const ing = ingredients.find(i => i.id === value);
      if (ing) {
        newR[index].unit = ing.baseUnit;
      }
    }
    setRecipes(newR);
  };

  const handleSave = async () => {
    if (!selectedProductId || !selectedVariantId) {
      setError("Pilih Produk dan Varian terlebih dahulu");
      return;
    }
    
    // Validasi input
    if (recipes.some(r => !r.ingredientId || r.qtyPerBatch <= 0)) {
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
          recipes
        })
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Gagal menyimpan resep");
      } else {
        setSuccess("Resep berhasil disimpan dan diperbarui!");
        setTimeout(() => setSuccess(""), 4000);
      }
    } catch(err) {
      setError("Kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return <div className="flex justify-center p-12"><Loader2 size={32} className="animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto pb-32">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 text-primary">
          <BookOpen size={24} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-800">BOM & Resep</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">Bill of Materials & Estimasi HPP</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-2">
          <label className="text-xs font-bold text-slate-700">1. Pilih Produk</label>
          <select 
            className="w-full text-sm font-medium border-slate-200 rounded-xl h-12 bg-slate-50 text-slate-800 pl-4 pr-10 appearance-none focus:border-primary/50 outline-none"
            value={selectedProductId} 
            onChange={e => {
              setSelectedProductId(e.target.value);
              setSelectedVariantId("");
            }}
          >
            <option value="">-- Produk --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-2">
          <label className="text-xs font-bold text-slate-700">2. Pilih Varian</label>
          <select 
            className="w-full text-sm font-medium border-slate-200 rounded-xl h-12 bg-slate-50 text-slate-800 pl-4 pr-10 appearance-none focus:border-primary/50 outline-none"
            value={selectedVariantId} 
            onChange={e => setSelectedVariantId(e.target.value)}
            disabled={!selectedProductId}
          >
            <option value="">-- Varian --</option>
            {filteredVariants.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedVariantId && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-fade-in">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Komposisi Resep (1 Batch)</h2>
              <p className="text-xs text-slate-500 mt-1">Sistem akan memotong stok bahan ini setiap kali Anda memproduksi 1 batch ({packPerBatch} pack) {selectedProduct?.name}.</p>
            </div>
          </div>

          {loadingRecipes ? (
            <div className="flex justify-center p-8"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
          ) : (
            <div className="space-y-4">
              {recipes.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl">
                  Belum ada bahan untuk resep ini.
                </div>
              )}

              {recipes.map((item, index) => {
                const ing = ingredients.find(i => i.id === item.ingredientId);
                const cost = ing ? ing.defaultCostPerBaseUnit * item.qtyPerBatch : 0;
                
                return (
                  <div key={index} className="flex flex-col md:flex-row gap-3 p-4 bg-slate-50 rounded-2xl items-end relative group">
                    <div className="flex-1 w-full space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Bahan Baku</label>
                      <select 
                        className="w-full text-sm font-medium border-slate-200 rounded-xl h-11 bg-white text-slate-800 pl-3 pr-8 appearance-none focus:border-primary/50 outline-none"
                        value={item.ingredientId} 
                        onChange={e => handleChange(index, "ingredientId", e.target.value)}
                      >
                        <option value="">Pilih Bahan...</option>
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="w-full md:w-32 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Kuantitas</label>
                      <Input 
                        type="number" step="0.01"
                        value={item.qtyPerBatch || ""}
                        onChange={e => handleChange(index, "qtyPerBatch", parseFloat(e.target.value))}
                        className="h-11 rounded-xl text-sm font-bold bg-white"
                        placeholder="0"
                      />
                    </div>

                    <div className="w-full md:w-24 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Satuan</label>
                      <Input 
                        value={item.unit}
                        disabled
                        className="h-11 rounded-xl text-sm font-medium bg-slate-100 text-slate-500"
                      />
                    </div>
                    
                    <div className="w-full md:w-32 space-y-1 text-right">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Estimasi Biaya</label>
                      <div className="h-11 flex flex-col justify-center px-3 bg-white rounded-xl text-sm font-bold text-slate-700 border border-slate-200">
                        <span>Rp {cost.toLocaleString("id-ID")}</span>
                      </div>
                      {ing && ing.defaultCostPerBaseUnit === 0 && (
                        <p className="text-[9px] text-red-400 leading-tight mt-0.5 text-left">
                          *HPP Dasar di Master Data belum diisi
                        </p>
                      )}
                    </div>

                    <button 
                      onClick={() => handleRemoveIngredient(index)}
                      className="absolute -top-2 -right-2 md:static md:top-auto md:right-auto h-8 w-8 md:h-11 md:w-11 bg-white md:bg-transparent rounded-full md:rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors shadow-sm md:shadow-none border border-slate-200 md:border-none"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}

              <button 
                onClick={handleAddIngredient}
                className="w-full py-4 border-2 border-dashed border-primary/30 rounded-2xl text-sm font-bold text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Tambah Bahan Baku
              </button>
            </div>
          )}
        </div>
      )}

      {selectedVariantId && !loadingRecipes && (
        <div className="bg-brand-50 border border-brand-200 rounded-3xl p-5 shadow-sm animate-fade-in flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 text-brand-600"><AlertCircle size={20} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Estimasi HPP (Harga Pokok Penjualan)</p>
              <div className="flex gap-6 mt-1">
                <div>
                  <p className="text-xl font-black text-brand-700">Rp {costPerPack.toLocaleString("id-ID")}</p>
                  <p className="text-[10px] text-brand-600 font-medium">Per Pack/Porsi</p>
                </div>
                <div>
                  <p className="text-xl font-black text-slate-800">Rp {totalCostPerBatch.toLocaleString("id-ID")}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Total 1 Batch ({packPerBatch} pack)</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-auto flex flex-col items-end">
             {error && <p className="text-xs text-red-600 font-bold mb-2">{error}</p>}
             {success && <p className="text-xs text-green-600 font-bold mb-2">{success}</p>}
             <button
               onClick={handleSave}
               disabled={submitting}
               className="w-full md:w-auto h-12 px-8 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
               style={{ background: "linear-gradient(135deg, #E85D8C 0%, #D84275 100%)", boxShadow: "0 4px 12px rgba(232,93,140,0.2)" }}
             >
               {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save size={18} /> Simpan Resep</>}
             </button>
          </div>
        </div>
      )}

    </div>
  );
}
