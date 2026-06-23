"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, ClipboardList } from "lucide-react";
import type { Ingredient } from "@/types";

interface OpnameEntry {
  ingredientId: string;
  physicalStock?: number | null;
  fullPackages?: number | null;
  openPackageFullness?: string | null;
  filled: boolean;
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

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const token = await getToken();
      return fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
    },
    [getToken]
  );

  useEffect(() => {
    fetchWithAuth("/api/ingredients")
      .then((r) => r.json())
      .then((data) => {
        setIngredients(data as Ingredient[]);
      })
      .finally(() => setLoading(false));
  }, [fetchWithAuth]);

  function updateEntry(id: string, updates: Partial<OpnameEntry>) {
    setEntries((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) ?? {
        ingredientId: id,
        filled: false,
      };
      const updated = { ...existing, ...updates };

      const ingredient = ingredients.find((i) => i.id === id);
      if (ingredient?.opnameMethod === "packaged") {
        updated.filled =
          updated.fullPackages !== null && updated.fullPackages !== undefined;
      } else {
        updated.filled =
          updated.physicalStock !== null && updated.physicalStock !== undefined;
      }

      next.set(id, updated);
      return next;
    });
  }

  const filledCount = Array.from(entries.values()).filter(
    (e) => e.filled
  ).length;

  async function handleSubmit() {
    if (!shiftType) {
      setError("Pilih shift dulu");
      return;
    }

    const filledEntries = Array.from(entries.values()).filter((e) => e.filled);
    if (filledEntries.length === 0) {
      setError("Isi minimal 1 bahan");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/stock-opname", {
        method: "POST",
        body: JSON.stringify({
          shiftType,
          items: filledEntries.map((e) => ({
            ingredientId: e.ingredientId,
            physicalStock: e.physicalStock ?? null,
            fullPackages: e.fullPackages ?? null,
            openPackageFullness: e.openPackageFullness ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan opname");
        return;
      }
      setResult({ totalChecked: data.totalChecked });
    } catch {
      setError("Gagal menyimpan opname");
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

  if (result) {
    return (
      <div className="p-5">
        <Card className="p-6 text-center">
          <Check className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-stone-900 mb-1">
            Opname Tersimpan
          </h2>
          <p className="text-sm text-stone-500">
            {result.totalChecked} bahan dicek
          </p>
          <Button
            onClick={() => {
              setResult(null);
              setEntries(new Map());
              setShiftType("");
            }}
            variant="outline"
            className="mt-4"
          >
            Opname Baru
          </Button>
        </Card>
      </div>
    );
  }

  if (!shiftType) {
    return (
      <div className="p-5">
        <h1 className="text-xl font-bold text-stone-900 mb-1">Stock Opname</h1>
        <p className="text-sm text-stone-500 mb-5">Pilih shift untuk mulai</p>
        <div className="space-y-3">
          {(["pagi", "siang", "malam"] as const).map((s) => (
            <Card
              key={s}
              className="p-4 text-center cursor-pointer hover:bg-stone-50 transition-colors"
              onClick={() => setShiftType(s)}
            >
              <p className="text-base font-semibold text-stone-900 capitalize">
                Shift {s}
              </p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Stock Opname</h1>
          <p className="text-sm text-stone-500 capitalize">
            Shift {shiftType} — {filledCount}/{ingredients.length} bahan diisi
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {ingredients.map((ing) => {
          const entry = entries.get(ing.id);
          const isPackaged = ing.opnameMethod === "packaged" && ing.packagedConfig;

          return (
            <Card
              key={ing.id}
              className={`p-4 ${entry?.filled ? "border-emerald-200 bg-emerald-50/30" : ""}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {ing.name}
                  </p>
                  <p className="text-xs text-stone-400">
                    {isPackaged
                      ? `Kemasan (${ing.packagedConfig!.packageLabel})`
                      : `Satuan: ${ing.baseUnit}`}
                  </p>
                </div>
                {entry?.filled && (
                  <Check size={16} className="text-emerald-600 mt-0.5" />
                )}
              </div>

              {isPackaged ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">
                      {ing.packagedConfig!.packageLabel} penuh (tersegel)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={entry?.fullPackages ?? ""}
                      onChange={(e) =>
                        updateEntry(ing.id, {
                          fullPackages: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">
                      {ing.packagedConfig!.packageLabel} yang sedang dibuka
                    </label>
                    <select
                      value={entry?.openPackageFullness ?? ""}
                      onChange={(e) =>
                        updateEntry(ing.id, {
                          openPackageFullness: e.target.value || null,
                        })
                      }
                      className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Tidak ada yang dibuka</option>
                      {ing.packagedConfig!.fullnessOptions.map((opt) => (
                        <option key={opt.label} value={opt.label}>
                          {opt.label} (~{Math.round(opt.ratio * 100)}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <Input
                  type="number"
                  min="0"
                  placeholder={`Jumlah (${ing.baseUnit})`}
                  value={entry?.physicalStock ?? ""}
                  onChange={(e) =>
                    updateEntry(ing.id, {
                      physicalStock: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                />
              )}
            </Card>
          );
        })}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting || filledCount === 0}
        className="w-full min-h-[48px] text-base gap-2"
        size="lg"
      >
        {submitting ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <ClipboardList size={18} />
        )}
        Submit Opname ({filledCount} bahan)
      </Button>

      {error && <p className="text-sm text-red-600 mt-3 text-center">{error}</p>}
    </div>
  );
}
