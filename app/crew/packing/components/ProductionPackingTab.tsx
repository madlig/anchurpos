"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { Input } from "@/components/ui/input";
import { Loader2, PackageCheck, Check } from "lucide-react";
import type { Variant } from "@/types";

interface Props {
  variants: Variant[];
  onSuccess: () => void;
}

const PRODUCTS = [
  { id: "churros-frozen-regular", name: "Churros Frozen Regular (12 pcs)", ratio: 16 },
  { id: "churros-frozen-full", name: "Churros Frozen Full (16 pcs)", ratio: 12 },
  { id: "churros-frozen-tiktok", name: "Churros Frozen TikTok (6 pcs)", ratio: 11 },
];

export function ProductionPackingTab({ variants, onSuccess }: Props) {
  const { getToken } = useAuth();
  const { alert } = useAlertConfirm();

  const [productId, setProductId] = useState(PRODUCTS[0].id);
  const [variantId, setVariantId] = useState(variants[0]?.id || "");
  const [packQty, setPackQty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (variants.length > 0 && !variantId) {
      setVariantId(variants[0].id);
    }
  }, [variants, variantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(packQty);
    if (!qty || qty <= 0) {
      return alert("Masukkan jumlah pack yang valid", "Form Tidak Lengkap", "warning");
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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

  const selectedProd = PRODUCTS.find((p) => p.id === productId);
  const selectedVar = variants.find((v) => v.id === variantId);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <PackageCheck size={20} />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight">Packing Hasil Produksi (Stok Produk Jadi)</h2>
          <p className="text-xs font-semibold text-slate-500">Kemas adonan mentah jadi Pack Frozen untuk menambah stok Gudang secara langsung.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Pilih Jenis Produk */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            1. Pilih Jenis Produk Frozen
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {PRODUCTS.map((p) => {
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
                  <div className="text-xs">{p.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pilih Varian */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            2. Pilih Varian Rasa
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
