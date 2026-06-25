"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";

interface OpnameItem {
  ingredientId: string;
  inputMethod: string;
  physicalStock: number | null;
  fullPackages: number | null;
  openPackageFullness: string | null;
  physicalStockConverted: number | null;
  systemStock: number;
  difference: number;
}

interface OpnameRecord {
  id: string;
  date: string;
  crewId: string;
  items: OpnameItem[];
  totalIngredientsChecked: number;
  totalIngredientsAll: number;
  hasDiscrepancy: boolean;
  reviewedBy: string | null;
  reviewAction: string | null;
}

interface IngredientInfo {
  id: string;
  name: string;
  baseUnit: string;
}

export default function StockOpnameReviewPage() {
  const { getToken } = useAuth();
  const [opnames, setOpnames] = useState<OpnameRecord[]>([]);
  const [ingredients, setIngredients] = useState<Map<string, IngredientInfo>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<
    Map<string, Map<string, boolean>>
  >(new Map());
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState("");
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

  const loadData = useCallback(async () => {
    try {
      const [opnameRes, ingRes] = await Promise.all([
        fetchWithAuth("/api/stock-opname"),
        fetchWithAuth("/api/ingredients"),
      ]);
      const opnameData = await opnameRes.json();
      const ingData = await ingRes.json();

      const ingMap = new Map<string, IngredientInfo>();
      for (const ing of ingData as IngredientInfo[]) {
        ingMap.set(ing.id, ing);
      }
      setIngredients(ingMap);
      setOpnames(opnameData);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleAdjustment(opnameId: string, ingredientId: string) {
    setAdjustments((prev) => {
      const next = new Map(prev);
      const opnameAdj = new Map(next.get(opnameId) ?? new Map());
      opnameAdj.set(ingredientId, !opnameAdj.get(ingredientId));
      next.set(opnameId, opnameAdj);
      return next;
    });
  }

  async function handleReview(opnameId: string) {
    setSubmitting(opnameId);
    setError("");
    try {
      const opname = opnames.find((o) => o.id === opnameId);
      if (!opname) return;

      const opnameAdj = adjustments.get(opnameId) ?? new Map();
      const adjList = opname.items
        .filter((item) => item.difference !== 0)
        .map((item) => ({
          ingredientId: item.ingredientId,
          applyAdjustment: opnameAdj.get(item.ingredientId) ?? false,
        }));

      const res = await fetchWithAuth(`/api/stock-opname/${opnameId}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          reviewNote: reviewNote || undefined,
          adjustments: adjList,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Gagal mereview");
        return;
      }

      setExpandedId(null);
      setReviewNote("");
      await loadData();
    } finally {
      setSubmitting("");
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatNumber(n: number, unit: string) {
    return `${n.toLocaleString("id-ID")} ${unit}`;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const pendingReview = opnames.filter((o) => !o.reviewedBy);
  const reviewed = opnames.filter((o) => o.reviewedBy);

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-1">
        Review Stock Opname
      </h1>
      <p className="text-sm text-stone-500 mb-5">
        {pendingReview.length} opname menunggu review
      </p>

      {pendingReview.length === 0 && reviewed.length === 0 && (
        <Card className="p-8 text-center">
          <ClipboardList className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">Belum ada data opname</p>
        </Card>
      )}

      {pendingReview.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-stone-700 mb-3">
            Menunggu Review
          </h2>
          <div className="space-y-3">
            {pendingReview.map((opname) => {
              const isExpanded = expandedId === opname.id;
              const discrepancyItems = opname.items.filter(
                (i) => i.difference !== 0
              );

              return (
                <Card key={opname.id} className="overflow-hidden">
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : opname.id)
                    }
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {formatDate(opname.date)}
                      </p>
                      <p className="text-xs text-stone-500">
                        {opname.totalIngredientsChecked}/
                        {opname.totalIngredientsAll} bahan dicek
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {opname.hasDiscrepancy && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                          <AlertTriangle size={12} />
                          {discrepancyItems.length} selisih
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-stone-400" />
                      ) : (
                        <ChevronDown size={16} className="text-stone-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-stone-100 pt-3">
                      {discrepancyItems.length === 0 ? (
                        <p className="text-sm text-emerald-600 mb-3">
                          Tidak ada selisih — semua cocok
                        </p>
                      ) : (
                        <div className="space-y-2 mb-4">
                          {discrepancyItems.map((item) => {
                            const ing = ingredients.get(item.ingredientId);
                            const unit = ing?.baseUnit ?? "";
                            const physical =
                              item.inputMethod === "packaged"
                                ? item.physicalStockConverted ?? 0
                                : item.physicalStock ?? 0;
                            const isChecked =
                              adjustments
                                .get(opname.id)
                                ?.get(item.ingredientId) ?? false;

                            return (
                              <div
                                key={item.ingredientId}
                                className="bg-stone-50 rounded-lg p-3"
                              >
                                <div className="flex items-start justify-between mb-1">
                                  <p className="text-sm font-medium text-stone-900">
                                    {ing?.name ?? item.ingredientId}
                                  </p>
                                  <span
                                    className={`text-xs font-mono ${
                                      item.difference < 0
                                        ? "text-red-600"
                                        : "text-emerald-600"
                                    }`}
                                  >
                                    {item.difference > 0 ? "+" : ""}
                                    {formatNumber(item.difference, unit)}
                                  </span>
                                </div>
                                <p className="text-xs text-stone-500">
                                  Sistem: {formatNumber(item.systemStock, unit)}{" "}
                                  | Fisik: {formatNumber(physical, unit)}
                                </p>
                                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      toggleAdjustment(
                                        opname.id,
                                        item.ingredientId
                                      )
                                    }
                                    className="rounded border-stone-300"
                                  />
                                  <span className="text-xs text-stone-600">
                                    Sesuaikan stok sistem ke angka fisik
                                  </span>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <Input
                        placeholder="Catatan review (opsional)"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        className="mb-3"
                      />

                      <Button
                        onClick={() => handleReview(opname.id)}
                        disabled={submitting === opname.id}
                        className="w-full gap-2"
                      >
                        {submitting === opname.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                        Selesaikan Review
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {reviewed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-700 mb-3">
            Sudah Direview
          </h2>
          <div className="space-y-2">
            {reviewed.map((opname) => (
              <Card key={opname.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {formatDate(opname.date)}
                    </p>
                    <p className="text-xs text-stone-500">
                      {opname.totalIngredientsChecked} bahan dicek
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      opname.reviewAction === "adjusted"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {opname.reviewAction === "adjusted"
                      ? "Disesuaikan"
                      : "Acknowledged"}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
