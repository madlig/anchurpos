"use client";

import { useState } from "react";
import { formatNumber, formatDateTime } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Loader2, Check, AlertTriangle, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import type { Ingredient } from "@/types";

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

interface OpnameReviewListProps {
  opnames: OpnameRecord[];
  ingredients: Ingredient[];
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onReviewComplete: () => Promise<void>;
}

export function OpnameReviewList({
  opnames,
  ingredients,
  fetchWithAuth,
  onReviewComplete
}: OpnameReviewListProps) {
  const [expandedOpnameId, setExpandedOpnameId] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Map<string, Map<string, boolean>>>(new Map());
  const [reviewNote, setReviewNote] = useState("");
  const [opnameSubmittingId, setOpnameSubmittingId] = useState("");
  const [opnameError, setOpnameError] = useState("");

  const pendingOpnames = opnames.filter((o) => !o.reviewedBy);
  const reviewedOpnames = opnames.filter((o) => o.reviewedBy);

  function fmtStock(n: number | null | undefined, unit: string) {
    if (n == null) return "-";
    return `${formatNumber(n)} ${unit}`;
  }

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
    setOpnameSubmittingId(opnameId);
    setOpnameError("");
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
        setOpnameError(d.error ?? "Gagal mereview");
        return;
      }

      setExpandedOpnameId(null);
      setReviewNote("");
      await onReviewComplete();
    } catch {
      setOpnameError("Terjadi kesalahan koneksi");
    } finally {
      setOpnameSubmittingId("");
    }
  }

  return (
    <div className="space-y-6 mt-6 max-w-3xl mx-auto">
      {/* Menunggu Review */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-orange-500" />
          <h2 className="text-lg font-bold text-slate-800">Menunggu Review</h2>
        </div>

        {pendingOpnames.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-sm flex flex-col items-center">
            <ClipboardList size={32} className="text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm font-medium">Yeay! Semua opname sudah direview.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingOpnames.map((opname) => {
              const isExpanded = expandedOpnameId === opname.id;
              const discrepancyCount = opname.items.filter(i => i.difference !== 0).length;

              return (
                <div key={opname.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedOpnameId(null);
                      } else {
                        setExpandedOpnameId(opname.id);
                        if (!adjustments.has(opname.id)) {
                          const initialAdj = new Map();
                          opname.items.filter(i => i.difference !== 0).forEach(i => {
                            initialAdj.set(i.ingredientId, true); // Auto check by default
                          });
                          setAdjustments(prev => new Map(prev).set(opname.id, initialAdj));
                        }
                      }
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">{formatDateTime(opname.date)}</p>
                        {opname.hasDiscrepancy && (
                          <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                            Ada Selisih
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        Oleh: {opname.crewId} • Dicek: {opname.totalIngredientsChecked}/{opname.totalIngredientsAll}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                      {opnameError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-semibold mb-4 border border-red-100 flex items-center gap-2">
                          <AlertTriangle size={14} />
                          {opnameError}
                        </div>
                      )}

                      {!opname.hasDiscrepancy ? (
                        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm font-medium border border-emerald-100 flex items-center gap-3 mb-4">
                          <div className="bg-emerald-100 p-2 rounded-full">
                            <Check size={18} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-bold">Stok Aman & Cocok!</p>
                            <p className="text-xs text-emerald-600/80">Tidak ada selisih antara sistem dan fisik.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 mb-4">
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide px-1">
                            Daftar Selisih ({discrepancyCount} Item)
                          </p>
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-2 font-semibold">Bahan</th>
                                  <th className="px-4 py-2 font-semibold whitespace-nowrap">Stok Sistem</th>
                                  <th className="px-4 py-2 font-semibold whitespace-nowrap">Stok Fisik</th>
                                  <th className="px-4 py-2 font-semibold text-right">Selisih</th>
                                  <th className="px-4 py-2 font-semibold text-center">Sesuaikan?</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {opname.items.filter(item => item.difference !== 0).map((item) => {
                                  const ing = ingredients.find(i => i.id === item.ingredientId);
                                  const unit = ing?.baseUnit ?? "";
                                  const physical = item.inputMethod === "packaged" ? item.physicalStockConverted ?? 0 : item.physicalStock ?? 0;
                                  const isChecked = adjustments.get(opname.id)?.get(item.ingredientId) ?? false;
                                  const isMinus = item.difference < 0;

                                  return (
                                    <tr key={item.ingredientId} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-3 font-semibold text-slate-800">
                                        {ing?.name ?? item.ingredientId}
                                      </td>
                                      <td className="px-4 py-3 text-slate-500">{fmtStock(item.systemStock, unit)}</td>
                                      <td className="px-4 py-3 font-bold text-slate-700">{fmtStock(physical, unit)}</td>
                                      <td className={`px-4 py-3 font-bold text-right ${isMinus ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {isMinus ? "" : "+"}{fmtStock(item.difference, unit)}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleAdjustment(opname.id, item.ingredientId)}
                                          className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mt-4">
                        <label className="text-xs font-bold text-slate-500 uppercase">Catatan Review (Opsional)</label>
                        <Input
                          placeholder="Contoh: Stok beras wajar menyusut 2kg"
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          className="h-11 rounded-lg border-slate-200 text-sm bg-slate-50"
                        />
                        <button
                          onClick={() => handleReview(opname.id)}
                          disabled={opnameSubmittingId === opname.id}
                          className="w-full h-11 bg-primary text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md shadow-primary/20 active:scale-[0.98]"
                        >
                          {opnameSubmittingId === opname.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Check size={16} />
                          )}
                          Selesaikan Review
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sudah Direview */}
      <div className="pt-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Riwayat Review</h2>
        {reviewedOpnames.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
            <p className="text-slate-500 text-sm font-medium">Belum ada riwayat opname</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewedOpnames.map((opname) => {
              const isAdjusted = opname.reviewAction === "adjusted";
              return (
                <div
                  key={opname.id}
                  className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-800">{formatDateTime(opname.date)}</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Reviewer: <span className="text-slate-700">{opname.reviewedBy}</span>
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                      isAdjusted ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isAdjusted ? "Stok Disesuaikan" : "Tanpa Koreksi"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
