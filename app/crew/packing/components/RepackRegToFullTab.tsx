"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, Check } from "lucide-react";
import type { Variant } from "@/types";

interface Props {
  variants: Variant[];
  onSuccess: () => void;
}

export function RepackRegToFullTab({ variants, onSuccess }: Props) {
  const { getToken } = useAuth();
  
  const [repackVariantId, setRepackVariantId] = useState("");
  const [regularPacksToUnpack, setRegularPacksToUnpack] = useState("");
  const [repackProductStocks, setRepackProductStocks] = useState<Record<string, number>>({});
  const [repackBuffers, setRepackBuffers] = useState<Record<string, number>>({});
  
  const [loadingRepackData, setLoadingRepackData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (variants.length > 0 && !repackVariantId) {
      setRepackVariantId(variants[0].id);
    }
  }, [variants, repackVariantId]);

  const fetchRepackStockAndBuffer = useCallback(async (vId: string) => {
    if (!vId) return;
    setLoadingRepackData(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/packing?action=get_repack_data&variantId=${vId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRepackProductStocks((prev) => ({ ...prev, [vId]: data.regularStock }));
        setRepackBuffers((prev) => ({ ...prev, [vId]: data.bufferPcs }));
      }
    } catch (err) {
      console.error("Gagal mengambil data repack:", err);
    } finally {
      setLoadingRepackData(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (repackVariantId) {
      fetchRepackStockAndBuffer(repackVariantId);
    }
  }, [repackVariantId, fetchRepackStockAndBuffer]);

  const repackRegToFullCalc = useMemo(() => {
    const regularToUnpack = parseInt(regularPacksToUnpack) || 0;
    const bufferPcs = repackBuffers[repackVariantId] ?? 0;

    if (regularToUnpack <= 0) return { producedFullPacks: 0, newBufferPcs: bufferPcs };

    const totalPcs = (regularToUnpack * 12) + bufferPcs;
    const produced = Math.floor(totalPcs / 16);
    const remaining = totalPcs % 16;

    return { producedFullPacks: produced, newBufferPcs: remaining };
  }, [regularPacksToUnpack, repackBuffers, repackVariantId]);

  async function handleRepackRegToFull() {
    setError("");
    setSuccessMsg("");
    const regPacks = parseInt(regularPacksToUnpack) || 0;

    if (!repackVariantId) {
      setError("Pilih varian produk");
      return;
    }
    if (regPacks <= 0) {
      setError("Jumlah regular pack yang dibongkar harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "repack_reg_to_full",
          variantId: repackVariantId,
          regularPacksToUnpack: regPacks,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal memproses repack regular ke full");
      } else {
        setSuccessMsg(`Berhasil membongkar ${regPacks} pack Regular ${repackVariantId} menjadi ${d.producedFullPacks} pack Full (sisa buffer baru: ${d.leftoverBufferPcs} pcs).`);
        setRegularPacksToUnpack("");
        onSuccess();
        fetchRepackStockAndBuffer(repackVariantId);
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
      <h2 className="text-sm font-extrabold text-slate-800 mb-2">Repack Regular ke Full Pack</h2>
      <p className="text-xs text-slate-400">
        Bongkar pack Regular (isi 12 pcs) yang ada untuk dipack ulang ke Full (isi 16 pcs). Sisa pcs yang tidak cukup menjadi 1 pack Full otomatis disimpan ke stok buffer varian tersebut.
      </p>

      {error && <div className="bg-red-50 text-red-600 text-xs p-3.5 rounded-xl border border-red-100">{error}</div>}
      {successMsg && <div className="bg-green-50 text-green-700 text-xs p-3.5 rounded-xl border border-green-100">{successMsg}</div>}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Varian Churros</label>
          <select
            value={repackVariantId}
            onChange={(e) => setRepackVariantId(e.target.value)}
            className="w-full h-12 rounded-xl text-sm border border-slate-200 px-3 font-semibold text-slate-800 bg-white"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {loadingRepackData ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-3 bg-brand-50 border border-slate-100 rounded-xl text-xxs text-slate-500">
            <div>
              <p className="font-bold text-slate-400">Stok Regular Saat Ini:</p>
              <p className="text-xs font-bold text-slate-700">{repackProductStocks[repackVariantId] ?? 0} pack</p>
            </div>
            <div>
              <p className="font-bold text-slate-400">Sisa Stok Buffer:</p>
              <p className="text-xs font-bold text-slate-700">{repackBuffers[repackVariantId] ?? 0} pcs</p>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Jumlah Pack Regular Dibongkar</label>
          <Input
            type="number"
            placeholder="Contoh: 2 pack"
            value={regularPacksToUnpack}
            onChange={(e) => setRegularPacksToUnpack(e.target.value)}
            className="h-12 rounded-xl text-sm border-slate-200"
          />
        </div>

        {parseInt(regularPacksToUnpack) > 0 && (
          <div className="p-4 bg-brand-50 border border-slate-100 rounded-2xl text-xs space-y-2">
            <p className="font-extrabold text-slate-800 border-b border-slate-200 pb-1.5 mb-1.5">Estimasi Kalkulasi Konversi</p>
            <div className="flex justify-between">
              <span className="text-slate-500">Pcs didapatkan dari Regular:</span>
              <span className="font-bold text-slate-700">{(parseInt(regularPacksToUnpack) || 0) * 12} pcs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pcs dari Stok Buffer saat ini:</span>
              <span className="font-bold text-slate-700">{repackBuffers[repackVariantId] ?? 0} pcs</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 border-dashed pt-1.5">
              <span className="text-slate-500 font-bold">Total Pcs Churros:</span>
              <span className="font-bold text-slate-800">
                {(parseInt(regularPacksToUnpack) || 0) * 12 + (repackBuffers[repackVariantId] ?? 0)} pcs
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold pt-2 border-t border-slate-200">
              <div className="flex-1 p-2 bg-primary/10 border border-primary/20 rounded-lg text-center text-pink-700">
                <p className="text-xs uppercase text-pink-400 font-extrabold tracking-wider">Pack Full Dihasilkan</p>
                <p className="text-sm font-extrabold">{repackRegToFullCalc.producedFullPacks} pack</p>
                <p className="text-[8px] text-pink-400 mt-0.5">Memakai {repackRegToFullCalc.producedFullPacks * 16} pcs</p>
              </div>
              <ArrowRight size={14} className="text-slate-400" />
              <div className="flex-1 p-2 bg-slate-100 border border-slate-200 rounded-lg text-center text-slate-600">
                <p className="text-xs uppercase text-slate-400 font-extrabold tracking-wider">Sisa Buffer Baru</p>
                <p className="text-sm font-extrabold">{repackRegToFullCalc.newBufferPcs} pcs</p>
                <p className="text-[8px] text-slate-400 mt-0.5">Tersimpan untuk prepack berikut</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleRepackRegToFull}
        disabled={submitting || !regularPacksToUnpack || parseInt(regularPacksToUnpack) <= 0}
        className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 tap-target"
        style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)", boxShadow: "0 8px 20px rgba(232,93,140,0.3)" }}
      >
        {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
        Simpan Repack Regular ke Full
      </button>
    </div>
  );
}
