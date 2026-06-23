"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Minus, Plus, ChefHat } from "lucide-react";
import type { Variant, Production } from "@/types";

interface EntryInput {
  variantId: string;
  batches: string;
  loyangCount: string;
}

export default function CrewProductionPage() {
  const { getToken } = useAuth();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [todayProductions, setTodayProductions] = useState<Production[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<Map<string, EntryInput>>(new Map());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  const loadData = useCallback(async () => {
    try {
      const [varRes, prodRes] = await Promise.all([
        fetchWithAuth("/api/variants"),
        fetchWithAuth(`/api/productions?date=${new Date().toISOString().split("T")[0]}`),
      ]);
      if (varRes.ok) {
        const data: Variant[] = await varRes.json();
        setVariants(data.filter((v) => v.isProductionVariant));
      }
      if (prodRes.ok) setTodayProductions(await prodRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadData(); }, [loadData]);

  function toggleVariant(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
      const nextEntries = new Map(entries);
      nextEntries.delete(id);
      setEntries(nextEntries);
    } else {
      next.add(id);
      const nextEntries = new Map(entries);
      nextEntries.set(id, { variantId: id, batches: "", loyangCount: "" });
      setEntries(nextEntries);
    }
    setSelected(next);
  }

  function updateEntry(variantId: string, field: "batches" | "loyangCount", value: string) {
    const nextEntries = new Map(entries);
    const entry = nextEntries.get(variantId);
    if (entry) {
      nextEntries.set(variantId, { ...entry, [field]: value });
      setEntries(nextEntries);
    }
  }

  function stepValue(variantId: string, field: "batches" | "loyangCount", delta: number) {
    const entry = entries.get(variantId);
    if (!entry) return;
    const current = parseFloat(entry[field]) || 0;
    const step = field === "batches" ? 0.5 : 1;
    const next = Math.max(0, current + delta * step);
    updateEntry(variantId, field, String(next));
  }

  async function handleSubmit() {
    setError("");
    setSuccess("");
    setSubmitting(true);

    const batchEntries = Array.from(entries.values())
      .filter((e) => parseFloat(e.batches) > 0 || parseInt(e.loyangCount) > 0)
      .map((e) => ({
        variantId: e.variantId,
        batches: parseFloat(e.batches) || 0,
        loyangCount: parseInt(e.loyangCount) || 0,
      }));

    if (batchEntries.length === 0) {
      setError("Isi minimal 1 varian");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchWithAuth("/api/productions/batch", {
        method: "POST",
        body: JSON.stringify({ entries: batchEntries, notes }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan");
        return;
      }

      setSuccess(`Tersimpan — ${data.entriesSaved} varian`);
      if (data.warnings?.length > 0) {
        setSuccess((s) => s + ` (peringatan: ${data.warnings.join(", ")})`);
      }
      setSelected(new Set());
      setEntries(new Map());
      setNotes("");
      await loadData();
    } catch {
      setError("Gagal menyimpan produksi");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="page-enter px-5 pt-6 pb-4 max-w-md mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ChefHat size={16} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">Produksi</h1>
        </div>
        <p className="text-sm text-stone-500 ml-10">Apa yang kamu buat hari ini?</p>
      </div>

      {/* Variant chips */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-3">Pilih Varian</p>
        <div className="flex flex-wrap gap-2" data-testid="variant-chips">
          {variants.map((v) => {
            const isSelected = selected.has(v.id);
            return (
              <button
                key={v.id}
                onClick={() => toggleVariant(v.id)}
                data-testid={`variant-chip-${v.id}`}
                className={`min-h-[48px] px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border tap-target ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                    : "bg-white text-stone-700 border-stone-200 hover:border-stone-300"
                }`}
              >
                {v.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Entry cards */}
      <div className="space-y-4 mb-4">
        {Array.from(selected).map((vid) => {
          const variant = variants.find((v) => v.id === vid);
          const entry = entries.get(vid);
          if (!variant || !entry) return null;
          return (
            <div
              key={vid}
              className="rounded-3xl bg-white border border-stone-100 shadow-sm p-5 page-enter"
              data-testid={`entry-card-${vid}`}
            >
              <p className="font-bold text-stone-900 mb-4 text-base">{variant.name}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-2 block">
                    Jumlah Batch / Adonan
                  </label>
                  <Stepper
                    value={entry.batches}
                    onChange={(v) => updateEntry(vid, "batches", v)}
                    onStep={(d) => stepValue(vid, "batches", d)}
                    step="0.5"
                    testId={`stepper-batches-${vid}`}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-2 block">
                    Jumlah Loyang
                  </label>
                  <Stepper
                    value={entry.loyangCount}
                    onChange={(v) => updateEntry(vid, "loyangCount", v)}
                    onStep={(d) => stepValue(vid, "loyangCount", d)}
                    step="1"
                    testId={`stepper-loyang-${vid}`}
                  />
                  <p className="text-xs text-stone-400 mt-1.5">Sesuai loyang yang sudah dicetak</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <>
          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-2 block">
              Catatan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors"
              rows={2}
              placeholder="Catatan umum produksi hari ini..."
              data-testid="production-notes"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-70 tap-target"
            data-testid="save-production-button"
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
            Simpan Semua Produksi
          </button>
        </>
      )}

      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 mt-4" data-testid="production-error">
          <p className="text-sm text-rose-700 font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 mt-4" data-testid="production-success">
          <p className="text-sm text-emerald-700 font-medium">{success}</p>
        </div>
      )}

      {/* Today's productions */}
      {todayProductions.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-3">
            Sudah Dicatat Hari Ini
          </p>
          <div className="space-y-2">
            {todayProductions.map((p, i) => (
              <div
                key={p.id}
                className="rounded-2xl bg-white border border-stone-100 shadow-sm px-4 py-3 flex items-center justify-between"
                data-testid={`today-production-${i}`}
              >
                <div>
                  <span className="text-sm font-semibold text-stone-900">{p.variantId}</span>
                  <p className="text-xs text-stone-400">{p.batches} batch</p>
                </div>
                <span className="text-sm font-bold tabular-nums text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                  {p.loyangCount} loyang
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  onStep,
  step,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  onStep: (delta: number) => void;
  step: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center bg-stone-50 border border-stone-200 rounded-full p-1 gap-1" data-testid={testId}>
      <button
        type="button"
        onClick={() => onStep(-1)}
        className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-600 active:bg-stone-100 transition-colors tap-target"
        data-testid={testId ? `${testId}-minus` : undefined}
      >
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <Input
        type="number"
        step={step}
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-center font-black text-xl tabular-nums border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-12 p-0"
        data-testid={testId ? `${testId}-input` : undefined}
      />
      <button
        type="button"
        onClick={() => onStep(1)}
        className="h-12 w-12 rounded-full bg-emerald-600 shadow-sm flex items-center justify-center text-white active:bg-emerald-700 transition-colors tap-target"
        data-testid={testId ? `${testId}-plus` : undefined}
      >
        <Plus size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
