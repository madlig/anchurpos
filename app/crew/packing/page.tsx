"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Check, PackageOpen } from "lucide-react";
import type { Ingredient } from "@/types";

export default function CrewPackingPage() {
  const { getToken } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [entries, setEntries] = useState<Map<string, string>>(new Map());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/ingredients");
      if (res.ok) {
        const data: Ingredient[] = await res.json();
        // Only show operasional and add_on
        setIngredients(data.filter(i => i.category === "operasional" || i.category === "add_on"));
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadData(); }, [loadData]);

  function updateEntry(id: string, val: string) {
    const next = new Map(entries);
    next.set(id, val);
    setEntries(next);
  }

  async function handleSubmit() {
    setError("");
    setSuccess("");
    setSubmitting(true);

    const updates = Array.from(entries.entries())
      .filter(([_, val]) => parseFloat(val) > 0)
      .map(([id, val]) => {
        const ing = ingredients.find(i => i.id === id);
        return {
          id,
          name: ing?.name ?? id,
          qtyUsed: parseFloat(val) || 0,
          currentStock: (ing?.currentStock ?? 0) - (parseFloat(val) || 0)
        };
      });

    if (updates.length === 0) {
      setError("Isi minimal 1 bahan yang digunakan");
      setSubmitting(false);
      return;
    }

    try {
      // Create an endpoint to batch update ingredients or just loop updates
      const promises = updates.map(u => 
        fetchWithAuth(`/api/ingredients/${u.id}/stock`, {
          method: "PATCH",
          body: JSON.stringify({ newStock: u.currentStock, note: notes || "Pemakaian packing" })
        })
      );
      
      const results = await Promise.all(promises);
      if (results.some(r => !r.ok)) {
        setError("Sebagian atau seluruh data gagal disimpan");
      } else {
        setSuccess(`Berhasil mencatat pemakaian ${updates.length} bahan`);
        setEntries(new Map());
        setNotes("");
        await loadData();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
      </div>
    );
  }

  return (
    <div className="page-enter min-h-screen" style={{ background: "#FCABB4" }}>
      {/* Header */}
      <div className="px-5 pt-4 pb-4" style={{ background: "#fff" }}>
        <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Packing Produksi</h1>
        <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>
          Catat pemakaian kemasan, stiker, dan bahan tambahan
        </p>
      </div>

      <div className="px-4 pt-4 pb-24 md:px-8 md:max-w-3xl">
        
        {ingredients.length === 0 ? (
          <div className="py-12 text-center" style={{ background: "#fff", borderRadius: "14px", border: "1px solid #F1F5F9" }}>
            <PackageOpen className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-sm text-slate-500 font-medium">Belum ada bahan operasional/add-on</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {ingredients.map(ing => (
              <div key={ing.id} style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{ing.name}</p>
                    <p className="text-xs text-slate-400">Sisa stok: {ing.currentStock} {ing.baseUnit}</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#FEF1F5", color: "#E85D8C" }}>
                    {ing.category === "operasional" ? "Operasional" : "Add-On"}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Input 
                    type="number"
                    placeholder="Jumlah terpakai"
                    value={entries.get(ing.id) || ""}
                    onChange={e => updateEntry(ing.id, e.target.value)}
                    className="flex-1 h-12 rounded-xl text-sm border-slate-200"
                    data-testid={`packing-input-${ing.id}`}
                  />
                  <span className="text-xs font-semibold text-slate-400 min-w-[30px]">
                    {ing.baseUnit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {ingredients.length > 0 && (
          <>
            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#94A3B8" }}>
                Catatan (Opsional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none transition-colors"
                style={{ border: "1px solid #E2E8F0", background: "#fff" }}
                rows={2}
                placeholder="Catatan pemakaian..."
                data-testid="packing-notes"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 tap-target"
              style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)", boxShadow: "0 8px 20px rgba(232,93,140,0.3)" }}
              data-testid="save-packing-button"
            >
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              Simpan Pemakaian
            </button>
          </>
        )}

        {error && (
          <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <p className="text-sm font-medium" style={{ color: "#DC2626" }}>{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <p className="text-sm font-medium" style={{ color: "#16A34A" }}>{success}</p>
          </div>
        )}

      </div>
    </div>
  );
}
