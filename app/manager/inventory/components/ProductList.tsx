"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, X, Check, MoreHorizontal } from "lucide-react";

interface VariantStock {
  id: string;
  name: string;
  currentStock: number;
  minStock: number;
  sortOrder: number;
}

interface ProductListProps {
  variants: VariantStock[];
  searchQuery: string;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  loadVariants: () => Promise<void>;
  openMutasiModal: (id: string, name: string, unit: string, type: "variant" | "ingredient") => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}

export function ProductList({
  variants,
  searchQuery,
  fetchWithAuth,
  loadVariants,
  openMutasiModal,
  openMenuId,
  setOpenMenuId
}: ProductListProps) {
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [opnameValue, setOpnameValue] = useState("");
  const [opnameNote, setOpnameNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleVariantOpname = async (id: string) => {
    const val = parseInt(opnameValue, 10);
    if (isNaN(val) || val < 0) return;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/products/stocks`, {
        method: "PATCH",
        body: JSON.stringify({ id, currentStock: val, note: opnameNote || null }),
      });
      if (res.ok) {
        setEditingVariantId(null);
        setOpnameValue("");
        setOpnameNote("");
        await loadVariants();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = variants
    .filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm mt-4">
        <p className="text-slate-500 text-sm font-medium">Tidak ada varian produk ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      {filtered.map((v) => {
        const isLow = v.currentStock < v.minStock;
        const isEditing = editingVariantId === v.id;
        const isMenuOpen = openMenuId === v.id;

        return (
          <div
            key={v.id}
            className={`bg-white rounded-2xl border transition-all ${isLow ? 'border-red-200 shadow-sm shadow-red-50' : 'border-slate-200 shadow-sm'} overflow-hidden relative group`}
          >
            {/* Low stock indicator strip */}
            {isLow && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>}
            
            <div className="p-4 pl-5">
              <div className="flex justify-between items-start mb-2 relative">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-1 pr-4">{v.name}</h3>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Varian Frozen</p>
                </div>
                
                {/* 3 Dots Menu */}
                <button
                  onClick={() => setOpenMenuId(isMenuOpen ? null : v.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  <MoreHorizontal size={18} />
                </button>
                
                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>
                    <div className="absolute right-0 top-9 w-40 bg-white rounded-xl shadow-lg border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                      <button
                        onClick={() => { setEditingVariantId(v.id); setOpenMenuId(null); setOpnameValue(v.currentStock.toString()); setOpnameNote(""); }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-50 transition-colors"
                      >
                        Edit / Koreksi Stok
                      </button>
                      <button
                        onClick={() => { openMutasiModal(v.id, v.name, "Pack", "variant"); setOpenMenuId(null); }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-primary hover:bg-slate-50 transition-colors"
                      >
                        Lihat Riwayat Mutasi
                      </button>
                    </div>
                  </>
                )}
              </div>

              {!isEditing ? (
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Sisa Stok</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-2xl font-black ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                        {formatNumber(v.currentStock)}
                      </span>
                      <span className="text-xs font-bold text-slate-500">Pack</span>
                    </div>
                  </div>
                  {isLow && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">
                      Menipis (Min: {v.minStock})
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-200 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-slate-700">Koreksi Manual</span>
                    <button onClick={() => setEditingVariantId(null)} className="text-slate-400 hover:text-slate-600">
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <Input
                      type="number"
                      value={opnameValue}
                      onChange={(e) => setOpnameValue(e.target.value)}
                      className="h-10 text-sm font-bold text-slate-800 bg-white"
                      placeholder="Stok Riil"
                    />
                    <span className="text-xs font-bold text-slate-500 w-12">Pack</span>
                  </div>
                  
                  <Input
                    type="text"
                    value={opnameNote}
                    onChange={(e) => setOpnameNote(e.target.value)}
                    placeholder="Alasan (Opsional, ex: Basi)"
                    className="h-9 text-xs mb-3 bg-white"
                  />
                  
                  <button
                    onClick={() => handleVariantOpname(v.id)}
                    disabled={submitting}
                    className="w-full h-9 bg-primary text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Simpan Perubahan
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
