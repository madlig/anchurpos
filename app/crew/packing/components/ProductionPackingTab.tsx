"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { Input } from "@/components/ui/input";
import { Loader2, PackageCheck, Check, Layers } from "lucide-react";
import type { Variant, Product } from "@/types";

interface Props {
  variants: Variant[];
  onSuccess: () => void;
}

export function ProductionPackingTab({ variants, onSuccess }: Props) {
  const { getToken } = useAuth();
  const { alert } = useAlertConfirm();

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [variantId, setVariantId] = useState<string>(variants[0]?.id || "");
  const [packQty, setPackQty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Loyang Pool State
  const [loyangAvailable, setLoyangAvailable] = useState<number>(0);
  const [loadingPool, setLoadingPool] = useState<boolean>(false);

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

  // Load products from Master Data
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetchWithAuth("/api/products");
        if (res.ok) {
          const data: Product[] = await res.json();
          const frozenProds = data.filter((p) => p.id.startsWith("churros-frozen"));
          setProducts(frozenProds);
          if (frozenProds.length > 0) setProductId(frozenProds[0].id);
        }
      } catch (err) {
        console.error("Gagal mengambil master data produk:", err);
      }
    }
    loadProducts();
  }, [fetchWithAuth]);

  useEffect(() => {
    if (variants.length > 0 && !variantId) {
      setVariantId(variants[0].id);
    }
  }, [variants, variantId]);

  // Fetch Loyang Pool whenever variantId changes
  const fetchLoyangPool = useCallback(async (vId: string) => {
    if (!vId) return;
    setLoadingPool(true);
    try {
      const res = await fetchWithAuth(`/api/productions/loyang-pool?variantId=${vId}`);
      if (res.ok) {
        const data = await res.json();
        setLoyangAvailable(data.totalAvailable || 0);
      }
    } catch (err) {
      console.error("Gagal mengambil loyang pool:", err);
    } finally {
      setLoadingPool(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (variantId) {
      fetchLoyangPool(variantId);
    }
  }, [variantId, fetchLoyangPool]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(packQty);
    if (!qty || qty <= 0) {
      return alert("Masukkan jumlah pack yang valid", "Form Tidak Lengkap", "warning");
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/packing", {
        method: "POST",
        body: JSON.stringify({
          action: "pack_production",
          productId,
          variantId,
          packQty: qty,
        }),
      });

      if (res.ok) {
        alert("Laporan packing berhasil disimpan! Stok produk jadi di Gudang telah bertambah.", "Berhasil", "success");
        setPackQty("");
        fetchLoyangPool(variantId);
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan packing produksi", "Gagal", "danger");
      }
    } catch (err: any) {
      alert("Terjadi kesalahan jaringan", "Error", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProd = products.find((p) => p.id === productId);
  const selectedVar = variants.find((v) => v.id === variantId);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <PackageCheck size={20} />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight">Packing Hasil Produksi (Stok Produk Jadi)</h2>
          <p className="text-xs font-semibold text-slate-500">Terhubung langsung ke Master Data Produk Jadi, Master Varian Rasa, dan Pool Adonan Produksi.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Pilih Jenis Produk (Dari Master Data) */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            1. Pilih Jenis Produk Frozen (Master Data)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {products.map((p) => {
              const active = productId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductId(p.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    active
                      ? "bg-primary/10 border-primary text-primary font-bold shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold"
                  }`}
                >
                  <div className="text-xs font-bold">{p.name}</div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">{p.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pilih Varian Rasa (Dari Master Data Varian) */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            2. Pilih Varian Rasa (Master Varian)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {variants.map((v) => {
              const active = variantId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={`p-3 rounded-xl border text-center text-xs transition-all ${
                    active
                      ? "bg-primary text-white border-primary font-bold shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                  }`}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Pool Produksi Loyang */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <Layers size={16} className="text-amber-600" />
            <span>Sisa Loyang Adonan {selectedVar?.name || ""}:</span>
          </div>
          <div className="text-xs font-extrabold text-amber-900 bg-amber-200/60 px-3 py-1 rounded-full">
            {loadingPool ? <Loader2 size={12} className="animate-spin" /> : `${loyangAvailable} Loyang Tersedia`}
          </div>
        </div>

        {/* Input Jumlah Pack */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            3. Jumlah Pack Yang Berhasil Dibungkus
          </label>
          <div className="relative">
            <Input
              type="number"
              min="1"
              placeholder="Contoh: 16"
              value={packQty}
              onChange={(e) => setPackQty(e.target.value)}
              className="h-12 text-base font-bold pl-4 pr-16 rounded-2xl border-slate-300 focus:border-primary focus:ring-primary/20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              PACK
            </span>
          </div>
        </div>

        {/* Info Ringkasan */}
        {packQty && parseInt(packQty) > 0 && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium space-y-1">
            <div className="font-bold text-emerald-800 flex items-center gap-1.5">
              <Check size={14} /> Ringkasan Penambahan Stok:
            </div>
            <div>
              • Stok <strong>{selectedProd?.name} ({selectedVar?.name})</strong> di Gudang akan bertambah +<strong>{packQty} Pack</strong>.
            </div>
            <div>
              • Kemasan plastik & stiker label akan otomatis terpotong sebanyak {packQty} pcs.
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-extrabold text-sm shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 tap-target"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <PackageCheck size={18} />
              Simpan & Tambahkan Ke Stok Gudang
            </>
          )}
        </button>
      </form>
    </div>
  );
}
