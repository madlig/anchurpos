"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Minus, Plus } from "lucide-react";
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
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-1">Produksi</h1>
      <p className="text-sm text-stone-500 mb-5">Apa yang kamu buat hari ini?</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {variants.map((v) => {
          const isSelected = selected.has(v.id);
          return (
            <button
              key={v.id}
              onClick={() => toggleVariant(v.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
                isSelected
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {v.name}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 mb-4">
        {Array.from(selected).map((vid) => {
          const variant = variants.find((v) => v.id === vid);
          const entry = entries.get(vid);
          if (!variant || !entry) return null;
          return (
            <Card key={vid} className="p-4">
              <p className="font-semibold text-stone-900 mb-3">{variant.name}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">Jumlah Batch/Adonan</label>
                  <Stepper
                    value={entry.batches}
                    onChange={(v) => updateEntry(vid, "batches", v)}
                    onStep={(d) => stepValue(vid, "batches", d)}
                    step="0.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">Jumlah Loyang</label>
                  <Stepper
                    value={entry.loyangCount}
                    onChange={(v) => updateEntry(vid, "loyangCount", v)}
                    onStep={(d) => stepValue(vid, "loyangCount", d)}
                    step="1"
                  />
                  <p className="text-xs text-stone-400 mt-1">Sesuai loyang yang sudah dicetak</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {selected.size > 0 && (
        <>
          <div className="mb-4">
            <label className="text-xs text-stone-500 mb-1 block">Catatan (opsional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm resize-none"
              rows={2}
              placeholder="Catatan umum..."
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full min-h-[48px] text-base gap-2"
            size="lg"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            Simpan Semua Produksi
          </Button>
        </>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {success && <p className="text-sm text-emerald-600 mt-3">{success}</p>}

      {todayProductions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-stone-900 mb-2">Riwayat hari ini</h2>
          <div className="space-y-2">
            {todayProductions.map((p) => (
              <Card key={p.id} className="p-3 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium text-stone-900">{p.variantId}</span>
                  <span className="text-stone-400 mx-1">·</span>
                  <span className="text-stone-500">{p.batches} batch</span>
                </div>
                <span className="text-sm font-mono text-stone-700">{p.loyangCount} loyang</span>
              </Card>
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
}: {
  value: string;
  onChange: (v: string) => void;
  onStep: (delta: number) => void;
  step: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onStep(-1)}
        className="h-10 w-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 active:scale-95"
      >
        <Minus size={16} />
      </button>
      <Input
        type="number"
        step={step}
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-center flex-1 font-mono text-lg"
      />
      <button
        type="button"
        onClick={() => onStep(1)}
        className="h-10 w-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 active:scale-95"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
