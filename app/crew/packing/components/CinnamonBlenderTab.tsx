"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface Props {
  bulkCinnamonStock: number;
  onSuccess: () => void;
}

export function CinnamonBlenderTab({ bulkCinnamonStock, onSuccess }: Props) {
  const { getToken } = useAuth();
  const [cinnamonBatchCount, setCinnamonBatchCount] = useState("1");
  const [cinnamonProducedQty, setCinnamonProducedQty] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const cinnamonSugarEstUsage = useMemo(() => {
    const batches = parseInt(cinnamonBatchCount) || 0;
    if (batches <= 0) return { sugarGrams: 0, cinnamonGrams: 0 };
    return {
      sugarGrams: batches * 1500,
      cinnamonGrams: batches * 40,
    };
  }, [cinnamonBatchCount]);

  const cinnamonClipEstProduced = useMemo(() => {
    const grams = parseInt(cinnamonProducedQty) || 0;
    return Math.floor(grams / 5);
  }, [cinnamonProducedQty]);

  async function handleBlenderCinnamon() {
    setError("");
    setSuccessMsg("");
    const batches = parseInt(cinnamonBatchCount) || 0;

    if (batches <= 0) {
      setError("Jumlah batch blender harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "blender_cinnamon", batchCount: batches }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal memproses blender gula cinnamon");
      } else {
        setSuccessMsg(`Berhasil memblender gula cinnamon: ${batches} batch!`);
        setCinnamonBatchCount("1");
        onSuccess();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRepackCinnamonClip() {
    setError("");
    setSuccessMsg("");
    const grams = parseInt(cinnamonProducedQty) || 0;
    const produced = Math.floor(grams / 5);

    if (grams <= 0) {
      setError("Jumlah berat gula curah dikemas harus lebih dari 0");
      return;
    }
    if (produced <= 0) {
      setError("Minimal 5 gram untuk menghasilkan minimal 1 clip");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "repack_cinnamon_clip", producedQty: produced }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal mengemas clip gula cinnamon");
      } else {
        setSuccessMsg(`Berhasil mengemas ${produced} pcs clip gula cinnamon!`);
        setCinnamonProducedQty("");
        onSuccess();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClearCinnamonBulk() {
    if (!window.confirm("Apakah Anda yakin ingin mengosongkan seluruh sisa stok gula cinnamon curah di toples?")) return;
    setError("");
    setSuccessMsg("");
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "clear_cinnamon_bulk" }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal mengosongkan stok toples");
      } else {
        setSuccessMsg("Stok gula cinnamon curah di toples berhasil dikosongkan.");
        onSuccess();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-600 text-xs p-3.5 rounded-xl border border-red-100">{error}</div>}
      {successMsg && <div className="bg-green-50 text-green-700 text-xs p-3.5 rounded-xl border border-green-100">{successMsg}</div>}

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-800">1. Blender Cinnamon (Produksi Curah)</h2>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Jumlah Batch (1500g Gula + 40g Kayu Manis)</label>
          <Input type="number" value={cinnamonBatchCount} onChange={(e) => setCinnamonBatchCount(e.target.value)} className="h-11 rounded-xl text-sm font-bold bg-white focus-visible:ring-pink-200" />
        </div>
        <div className="bg-brand-50 p-3 rounded-xl border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Estimasi Bahan Terpakai</p>
          <p className="text-sm font-extrabold text-slate-800">{cinnamonSugarEstUsage.sugarGrams}g gula pasir, {cinnamonSugarEstUsage.cinnamonGrams}g kayu manis bubuk</p>
        </div>
        <button onClick={handleBlenderCinnamon} disabled={submitting} className="w-full h-12 rounded-xl text-sm font-bold text-white transition-all bg-slate-800 hover:bg-slate-900 flex justify-center items-center gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Blender Sekarang"}
        </button>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-extrabold text-slate-800">2. Kemas Sachet / Clip (5g)</h2>
          <span className="text-xs font-bold bg-primary/10 text-pink-700 px-3 py-1 rounded-full border border-pink-200">
            Toples Curah: {bulkCinnamonStock}g
          </span>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Total Berat Gula Diambil (Gram)</label>
          <Input type="number" placeholder="Misal: 500" value={cinnamonProducedQty} onChange={(e) => setCinnamonProducedQty(e.target.value)} className="h-11 rounded-xl text-sm font-bold bg-white focus-visible:ring-pink-200" />
        </div>
        <div className="bg-brand-50 p-3 rounded-xl border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Estimasi Hasil Sachet / Clip</p>
          <p className="text-sm font-extrabold text-slate-800">{cinnamonClipEstProduced} pcs</p>
        </div>
        <button onClick={handleRepackCinnamonClip} disabled={submitting} className="w-full h-12 rounded-xl text-sm font-bold text-white transition-all bg-primary hover:bg-primary flex justify-center items-center gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kemas Sachet / Clip"}
        </button>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
        <div>
          <h2 className="text-sm font-extrabold text-red-600">3. Bersihkan Toples (Clear Stock)</h2>
          <p className="text-xs text-slate-500">Gunakan jika toples curah sudah kosong namun di sistem masih ada sisa stok (selisih gramasi).</p>
        </div>
        <button onClick={handleClearCinnamonBulk} disabled={submitting || bulkCinnamonStock <= 0} className="w-full h-12 rounded-xl text-sm font-bold text-red-600 border border-red-200 bg-red-50 transition-all hover:bg-red-100 flex justify-center items-center gap-2 disabled:opacity-50">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kosongkan Sisa Toples"}
        </button>
      </div>
    </div>
  );
}
