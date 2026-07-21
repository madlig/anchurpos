"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { Ingredient } from "@/types";

interface Props {
  ingredients: Ingredient[];
  onSuccess: () => void;
}

export function ManualUsageTab({ ingredients, onSuccess }: Props) {
  const { getToken } = useAuth();
  const [manualEntries, setManualEntries] = useState<Map<string, string>>(new Map());
  const [manualNotes, setManualNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const manualIngredientsList = useMemo<Ingredient[]>(() => {
    return ingredients.filter(
      (ing) =>
        ing.category === "packaging" ||
        ing.category === "operasional" ||
        ing.category === "add_on"
    );
  }, [ingredients]);

  const updateManualEntry = (id: string, val: string) => {
    setManualEntries((prev) => {
      const next = new Map(prev);
      if (val === "") {
        next.delete(id);
      } else {
        next.set(id, val);
      }
      return next;
    });
  };

  async function handleManualUsage() {
    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    const updates = Array.from(manualEntries.entries())
      .filter(([_, val]) => parseFloat(val) > 0)
      .map(([id, val]) => ({
        id,
        qtyUsed: parseFloat(val) || 0,
      }));

    if (updates.length === 0) {
      setError("Isi minimal 1 bahan yang digunakan");
      setSubmitting(false);
      return;
    }

    try {
      const token = await getToken();
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "manual_usage",
          updates,
          note: manualNotes || "Pemakaian packing manual",
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Sebagian atau seluruh data gagal disimpan");
      } else {
        setSuccessMsg(`Berhasil mencatat pemakaian manual ${updates.length} bahan`);
        setManualEntries(new Map());
        setManualNotes("");
        onSuccess();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
      <h2 className="text-sm font-extrabold text-slate-800 mb-2">Pemakaian Bahan Manual</h2>
      <p className="text-xs text-slate-500">Catat pemakaian box, lakban, plastik kresek, atau bahan operasional lainnya yang tidak terikat langsung dengan recipe.</p>

      {error && <div className="bg-red-50 text-red-600 text-xs p-3.5 rounded-xl border border-red-100">{error}</div>}
      {successMsg && <div className="bg-green-50 text-green-700 text-xs p-3.5 rounded-xl border border-green-100">{successMsg}</div>}

      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-700">Daftar Bahan Packaging & Operasional</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {manualIngredientsList.map((ing) => (
            <div key={ing.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-800">{ing.name}</p>
                <p className="text-xxs text-slate-400">Sisa: {ing.currentStock} {ing.baseUnit}</p>
              </div>
              <Input
                type="number"
                placeholder="0"
                value={manualEntries.get(ing.id) || ""}
                onChange={(e) => updateManualEntry(ing.id, e.target.value)}
                className="w-20 h-9 text-center text-xs font-bold rounded-xl border-slate-200 focus-visible:ring-pink-200"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 pt-2">
        <label className="text-xs font-bold text-slate-700">Catatan Pemakaian (Opsional)</label>
        <Input
          type="text"
          placeholder="Misal: Rusak basah, dipakai kirim ke outlet B, dll"
          value={manualNotes}
          onChange={(e) => setManualNotes(e.target.value)}
          className="h-11 rounded-xl text-sm font-medium bg-white focus-visible:ring-pink-200"
        />
      </div>

      <button
        onClick={handleManualUsage}
        disabled={submitting || Array.from(manualEntries.values()).every(v => !v || parseFloat(v) <= 0)}
        className="w-full h-12 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2"
        style={{ background: "linear-gradient(135deg, #E85D8C 0%, #D84275 100%)" }}
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Simpan Catatan Pemakaian"}
      </button>
    </div>
  );
}
