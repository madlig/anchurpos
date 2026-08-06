"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { RefreshCw, LogOut, CheckCircle2, ChevronRight, PackageSearch, Package, PenLine, Scale, Plus, Minus, Search, Check, ClipboardList, AlertCircle, Save, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";

interface OpnameItemUI {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  currentStock: number;
  opnameMethod?: string;
  packageUnit?: string;
  itemType: "ingredient" | "variant";
}

interface OpnameEntry {
  ingredientId: string; 
  physicalStock?: number | null;
  fullPackages?: number | null; 
  openPackageFullness?: string | null; 
  filled: boolean;
}

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: "barang_jadi", label: "Barang Jadi (Frozen)" },
  { key: "bahan_baku", label: "Bahan Baku" },
  { key: "packaging", label: "Kemasan & Packaging" },
  { key: "operasional", label: "Operasional" },
  { key: "add_on", label: "Add-On" },
];

export default function CrewStockOpnamePage() {
  const { getToken } = useAuth();
  const { alert } = useAlertConfirm();
  
  const [items, setItems] = useState<OpnameItemUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Map<string, OpnameEntry>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("barang_jadi");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    try {
      const [resIng, resVar] = await Promise.all([
        fetchWithAuth("/api/ingredients"),
        fetchWithAuth("/api/products/stocks")
      ]);

      let allItems: OpnameItemUI[] = [];
      if (resIng.ok) {
        const data = await resIng.json();
        allItems = [...allItems, ...data.map((i: any) => ({ ...i, itemType: "ingredient" }))];
      }
      if (resVar.ok) {
        const data = await resVar.json();
        allItems = [...allItems, ...data.map((v: any) => ({
          id: v.id,
          name: v.name,
          category: "barang_jadi",
          baseUnit: "pack",
          currentStock: v.currentStock || 0,
          itemType: "variant"
        }))];
      }
      setItems(allItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateEntry(id: string, updates: Partial<OpnameEntry>) {
    setEntries((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) ?? { ingredientId: id, filled: false };
      const updated = { ...existing, ...updates };
      const item = items.find((i) => i.id === id);
      if (item?.opnameMethod === "packaged") {
        updated.filled = updated.fullPackages !== null && updated.fullPackages !== undefined;
      } else {
        updated.filled = updated.physicalStock !== null && updated.physicalStock !== undefined;
      }
      next.set(id, updated);
      return next;
    });
  }

  const filledCount = Array.from(entries.values()).filter((e) => e.filled).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchCat = (i.category || "bahan_baku") === activeTab;
      const matchSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, activeTab, searchQuery]);

  async function handleSubmit() {
    if (filledCount === 0) {
      await alert("Harap isi minimal 1 item sebelum menyimpan stock opname.", "Stock Opname Kosong", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const itemsToUpdate = Array.from(entries.values())
        .filter((e) => e.filled)
        .map((e) => {
          const item = items.find((i) => i.id === e.ingredientId);
          if (!item) return null;

          let physicalStockConverted = e.physicalStock ?? null;
          if (item.opnameMethod === "packaged" && e.fullPackages != null) {
            const packSize = (item as any).packageSize ?? 1;
            let fullnessFraction = 0;
            if (e.openPackageFullness === "3/4") fullnessFraction = 0.75;
            else if (e.openPackageFullness === "1/2") fullnessFraction = 0.5;
            else if (e.openPackageFullness === "1/4") fullnessFraction = 0.25;

            physicalStockConverted = (e.fullPackages + fullnessFraction) * packSize;
          }

          const systemStock = item.currentStock;
          const diff = physicalStockConverted !== null ? physicalStockConverted - systemStock : 0;

          return {
            ingredientId: e.ingredientId,
            itemType: item.itemType,
            inputMethod: item.opnameMethod ?? "manual",
            physicalStock: e.physicalStock ?? null,
            fullPackages: e.fullPackages ?? null,
            openPackageFullness: e.openPackageFullness ?? null,
            physicalStockConverted,
            systemStock,
            difference: diff,
          };
        })
        .filter(Boolean);

      const res = await fetchWithAuth("/api/stock-opname", {
        method: "POST",
        body: JSON.stringify({ items: itemsToUpdate }),
      });

      if (res.ok) {
        await alert("Stock opname berhasil disimpan dan dikirim untuk direview Manager!", "Tersimpan", "success");
        setEntries(new Map());
      } else {
        const d = await res.json();
        await alert(d.error ?? "Gagal menyimpan stock opname.", "Gagal", "danger");
      }
    } catch {
      await alert("Terjadi kesalahan koneksi.", "Gagal", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-32">
      
      {/* Native App Header */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-4xl mx-auto space-y-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <ClipboardList size={20} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">
                  Stock Opname Crew
                </h1>
                <p className="text-xs font-semibold text-slate-400">Cek Fisik Produk, Bahan & Packaging</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 block">Progres Audit</span>
              <span className="text-xs font-black text-slate-800 tabular-nums">{filledCount} / {totalCount} ({progressPercent}%)</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Horizontal Scroll Tabs */}
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pt-1">
            <div className="flex items-center gap-1.5 min-w-max">
              {CATEGORY_TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                    activeTab === t.key 
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                      : "bg-slate-100/80 text-slate-600 border-slate-200/80 hover:bg-slate-200/60"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 md:px-8 max-w-4xl mx-auto space-y-4 pt-4">
        
        {/* Search input */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama barang / bahan..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        {/* Item Cards */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm space-y-2">
            <Package size={32} className="text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Tidak ada item ditemukan di kategori ini.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => {
              const entry = entries.get(item.id) ?? { ingredientId: item.id, filled: false };
              const isPackaged = item.opnameMethod === "packaged";

              return (
                <div 
                  key={item.id}
                  className={`bg-white rounded-2xl p-4 border transition-all space-y-3 shadow-sm ${
                    entry.filled ? "border-emerald-300 bg-emerald-50/10" : "border-slate-200/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">{item.name}</h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        Stok Sistem: <span className="font-bold text-slate-700">{item.currentStock} {item.baseUnit}</span>
                      </p>
                    </div>

                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider shrink-0 ${
                      entry.filled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}>
                      {entry.filled ? "Sudah Diisi" : "Belum Diisi"}
                    </span>
                  </div>

                  {!isPackaged ? (
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                        Jumlah Fisik Nyata ({item.baseUnit}) *
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={entry.physicalStock ?? ""}
                        onChange={e => {
                          const val = e.target.value === "" ? null : parseFloat(e.target.value);
                          updateEntry(item.id, { physicalStock: val });
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/20"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Kemasan Utuh ({(item as any).packageUnit || "Kemasan"})
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          value={entry.fullPackages ?? ""}
                          onChange={e => {
                            const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                            updateEntry(item.id, { fullPackages: val });
                          }}
                          className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/20"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Kemasan Terbuka
                        </label>
                        <select
                          value={entry.openPackageFullness ?? "0"}
                          onChange={e => updateEntry(item.id, { openPackageFullness: e.target.value })}
                          className="w-full h-10 px-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/20"
                        >
                          <option value="0">Kosong / Tidak Ada</option>
                          <option value="1/4">1/4 Terisi</option>
                          <option value="1/2">1/2 (Setengah)</option>
                          <option value="3/4">3/4 (Hampir Penuh)</option>
                        </select>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-4 shadow-xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-400 block">Total Terisi</span>
            <span className="text-sm font-black text-slate-800 tabular-nums">{filledCount} dari {totalCount} Item</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || filledCount === 0}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-md flex items-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Kirim Stock Opname
          </button>
        </div>
      </div>

    </div>
  );
}
