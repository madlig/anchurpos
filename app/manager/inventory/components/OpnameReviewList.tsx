"use client";

import { useState } from "react";
import { formatNumber, formatDateTime } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { 
  Loader2, Check, AlertTriangle, ChevronDown, ChevronUp, ClipboardList, 
  CheckCircle2, AlertCircle, FileText, User, ArrowLeftRight, CheckSquare, Square
} from "lucide-react";
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
        setOpnameError(d.error ?? "Gagal mereview opname");
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
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* ── Section 1: Menunggu Review Manager ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" /> Menunggu Review Manager ({pendingOpnames.length})
          </h2>
        </div>

        {pendingOpnames.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm flex flex-col items-center space-y-2">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="text-sm font-bold text-slate-700">Semua laporan opname telah selesai direview!</p>
            <p className="text-xs text-slate-400">Tidak ada pending audit stock opname yang perlu tindakan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingOpnames.map((opname) => {
              const isExpanded = expandedOpnameId === opname.id;
              const discrepancyItems = opname.items.filter(i => i.difference !== 0);
              const opnameAdj = adjustments.get(opname.id) ?? new Map();

              return (
                <div key={opname.id} className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden transition-all">
                  
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors"
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedOpnameId(null);
                      } else {
                        setExpandedOpnameId(opname.id);
                        if (!adjustments.has(opname.id)) {
                          const initialAdj = new Map();
                          discrepancyItems.forEach(i => {
                            initialAdj.set(i.ingredientId, true); // Auto check by default
                          });
                          setAdjustments(prev => new Map(prev).set(opname.id, initialAdj));
                        }
                      }
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm font-black text-slate-800">{formatDateTime(opname.date)}</span>
                        {opname.hasDiscrepancy ? (
                          <span className="text-[10px] font-black bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200 uppercase tracking-wider">
                            {discrepancyItems.length} Item Selisih
                          </span>
                        ) : (
                          <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 uppercase tracking-wider">
                            Stok 100% Cocok
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                        <User size={12} /> Staf / Crew ID: {opname.crewId} • Dicek: {opname.totalIngredientsChecked}/{opname.totalIngredientsAll} Item
                      </p>
                    </div>

                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-4">
                      {opnameError && (
                        <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-bold border border-rose-200 flex items-center gap-2">
                          <AlertCircle size={15} /> {opnameError}
                        </div>
                      )}

                      {!opname.hasDiscrepancy ? (
                        <div className="bg-emerald-50/80 text-emerald-900 p-4 rounded-2xl text-xs font-semibold border border-emerald-200 flex items-center gap-3">
                          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                          <div>
                            <p className="font-extrabold text-sm">Stok Fisik & Sistem 100% Sesuai!</p>
                            <p className="text-emerald-700 text-[11px] mt-0.5">Tidak ada selisih barang yang perlu di-adjust.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                              Daftar Item Selisih Fisik vs Sistem ({discrepancyItems.length})
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">
                              Centang untuk perbarui stok Firestore
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            {discrepancyItems.map((item) => {
                              const ingredient = ingredients.find(i => i.id === item.ingredientId);
                              const name = ingredient?.name ?? item.ingredientId;
                              const unit = ingredient?.baseUnit ?? "";
                              const isChecked = opnameAdj.get(item.ingredientId) ?? false;
                              const physicalVal = item.inputMethod === "packaged" ? item.physicalStockConverted : item.physicalStock;

                              return (
                                <div
                                  key={item.ingredientId}
                                  onClick={() => toggleAdjustment(opname.id, item.ingredientId)}
                                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                    isChecked ? "bg-white border-indigo-300 shadow-sm" : "bg-slate-100/60 border-slate-200 text-slate-400"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <button type="button" className="text-indigo-600 shrink-0">
                                      {isChecked ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                                    </button>

                                    <div className="min-w-0">
                                      <p className="font-extrabold text-slate-800 truncate">{name}</p>
                                      <p className="text-[11px] font-semibold text-slate-500">
                                        Sistem: {fmtStock(item.systemStock, unit)} • Fisik: <span className="font-bold text-slate-800">{fmtStock(physicalVal, unit)}</span>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className={`font-black text-xs md:text-sm tabular-nums block ${item.difference > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                      {item.difference > 0 ? "+" : ""}{fmtStock(item.difference, unit)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 space-y-3">
                        <div>
                          <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">Catatan Manager Review (Opsional)</label>
                          <Input
                            type="text"
                            placeholder="Tulis instruksi atau catatan review..."
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            className="h-10 text-xs bg-white rounded-xl border-slate-200"
                          />
                        </div>

                        <button
                          onClick={() => handleReview(opname.id)}
                          disabled={opnameSubmittingId === opname.id}
                          className="w-full h-11 bg-slate-900 hover:bg-black text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                          {opnameSubmittingId === opname.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          Approve & Simpan Review Opname
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

      {/* ── Section 2: Riwayat Opname Ter-Review ── */}
      {reviewedOpnames.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-500" /> Riwayat Audit Opname Selesai ({reviewedOpnames.length})
          </h2>

          <div className="space-y-2">
            {reviewedOpnames.slice(0, 10).map((opname) => (
              <div key={opname.id} className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between text-xs">
                <div>
                  <p className="font-extrabold text-slate-800">{formatDateTime(opname.date)}</p>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                    Oleh: {opname.crewId} • Ter-review oleh Manager
                  </p>
                </div>

                <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  Approved
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
