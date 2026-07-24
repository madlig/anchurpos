"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Search, Save, AlertTriangle, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export default function StockOpnamePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  
  const [items, setItems] = useState<OpnameItemUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"bahan_baku" | "packaging" | "operasional" | "add_on" | "barang_jadi">("barang_jadi");
  
  const [opnameData, setOpnameData] = useState<Record<string, string>>({});
  const [notesData, setNotesData] = useState<Record<string, string>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    try {
      const [resIng, resVar] = await Promise.all([
        fetchWithAuth("/api/ingredients"),
        fetchWithAuth("/api/variants")
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
    } catch(err) {
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

  const handleStockChange = (id: string, value: string) => {
    setOpnameData(prev => ({ ...prev, [id]: value }));
  };

  const handleNotesChange = (id: string, value: string) => {
    setNotesData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    
    const itemsToUpdate = items.map(i => {
      const actualStr = opnameData[i.id];
      if (actualStr === undefined || actualStr === "") return null;
      
      const actualStock = parseFloat(actualStr);
      if (isNaN(actualStock)) return null;
      
      if (actualStock === i.currentStock) return null;
      
      return {
        itemId: i.id,
        itemType: i.itemType,
        actualStock,
        systemStock: i.currentStock,
        notes: notesData[i.id] || ""
      };
    }).filter(Boolean);

    if (itemsToUpdate.length === 0) {
      setError("Tidak ada perubahan stok yang perlu disimpan.");
      return;
    }

    if (!confirm(`Terdapat ${itemsToUpdate.length} item yang akan disesuaikan stoknya. Lanjutkan?`)) return;

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/inventory/stock-opname", {
        method: "POST",
        body: JSON.stringify({ items: itemsToUpdate })
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Gagal menyimpan stock opname");
      } else {
        setSuccess("Stock Opname berhasil disimpan! Data stok telah diperbarui.");
        setOpnameData({});
        setNotesData({});
        loadData(); // reload
        setTimeout(() => setSuccess(""), 5000);
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  };

  const TABS = [
    { id: "barang_jadi", label: "Produk Jadi (Varian)" },
    { id: "bahan_baku", label: "Bahan Baku" },
    { id: "packaging", label: "Kemasan (Packaging)" },
    { id: "add_on", label: "Add-on / Saus" },
    { id: "operasional", label: "Operasional" },
  ] as const;

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto pb-32">
      <div className="flex items-center gap-3">
        <Link href="/manager/inventory" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-800">Stock Opname</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">Penyesuaian stok fisik dan sistem</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100">
        
        {/* Header Tools */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="flex overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar gap-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari barang..." 
              className="pl-9 h-11 bg-slate-50 border-none rounded-xl font-medium"
            />
          </div>
        </div>

        {error && <div className="p-4 mb-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2"><AlertTriangle size={16}/> {error}</div>}
        {success && <div className="p-4 mb-4 bg-green-50 text-green-700 rounded-xl text-sm font-bold border border-green-100">{success}</div>}

        {/* List */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium">
              Tidak ada barang yang cocok.
            </div>
          ) : (
            filteredItems.map(item => {
              const actualStr = opnameData[item.id] ?? "";
              const hasChange = actualStr !== "" && parseFloat(actualStr) !== item.currentStock && !isNaN(parseFloat(actualStr));
              
              return (
                <div key={item.id} className={`flex flex-col md:flex-row gap-4 p-4 rounded-2xl border transition-all ${hasChange ? 'border-primary/40 bg-primary/5' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                  
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      Sistem: <span className={item.currentStock < 0 ? 'text-red-500 font-bold' : ''}>{item.currentStock}</span> {item.baseUnit}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 items-center w-full md:w-auto">
                    <div className="flex-1 md:w-32">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Fisik Aktual</label>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0"
                        value={actualStr}
                        onChange={(e) => handleStockChange(item.id, e.target.value)}
                        className={`h-11 rounded-xl text-sm font-bold ${hasChange ? 'bg-white border-primary/40 focus-visible:ring-primary/20' : 'bg-slate-50 border-none'}`}
                      />
                    </div>
                    {hasChange && (
                      <div className="flex-1 md:w-48 animate-fade-in">
                        <label className="text-[10px] font-bold text-primary/70 uppercase ml-1 block mb-1">Keterangan (Opsional)</label>
                        <Input 
                          type="text" 
                          placeholder="Cth: Basi, Tumpah..."
                          value={notesData[item.id] ?? ""}
                          onChange={(e) => handleNotesChange(item.id, e.target.value)}
                          className="h-11 rounded-xl text-xs bg-white border-primary/40 focus-visible:ring-primary/20"
                        />
                      </div>
                    )}
                  </div>
                  
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-0 md:bottom-6 left-0 right-0 md:left-[17rem] p-4 bg-gradient-to-t from-white via-white to-transparent md:bg-none z-20 pointer-events-none">
        <div className="max-w-5xl mx-auto flex justify-end pointer-events-auto">
           <button
             onClick={handleSubmit}
             disabled={submitting || Object.keys(opnameData).length === 0}
             className="h-14 px-8 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-0 disabled:translate-y-4 flex items-center justify-center gap-2 shadow-xl shadow-primary/30"
             style={{ background: "linear-gradient(135deg, #E85D8C 0%, #D84275 100%)" }}
           >
             {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save size={18} /> Terapkan Penyesuaian</>}
           </button>
        </div>
      </div>
      
    </div>
  );
}
