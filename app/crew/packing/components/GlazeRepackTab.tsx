"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface Props {
  onSuccess: () => void;
}

export function GlazeRepackTab({ onSuccess }: Props) {
  const { getToken } = useAuth();
  const [glazeFlavor, setGlazeFlavor] = useState("coklat");
  const [glazeTarget, setGlazeTarget] = useState<"cup" | "tiktok">("cup");
  const [glazeCupQty, setGlazeCupQty] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const glazeBulkEstGrams = useMemo(() => {
    const qty = parseInt(glazeCupQty) || 0;
    if (qty <= 0) return 0;
    const factor = glazeTarget === "cup" ? 13 : 15;
    return qty * factor;
  }, [glazeCupQty, glazeTarget]);

  async function handleRepackGlaze() {
    setError("");
    setSuccessMsg("");
    const cupQty = parseInt(glazeCupQty) || 0;

    if (cupQty <= 0) {
      setError("Jumlah cup/plastik diproduksi harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "repack_glaze",
          flavorId: glazeFlavor,
          targetType: glazeTarget,
          cupQty,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal memproses repack glaze");
      } else {
        setSuccessMsg(`Berhasil merepack glaze flavor ${glazeFlavor} ke ${glazeTarget}: menghasilkan ${cupQty} pcs!`);
        setGlazeCupQty("");
        onSuccess();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-5">
      <div>
        <h2 className="text-sm font-extrabold text-slate-800 mb-1">Repack Saos Glaze</h2>
        <p className="text-xs text-slate-500">Pindahkan glaze dari toples curah ke cup reguler atau plastik TikTok.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Rasa Glaze</label>
          <div className="relative">
            <select
              value={glazeFlavor}
              onChange={(e) => setGlazeFlavor(e.target.value)}
              className="w-full text-sm font-medium border-slate-200 rounded-xl h-11 bg-brand-50 text-slate-800 pl-4 pr-10 appearance-none focus:border-primary/50 focus:ring-2 focus:ring-pink-100 transition-all"
            >
              <option value="coklat">Coklat</option>
              <option value="greentea">Green Tea</option>
              <option value="keju">Keju</option>
              <option value="vanilla">Vanilla</option>
              <option value="tiramisu">Tiramisu</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Target Repack</label>
          <div className="flex gap-2">
            <button
              onClick={() => setGlazeTarget("cup")}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border"
              style={
                glazeTarget === "cup"
                  ? { background: "#FEF1F5", borderColor: "#E85D8C", color: "#E85D8C" }
                  : { background: "#fff", borderColor: "#E2E8F0", color: "#64748B" }
              }
            >
              Cup Reguler
            </button>
            <button
              onClick={() => setGlazeTarget("tiktok")}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border"
              style={
                glazeTarget === "tiktok"
                  ? { background: "#FEF1F5", borderColor: "#E85D8C", color: "#E85D8C" }
                  : { background: "#fff", borderColor: "#E2E8F0", color: "#64748B" }
              }
            >
              Plastik TikTok
            </button>
          </div>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-bold text-slate-700">Jumlah Cup/Plastik Dihasilkan</label>
          <Input
            type="number"
            value={glazeCupQty}
            onChange={(e) => setGlazeCupQty(e.target.value)}
            placeholder="Misal: 20"
            className="h-11 rounded-xl text-sm font-bold bg-white focus-visible:ring-pink-200"
          />
        </div>
      </div>

      <div className="bg-brand-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
        <div>
          <p className="text-xs font-bold text-slate-500 mb-0.5 uppercase tracking-wide">Estimasi Bahan Terpakai</p>
          <p className="text-sm font-extrabold text-slate-800">
            {glazeBulkEstGrams} gram curah
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-xs font-medium p-3.5 rounded-xl border border-red-100">
          {error}
        </div>
      )}
      
      {successMsg && (
        <div className="bg-green-50 text-green-700 text-xs font-medium p-3.5 rounded-xl border border-green-100">
          {successMsg}
        </div>
      )}

      <button
        onClick={handleRepackGlaze}
        disabled={submitting}
        className="w-full h-12 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
        style={{
          background: "linear-gradient(135deg, #E85D8C 0%, #D84275 100%)",
          boxShadow: "0 4px 12px rgba(232,93,140,0.2)",
        }}
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Simpan Repack Glaze"}
      </button>
    </div>
  );
}
