"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { 
  Loader2, Search, Save, AlertTriangle, ArrowLeft, ClipboardList, 
  CheckCircle2, Package, Check, Layers, AlertCircle, FileText
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface OpnameItemUI {
  id: string;
  name: string;
  category: "bahan_baku" | "packaging" | "operasional" | "add_on" | "barang_jadi";
  baseUnit: string;
  currentStock: number;
  itemType: "ingredient" | "variant";
}

const CATEGORY_TABS: { key: "barang_jadi" | "bahan_baku" | "packaging" | "operasional" | "add_on"; label: string }[] = [
  { key: "barang_jadi", label: "Barang Jadi (Frozen)" },
  { key: "bahan_baku", label: "Bahan Baku" },
  { key: "packaging", label: "Kemasan & Packaging" },
  { key: "operasional", label: "Operasional" },
  { key: "add_on", label: "Add-On" },
];

export default function StockOpnamePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { alert } = useAlertConfirm();
  
  const [items, setItems] = useState<OpnameItemUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"barang_jadi" | "bahan_baku" | "packaging" | "operasional" | "add_on">("barang_jadi");
  
  const [opnameData, setOpnameData] = useState<Record<string, string>>({});
  const [notesData, setNotesData] = useState<Record<string, string>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchCategory = i.category === activeTab;
      const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [items, activeTab, search]);

  // Completion Stats
  const filledCount = useMemo(() => {
    return Object.keys(opnameData).filter(k => opnameData[k] !== "").length;
  }, [opnameData]);

  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  const handleStockChange = (id: string, value: string) => {
    setOpnameData(prev => ({ ...prev, [id]: value }));
  };

  const handleNotesChange = (id: string, value: string) => {
    setNotesData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    setError("");
    
    const itemsToUpdate = items.map(i => {
      const actualStr = opnameData[i.id];
      if (actualStr === undefined || actualStr === "") return null;
      
      const actualStock = parseFloat(actualStr);
      if (isNaN(actualStock)) return null;
      
      return {
        ingredientId: i.id,
        itemType: i.itemType,
        inputMethod: "manual",
        physicalStock: actualStock,
        physicalStockConverted: actualStock,
        systemStock: i.currentStock,
        difference: actualStock - i.currentStock,
        note: notesData[i.id] || null
      };
    }).filter(Boolean);

    if (itemsToUpdate.length === 0) {
      setError("Isi minimal 1 stok fisik barang sebelum menyimpan");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/stock-opname", {
        method: "POST",
        body: JSON.stringify({ items: itemsToUpdate })
      });

      if (res.ok) {
        await alert("Stock Opname berhasil disimpan dan dikirim untuk direview Manager!", "Berhasil Ditambahkan", "success");
        router.push("/manager/inventory?tab=opname");
      } else {
        const d = await res.json();
        setError(d.error || "Gagal menyimpan stock opname");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-32">
      
      {/* ── Native App Sticky Header ── */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-4xl mx-auto space-y-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/manager/inventory"
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">
                  Input Stock Opname
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  Formulir Cek Fisik Barang Outlet
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 block">Progres Cek</span>
              <span className="text-xs font-black text-slate-800 tabular-nums">{filledCount} / {totalCount} Item ({progressPercent}%)</span>
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

      {/* ── Main Content Area ── */}
      <div className="px-4 md:px-8 max-w-4xl mx-auto space-y-4 pt-4">
        
        {/* Search Bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Cari item ${activeTab.replace('_', ' ')}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-xs flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Item Cards List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm space-y-2">
            <Package size={32} className="text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Tidak ada item ditemukan di kategori ini.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => {
              const inputVal = opnameData[item.id] || "";
              const noteVal = notesData[item.id] || "";
              const actualNum = parseFloat(inputVal);
              const isFilled = inputVal !== "" && !isNaN(actualNum);
              const diff = isFilled ? actualNum - item.currentStock : 0;
              const hasDiff = isFilled && diff !== 0;

              return (
                <div 
                  key={item.id}
                  className={`bg-white rounded-2xl p-4 border transition-all space-y-3 shadow-sm ${
                    hasDiff ? "border-amber-300 bg-amber-50/20" : isFilled ? "border-emerald-200" : "border-slate-200/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">{item.name}</h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        Stok Sistem: <span className="font-bold text-slate-700">{item.currentStock} {item.baseUnit}</span>
                      </p>
                    </div>

                    {isFilled && (
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider shrink-0 ${
                        hasDiff 
                          ? diff > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}>
                        {hasDiff ? `Selisih: ${diff > 0 ? "+" : ""}${diff} ${item.baseUnit}` : "Cocok"}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                        Hasil Cek Fisik Nyata ({item.baseUnit}) *
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={inputVal}
                        onChange={e => handleStockChange(item.id, e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/20"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                        Catatan Selisih (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 1 botol pecah di rak bawah"
                        value={noteVal}
                        onChange={e => handleNotesChange(item.id, e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/20"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ── Sticky Bottom Action Bar ── */}
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
            Simpan & Kirim Stock Opname
          </button>
        </div>
      </div>

    </div>
  );
}
