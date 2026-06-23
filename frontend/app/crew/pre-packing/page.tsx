"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Minus, Plus, ChevronDown, ChevronUp } from "lucide-react";
import type { Variant } from "@/types";

interface PoolItem {
  productionId: string;
  date: string;
  loyangRemaining: number;
}

export default function CrewPrePackingPage() {
  const { getToken } = useAuth();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [showDetail, setShowDetail] = useState(false);

  const [loyangUsed, setLoyangUsed] = useState("");
  const [regularPacks, setRegularPacks] = useState("");
  const [fullPacks, setFullPacks] = useState("");

  const [loading, setLoading] = useState(true);
  const [poolLoading, setPoolLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

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

  useEffect(() => {
    fetchWithAuth("/api/variants")
      .then(async (res) => {
        if (res.ok) {
          const data: Variant[] = await res.json();
          setVariants(data.filter((v) => v.isProductionVariant));
        }
      })
      .finally(() => setLoading(false));
  }, [fetchWithAuth]);

  const loadPool = useCallback(
    async (variantId: string) => {
      setPoolLoading(true);
      try {
        const res = await fetchWithAuth(`/api/productions/loyang-pool?variantId=${variantId}`);
        if (res.ok) {
          const data = await res.json();
          setPool(data.pool);
          setTotalAvailable(data.totalAvailable);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setPoolLoading(false);
      }
    },
    [fetchWithAuth]
  );

  function selectVariant(id: string) {
    setSelectedVariant(id);
    setLoyangUsed("");
    setRegularPacks("");
    setFullPacks("");
    setSuccess("");
    setError("");
    setShowDetail(false);
    loadPool(id);
  }

  function stepVal(setter: (v: string) => void, current: string, delta: number, max?: number) {
    const val = Math.max(0, (parseInt(current) || 0) + delta);
    if (max !== undefined && val > max) return;
    setter(String(val));
  }

  async function handleSubmit() {
    setError("");
    setSuccess("");

    const loyang = parseInt(loyangUsed) || 0;
    if (loyang <= 0) {
      setError("Jumlah loyang harus lebih dari 0");
      return;
    }
    if (loyang > totalAvailable) {
      setError(`Loyang tidak cukup, tersedia hanya ${totalAvailable}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/pre-packing", {
        method: "POST",
        body: JSON.stringify({
          variantId: selectedVariant,
          totalLoyangUsed: loyang,
          resultRegularPacks: parseInt(regularPacks) || 0,
          resultFullPacks: parseInt(fullPacks) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan");
        return;
      }

      setSuccess("Tersimpan ✓");
      setLoyangUsed("");
      setRegularPacks("");
      setFullPacks("");
      if (selectedVariant) loadPool(selectedVariant);
    } catch {
      setError("Gagal menyimpan pre-packing");
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
      <h1 className="text-xl font-bold text-stone-900 mb-1">Pre-Packing</h1>
      <p className="text-sm text-stone-500 mb-5">Loyang → Pack Regular & Full</p>

      <div className="flex flex-wrap gap-2 mb-5">
        {variants.map((v) => (
          <button
            key={v.id}
            onClick={() => selectVariant(v.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] ${
              selectedVariant === v.id
                ? "bg-emerald-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>

      {selectedVariant && (
        <>
          {poolLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              <Card className="p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-stone-900">{totalAvailable}</p>
                    <p className="text-sm text-stone-500">loyang siap di-pack</p>
                  </div>
                  {pool.length > 0 && (
                    <button
                      onClick={() => setShowDetail(!showDetail)}
                      className="text-xs text-emerald-600 flex items-center gap-1"
                    >
                      {showDetail ? "Sembunyikan" : "Lihat rincian"}
                      {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>
                {showDetail && pool.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-stone-100 pt-3">
                    {pool.map((p) => (
                      <div key={p.productionId} className="flex justify-between text-xs text-stone-500">
                        <span>{new Date(p.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                        <span className="font-mono">{p.loyangRemaining} loyang</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {totalAvailable > 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Loyang dipakai sekarang</label>
                    <StepperInput
                      value={loyangUsed}
                      onChange={setLoyangUsed}
                      onStep={(d) => stepVal(setLoyangUsed, loyangUsed, d, totalAvailable)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Jadi pack Regular berapa</label>
                    <StepperInput
                      value={regularPacks}
                      onChange={setRegularPacks}
                      onStep={(d) => stepVal(setRegularPacks, regularPacks, d)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Jadi pack Full berapa</label>
                    <StepperInput
                      value={fullPacks}
                      onChange={setFullPacks}
                      onStep={(d) => stepVal(setFullPacks, fullPacks, d)}
                    />
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !(parseInt(loyangUsed) > 0)}
                    className="w-full min-h-[48px] text-base gap-2"
                    size="lg"
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Simpan
                  </Button>
                </div>
              )}

              {totalAvailable === 0 && (
                <div className="rounded-xl border border-stone-200 bg-white p-6 text-center text-stone-400">
                  Belum ada loyang tersedia untuk varian ini
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          {success && <p className="text-sm text-emerald-600 mt-3 font-medium">{success}</p>}
        </>
      )}
    </div>
  );
}

function StepperInput({
  value,
  onChange,
  onStep,
}: {
  value: string;
  onChange: (v: string) => void;
  onStep: (delta: number) => void;
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
