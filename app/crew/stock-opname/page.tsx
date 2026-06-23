"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Check, ClipboardList } from "lucide-react";
import type { Ingredient } from "@/types";

interface OpnameEntry {
  ingredientId: string; physicalStock?: number | null;
  fullPackages?: number | null; openPackageFullness?: string | null; filled: boolean;
}

export default function CrewStockOpnamePage() {
  const { getToken } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftType, setShiftType] = useState<"pagi" | "siang" | "malam" | "">("");
  const [entries, setEntries] = useState<Map<string, OpnameEntry>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ totalChecked: number } | null>(null);
  const [error, setError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    fetchWithAuth("/api/ingredients").then((r) => r.json()).then((d) => setIngredients(d as Ingredient[])).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  function updateEntry(id: string, updates: Partial<OpnameEntry>) {
    setEntries((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) ?? { ingredientId: id, filled: false };
      const updated = { ...existing, ...updates };
      const ingredient = ingredients.find((i) => i.id === id);
      if (ingredient?.opnameMethod === "packaged") {
        updated.filled = updated.fullPackages !== null && updated.fullPackages !== undefined;
      } else {
        updated.filled = updated.physicalStock !== null && updated.physicalStock !== undefined;
      }
      next.set(id, updated);
      return next;
    });
  }

  const filledCount = Array.from(entries.values()).filter((e) => e.filled).length;

  async function handleSubmit() {
    if (!shiftType) { setError("Pilih shift dulu"); return; }
    const filledEntries = Array.from(entries.values()).filter((e) => e.filled);
    if (filledEntries.length === 0) { setError("Isi minimal 1 bahan"); return; }
    setError(""); setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/stock-opname", {
        method: "POST",
        body: JSON.stringify({ shiftType, items: filledEntries.map((e) => ({ ingredientId: e.ingredientId, physicalStock: e.physicalStock ?? null, fullPackages: e.fullPackages ?? null, openPackageFullness: e.openPackageFullness ?? null })) }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Gagal menyimpan opname"); return; }
      setResult({ totalChecked: d.totalChecked });
    } catch { setError("Gagal menyimpan opname"); } finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} /></div>;

  if (result) {
    return (
      <div className="flex h-screen items-center justify-center px-5">
        <div className="rounded-3xl p-8 text-center max-w-sm w-full page-enter" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}>
          <div className="h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "#F0FDF4" }}>
            <Check className="h-8 w-8" style={{ color: "#16A34A" }} strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-extrabold mb-1" style={{ color: "#1C1C1E" }}>Opname Tersimpan!</h2>
          <p className="text-sm" style={{ color: "#64748B" }}>{result.totalChecked} bahan dicek</p>
          <button onClick={() => { setResult(null); setEntries(new Map()); setShiftType(""); }} className="mt-5 w-full h-12 rounded-2xl text-sm font-bold tap-target" style={{ background: "#F1F5F9", color: "#334155" }}>
            Opname Baru
          </button>
        </div>
      </div>
    );
  }

  if (!shiftType) {
    return (
      <div className="px-5 pt-6 pb-4 max-w-md mx-auto page-enter">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "#FEF1F5" }}>
            <ClipboardList size={16} style={{ color: "#E85D8C" }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#1C1C1E" }}>Stock Opname</h1>
        </div>
        <p className="text-sm ml-10 mb-6" style={{ color: "#64748B" }}>Pilih shift untuk mulai</p>
        <div className="space-y-3">
          {(["pagi", "siang", "malam"] as const).map((s, i) => {
            const icons = ["🌅", "☀️", "🌙"];
            return (
              <button key={s} onClick={() => setShiftType(s)} className={`w-full rounded-3xl p-5 text-left tap-target page-enter stagger-${i+1}`}
                style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                data-testid={`shift-${s}`}>
                <span className="text-xl mr-2">{icons[i]}</span>
                <span className="text-base font-bold capitalize" style={{ color: "#1C1C1E" }}>Shift {s}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-4 max-w-md mx-auto page-enter">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#1C1C1E" }}>Stock Opname</h1>
          <p className="text-sm capitalize" style={{ color: "#64748B" }}>Shift {shiftType} — {filledCount}/{ingredients.length} diisi</p>
        </div>
        <div className="rounded-2xl px-3 py-1.5" style={{ background: "#FEF1F5" }}>
          <span className="text-sm font-bold tabular-nums" style={{ color: "#E85D8C" }}>{filledCount}/{ingredients.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full mb-5 overflow-hidden" style={{ background: "#F1F5F9" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${ingredients.length > 0 ? (filledCount / ingredients.length) * 100 : 0}%`, background: "linear-gradient(90deg,#E85D8C,#C94A73)" }} />
      </div>

      <div className="space-y-3 mb-6">
        {ingredients.map((ing) => {
          const entry = entries.get(ing.id);
          const isPackaged = ing.opnameMethod === "packaged" && ing.packagedConfig;
          return (
            <div key={ing.id} className="rounded-2xl p-4" style={{ background: entry?.filled ? "#F0FDF4" : "#fff", border: `1px solid ${entry?.filled ? "#BBF7D0" : "#F1F5F9"}` }} data-testid={`opname-${ing.id}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>{ing.name}</p>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>{isPackaged ? `Kemasan (${ing.packagedConfig!.packageLabel})` : `Satuan: ${ing.baseUnit}`}</p>
                </div>
                {entry?.filled && <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: "#16A34A" }}><Check size={12} className="text-white" strokeWidth={2.5} /></div>}
              </div>
              {isPackaged ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest mb-1 block" style={{ color: "#94A3B8" }}>{ing.packagedConfig!.packageLabel} penuh</label>
                    <Input type="number" min="0" placeholder="0" value={entry?.fullPackages ?? ""} onChange={(e) => updateEntry(ing.id, { fullPackages: e.target.value ? parseInt(e.target.value) : null })} className="h-11 rounded-2xl border-stone-200 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest mb-1 block" style={{ color: "#94A3B8" }}>Yang sedang dibuka</label>
                    <select value={entry?.openPackageFullness ?? ""} onChange={(e) => updateEntry(ing.id, { openPackageFullness: e.target.value || null })} className="w-full h-11 rounded-2xl border px-4 text-sm" style={{ borderColor: "#E2E8F0", background: "#fff" }}>
                      <option value="">Tidak ada yang dibuka</option>
                      {ing.packagedConfig!.fullnessOptions.map((opt) => <option key={opt.label} value={opt.label}>{opt.label} (~{Math.round(opt.ratio * 100)}%)</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <Input type="number" min="0" placeholder={`Jumlah (${ing.baseUnit})`} value={entry?.physicalStock ?? ""} onChange={(e) => updateEntry(ing.id, { physicalStock: e.target.value ? parseFloat(e.target.value) : null })} className="h-11 rounded-2xl border-stone-200 bg-white" />
              )}
            </div>
          );
        })}
      </div>

      <button onClick={handleSubmit} disabled={submitting || filledCount === 0} className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 tap-target disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)", boxShadow: "0 8px 20px rgba(232,93,140,0.3)" }} data-testid="submit-opname-button">
        {submitting ? <Loader2 size={20} className="animate-spin" /> : <ClipboardList size={20} />}
        Submit Opname ({filledCount} bahan)
      </button>

      {error && <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}><p className="text-sm font-medium text-center" style={{ color: "#DC2626" }}>{error}</p></div>}
    </div>
  );
}
