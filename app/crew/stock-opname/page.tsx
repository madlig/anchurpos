"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Check, ClipboardList, Box, Search } from "lucide-react";
import type { Ingredient } from "@/types";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";

interface OpnameEntry {
  ingredientId: string; physicalStock?: number | null;
  fullPackages?: number | null; openPackageFullness?: string | null; filled: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  bahan_baku: "🥘 Bahan Baku",
  packaging: "📦 Kemasan",
  operasional: "⚙️ Operasional",
  add_on: "➕ Add-on / Lainnya"
};

export default function CrewStockOpnamePage() {
  const { getToken } = useAuth();
  const { alert } = useAlertConfirm();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Map<string, OpnameEntry>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    fetchWithAuth("/api/ingredients").then((r) => r.json()).then((d) => setIngredients(d as Ingredient[])).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  function updateEntry(id: string, updates: Partial<OpnameEntry>) {
    setEntries((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) ?? { ingredientId: id, filled: false };
      const updated = { ...existing, ...updates };
      const ingredient = ingredients.find((i) => i.id === id);
      if (ingredient?.opnameMethod === "packaged") {
        updated.filled = updated.fullPackages !== null && updated.fullPackages !== undefined;
      } else {
        updated.filled = updated.physicalStock !== null && updated.physicalStock !== undefined;
      }
      next.set(id, updated);
      return next;
    });
  }

  const filledCount = Array.from(entries.values()).filter((e) => e.filled).length;

  async function handleSubmit() {
    const filledEntries = Array.from(entries.values()).filter((e) => e.filled);
    if (filledEntries.length === 0) { 
      await alert("Silakan isi minimal 1 bahan terlebih dahulu.", "Data Kosong", "warning"); 
      return; 
    }
    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/stock-opname", {
        method: "POST",
        body: JSON.stringify({ items: filledEntries.map((e) => ({ ingredientId: e.ingredientId, physicalStock: e.physicalStock ?? null, fullPackages: e.fullPackages ?? null, openPackageFullness: e.openPackageFullness ?? null })) }),
      });
      const d = await res.json();
      if (!res.ok) { 
        await alert(d.error ?? "Gagal menyimpan opname", "Gagal", "danger"); 
        return; 
      }
      
      await alert(`${d.totalChecked} bahan berhasil dicek dan tersimpan!`, "Opname Selesai", "success");
      setEntries(new Map());
    } catch { 
      await alert("Gagal menyimpan opname (Kesalahan Jaringan)", "Error", "danger"); 
    } finally { 
      setSubmitting(false); 
    }
  }

  if (loading) return <div className="flex h-[calc(100vh-80px)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // Filter and group ingredients
  const filtered = ingredients
    .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const groupedIngredients = filtered.reduce((acc, ing) => {
    if (!acc[ing.category]) acc[ing.category] = [];
    acc[ing.category].push(ing);
    return acc;
  }, {} as Record<string, Ingredient[]>);

  // Define display order for categories
  const categoryOrder = ["bahan_baku", "packaging", "add_on", "operasional"];

  return (
    <div className="page-enter min-h-screen pb-24 bg-slate-50/50">
      {/* Header (Glassmorphism) */}
      <div className="px-5 pt-5 pb-5 rounded-b-3xl sticky top-0 z-30 bg-white/90 backdrop-blur-xl shadow-sm border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Mulai Mendata 📝</h1>
            <p className="text-sm mt-1 text-slate-500 font-medium">Progress Gudang: {filledCount}/{ingredients.length} item</p>
          </div>
          <div className="rounded-2xl px-3 py-1.5 bg-primary/10 border border-primary/20 flex flex-col items-center justify-center min-w-[50px]">
             <span className="text-lg font-black text-primary leading-none">{filledCount}</span>
             <span className="text-[10px] font-bold text-primary/70 uppercase">Cek</span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 rounded-full overflow-hidden bg-slate-100 mb-4">
          <div className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-primary to-rose-400" style={{ width: `${ingredients.length > 0 ? (filledCount / ingredients.length) * 100 : 0}%` }} />
        </div>

        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <Input 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari item di rak..."
            className="pl-9 h-11 bg-slate-50 border-slate-200 rounded-xl text-sm font-semibold placeholder:font-medium placeholder:text-slate-400 focus-visible:ring-primary/20"
          />
        </div>
      </div>

      <div className="px-4 mt-6 md:px-8 max-w-4xl mx-auto space-y-8">
        {categoryOrder.map(catKey => {
          const items = groupedIngredients[catKey];
          if (!items || items.length === 0) return null;

          return (
            <div key={catKey} className="space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                {CATEGORY_LABELS[catKey] || catKey}
                <div className="h-px bg-slate-200 flex-1 ml-2"></div>
              </h3>
              
              <div className="space-y-3">
                {items.map((ing) => {
                  const entry = entries.get(ing.id);
                  const isPackaged = ing.opnameMethod === "packaged" && ing.packagedConfig;
                  const isFilled = entry?.filled;
                  
                  return (
                    <div 
                      key={ing.id} 
                      className={`rounded-3xl p-4 transition-all duration-300 border ${
                        isFilled 
                          ? "bg-green-50/50 border-green-200 shadow-sm" 
                          : "bg-white border-slate-200 shadow-sm hover:border-primary/30"
                      }`}
                      data-testid={`opname-${ing.id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex gap-3 items-center">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFilled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                              <Box size={20} strokeWidth={2.5} />
                           </div>
                           <div>
                              <p className={`text-sm font-bold ${isFilled ? 'text-green-900' : 'text-slate-800'}`}>{ing.name}</p>
                              <p className={`text-xs font-medium ${isFilled ? 'text-green-600/70' : 'text-slate-400'}`}>
                                {isPackaged ? `Kemasan (${ing.packagedConfig!.packageLabel})` : `Satuan: ${ing.baseUnit}`}
                              </p>
                           </div>
                        </div>
                        {isFilled && (
                           <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center animate-in zoom-in duration-300">
                             <Check size={14} className="text-white" strokeWidth={3} />
                           </div>
                        )}
                      </div>
                      
                      <div className="pl-13 pt-1">
                        {isPackaged ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-slate-500">
                                Σ {ing.packagedConfig!.packageLabel} Penuh
                              </label>
                              <Input 
                                type="number" min="0" placeholder="0" 
                                value={entry?.fullPackages ?? ""} 
                                onChange={(e) => updateEntry(ing.id, { fullPackages: e.target.value ? parseInt(e.target.value) : null })} 
                                className={`h-11 rounded-2xl text-center text-base font-semibold transition-all ${isFilled ? 'border-green-300 bg-white focus-visible:ring-green-500/20' : 'border-slate-200 bg-slate-50 focus-visible:ring-primary/20'}`} 
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-slate-500">
                                Sisa Buka (%)
                              </label>
                              <select 
                                value={entry?.openPackageFullness ?? ""} 
                                onChange={(e) => updateEntry(ing.id, { openPackageFullness: e.target.value || null })} 
                                className={`w-full h-11 rounded-2xl border px-3 text-sm font-semibold outline-none transition-all ${isFilled ? 'border-green-300 bg-white text-green-800' : 'border-slate-200 bg-slate-50 text-slate-700 focus:border-primary/50'}`}
                              >
                                <option value="">Habis (0%)</option>
                                {ing.packagedConfig!.fullnessOptions.map((opt) => (
                                  <option key={opt.label} value={opt.label}>{opt.label} (~{Math.round(opt.ratio * 100)}%)</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block text-slate-500">
                                Jumlah Fisik
                            </label>
                            <Input 
                              type="number" min="0" placeholder={`Jumlah (${ing.baseUnit})`} 
                              value={entry?.physicalStock ?? ""} 
                              onChange={(e) => updateEntry(ing.id, { physicalStock: e.target.value ? parseFloat(e.target.value) : null })} 
                              className={`h-11 rounded-2xl text-lg font-semibold transition-all ${isFilled ? 'border-green-300 bg-white focus-visible:ring-green-500/20' : 'border-slate-200 bg-slate-50 focus-visible:ring-primary/20'}`} 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        
        {filtered.length === 0 && !loading && (
           <div className="text-center py-10">
              <p className="text-slate-400 text-sm font-medium">Tidak ada bahan baku yang cocok.</p>
           </div>
        )}
      </div>

      {/* Floating Action Button (FAB) Area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent z-40 pb-safe">
         <div className="max-w-4xl mx-auto">
            <button 
              onClick={handleSubmit} 
              disabled={submitting || filledCount === 0} 
              className="w-full h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 tap-target disabled:opacity-50 disabled:active:scale-100 transition-all active:scale-95 bg-gradient-to-br from-primary to-rose-600 shadow-lg shadow-primary/20 border border-white/20"
              data-testid="submit-opname-button"
            >
              {submitting ? (
                 <Loader2 size={20} className="animate-spin" /> 
              ) : (
                 <ClipboardList size={22} />
              )}
              {filledCount === 0 ? 'Isi Data Dulu' : `Selesaikan Mendata (${filledCount} item)`}
            </button>
         </div>
      </div>
    </div>
  );
}
