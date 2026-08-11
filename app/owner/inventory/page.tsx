"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ArrowLeft, RefreshCw, AlertTriangle, Package } from "lucide-react";
import Link from "next/link";

interface Ingredient {
  id: string;
  name: string;
  currentStock?: number;
  stock?: number;
  minStock?: number;
  baseUnit?: string;
  category?: string;
  defaultCostPerBaseUnit?: number;
}

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function OwnerInventoryPage() {
  const { fetchWithAuth } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/ingredients");
      if (res.ok) setIngredients(await res.json());
    } finally { setLoading(false); }
  }, [fetchWithAuth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = (search
    ? ingredients.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : ingredients
  ).sort((a, b) => {
    const aLow = (a.currentStock ?? a.stock ?? 0) - (a.minStock ?? 0);
    const bLow = (b.currentStock ?? b.stock ?? 0) - (b.minStock ?? 0);
    return aLow - bLow; // lowest stock first
  });

  const lowCount = ingredients.filter((i) => (i.currentStock ?? i.stock ?? 0) < (i.minStock ?? 0)).length;
  const totalItems = ingredients.length;
  const totalValue = ingredients.reduce((s, i) => s + ((i.currentStock ?? i.stock ?? 0) * (i.defaultCostPerBaseUnit ?? 0)), 0);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/owner/dashboard" className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 text-slate-600">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800">Stok & Bahan</h1>
                <p className="text-xs text-slate-400">{totalItems} item • Nilai: {fmtRupiah(totalValue)}</p>
              </div>
            </div>
            <button onClick={fetchData} className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
              <RefreshCw size={16} className={loading ? "animate-spin text-primary" : ""} />
            </button>
          </div>

          {/* Low stock alert banner */}
          {lowCount > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-800">{lowCount} bahan baku di bawah stok minimum</span>
            </div>
          )}

          <div className="relative">
            <input type="text" placeholder="Cari bahan baku..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-4 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-5xl mx-auto pt-4">
        {loading ? (
          <div className="space-y-2 animate-pulse">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 bg-slate-200 rounded-2xl" />)}</div>
        ) : (
          <div className="space-y-2 pb-4">
            {filtered.map((ing) => {
              const stock = ing.currentStock ?? ing.stock ?? 0;
              const min = ing.minStock ?? 0;
              const isLow = stock < min;
              const pct = min > 0 ? Math.min(100, Math.round((stock / min) * 100)) : stock > 0 ? 100 : 0;
              return (
                <div key={ing.id} className={`rounded-2xl bg-white border shadow-sm p-4 ${isLow ? "border-amber-200" : "border-slate-200/80"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isLow ? "bg-amber-50" : "bg-slate-50"}`}>
                        {isLow ? <AlertTriangle size={16} className="text-amber-500" /> : <Package size={16} className="text-slate-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-800 truncate">{ing.name}</p>
                        <p className="text-[10px] text-slate-400">{ing.category || "bahan_baku"} • {fmtRupiah(ing.defaultCostPerBaseUnit ?? 0)}/{ing.baseUnit || "unit"}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-black tabular-nums ${isLow ? "text-amber-600" : "text-slate-800"}`}>{stock.toLocaleString("id-ID")} {ing.baseUnit || ""}</p>
                      <p className="text-[10px] text-slate-400">min: {min}</p>
                    </div>
                  </div>
                  {min > 0 && (
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${isLow ? "bg-amber-400" : pct > 50 ? "bg-emerald-400" : "bg-blue-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
