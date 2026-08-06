"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ArrowLeft, Search, FileText } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/Skeleton";

export default function StockHistoryPage() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<any[]>([]); // ingredients & variants
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ingRes, varRes, movRes] = await Promise.all([
        fetchWithAuth("/api/ingredients"),
        fetchWithAuth("/api/variants"),
        fetchWithAuth(selectedItemId === "all" ? "/api/inventory/movements" : `/api/inventory/movements?ingredientId=${selectedItemId}`)
      ]);
      
      let allItems: any[] = [];
      if (ingRes.ok) {
        const ings = await ingRes.json();
        allItems = [...allItems, ...ings.map((i: any) => ({ ...i, type: "ingredient" }))];
      }
      if (varRes.ok) {
        const vars = await varRes.json();
        allItems = [...allItems, ...vars.map((v: any) => ({ ...v, type: "variant", baseUnit: "pack" }))];
      }
      setItems(allItems);

      if (movRes.ok) {
        setMovements(await movRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, selectedItemId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getItemName = (id: string) => {
    const item = items.find(i => i.id === id);
    return item ? item.name : "Unknown Item";
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto pb-32">
      <div className="flex items-center gap-3">
        <Link href="/owner/dashboard" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-800">Buku Stok (Audit Trail)</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">Lacak seluruh riwayat pergerakan stok</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* SIDEBAR FILTER */}
        <div className="w-full md:w-64 space-y-4">
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 h-[600px] flex flex-col">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Filter Barang</h2>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Input 
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari..." 
                className="pl-9 h-10 bg-slate-50 border-none rounded-xl text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 hide-scrollbar">
              <button 
                onClick={() => setSelectedItemId("all")}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedItemId === "all" ? 'bg-primary text-white' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                Semua Barang
              </button>
              {filteredItems.map(item => (
                <button 
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex justify-between items-center ${selectedItemId === item.id ? 'bg-primary text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  <span className="truncate pr-2">{item.name}</span>
                  {selectedItemId !== item.id && <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-md uppercase">{item.type.slice(0,3)}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1">
          <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Riwayat Pergerakan</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedItemId === "all" ? "Menampilkan semua transaksi" : `Filter: ${getItemName(selectedItemId)}`}
                </p>
              </div>
              <FileText className="text-slate-200" size={32} />
            </div>

            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-20 text-slate-400 font-medium">Tidak ada riwayat pergerakan stok.</div>
            ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {movements.map((m, idx) => {
                  const isPositive = m.changeAmount > 0;
                  return (
                    <div key={m.id || idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      {/* Timeline Dot */}
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        {isPositive ? <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> : <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                      </div>
                      
                      {/* Card */}
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date(m.timestamp).toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</span>
                          <span className={`text-xs font-black ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}{m.changeAmount}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{getItemName(m.ingredientId)}</h4>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{m.notes}</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-2">Oleh: {m.userName || m.userId}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
