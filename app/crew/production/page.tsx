"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Check, Plus, ChefHat, Snowflake, Package, AlertTriangle, RefreshCw, Calendar } from "lucide-react";
import type { WorkOrder } from "@/types";

export default function CrewProductionPage() {
  const { getToken, user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Stepper Log Modal State
  const [activeWo, setActiveWo] = useState<WorkOrder | null>(null);
  const [stage, setStage] = useState<"DOUGH_MIXING" | "TRAY_PRINTING" | "FREEZER_CHECKPOINT" | "FINAL_PACKING">("DOUGH_MIXING");
  const [valueAdded, setValueAdded] = useState("1.5");
  const [defectCount, setDefectCount] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/sfm/work-orders?date=${date}`);
      if (res.ok) setWorkOrders(await res.json());
    } catch (err) {
      console.error("Crew loadData error:", err);
    } finally {
      setLoading(false);
    }
  }, [date, fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleQuickLog(wo: WorkOrder, targetStage: "DOUGH_MIXING" | "TRAY_PRINTING" | "FREEZER_CHECKPOINT" | "FINAL_PACKING", val: number) {
    try {
      const res = await fetchWithAuth(`/api/sfm/work-orders/${wo.id}/log`, {
        method: "POST",
        body: JSON.stringify({
          stage: targetStage,
          valueAdded: val,
          unit: targetStage === "DOUGH_MIXING" ? "BATCH" : targetStage === "TRAY_PRINTING" || targetStage === "FREEZER_CHECKPOINT" ? "LOYANG" : "PACK",
          defectCount: 0,
        }),
      });
      if (res.ok) await loadData();
    } catch (err) {
      console.error("handleQuickLog error:", err);
    }
  }

  async function handleSubmitDetailedLog() {
    if (!activeWo) return;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/sfm/work-orders/${activeWo.id}/log`, {
        method: "POST",
        body: JSON.stringify({
          stage,
          valueAdded: parseFloat(valueAdded) || 0,
          unit: stage === "DOUGH_MIXING" ? "BATCH" : stage === "FINAL_PACKING" ? "PACK" : "LOYANG",
          defectCount: parseInt(defectCount) || 0,
          notes,
        }),
      });

      if (res.ok) {
        setActiveWo(null);
        await loadData();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/80 pb-28 px-4 pt-4 max-w-lg mx-auto space-y-4">
      {/* Native App Mobile Header */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shrink-0">
            <ChefHat size={22} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800">Tugas Dapur Produksi</h1>
            <p className="text-xs font-semibold text-slate-400">Mobile PWA Checkpoint Execution</p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 active:scale-95"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Date Filter */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
        <span className="text-xs font-extrabold text-slate-500 flex items-center gap-1.5">
          <Calendar size={14} /> Tanggal Produksi
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
        />
      </div>

      {/* Active Work Orders Cards */}
      <div className="space-y-4">
        {workOrders.map((wo) => (
          <div key={wo.id} className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-[11px] font-mono font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                {wo.woNumber}
              </span>
              <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 uppercase">
                {wo.currentStage}
              </span>
            </div>

            <div>
              <h2 className="text-base font-black text-slate-800">{wo.productName}</h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Penugasan dari Owner</p>
            </div>

            {/* Target vs Progress Bars */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs font-bold">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">1. Adonan (Batch):</span>
                <span className="text-slate-800 font-extrabold">{wo.summaryState?.totalDoughBatchesDone || 0} / {wo.targetBatches} Batch</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">2. Loyang Dicetak:</span>
                <span className="text-amber-700 font-extrabold">{wo.summaryState?.totalTrayPrinted || 0} / {wo.targetLoyang} Loyang</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">3. Masuk Freezer:</span>
                <span className="text-indigo-700 font-extrabold">{wo.summaryState?.totalTrayInFreezer || 0} Loyang</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">4. Vacuum Pack Bagus:</span>
                <span className="text-emerald-700 font-extrabold">{wo.summaryState?.totalGoodPacks || 0} / {wo.targetPacks} Pack</span>
              </div>
            </div>

            {/* Quick Touch Buttons for Crew (56px Touch Target) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleQuickLog(wo, "DOUGH_MIXING", 1.5)}
                className="h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1 shadow-sm transition-all"
              >
                +1.5 Adonan
              </button>

              <button
                type="button"
                onClick={() => handleQuickLog(wo, "TRAY_PRINTING", 5)}
                className="h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1 shadow-sm transition-all"
              >
                +5 Loyang Cetak
              </button>

              <button
                type="button"
                onClick={() => handleQuickLog(wo, "FREEZER_CHECKPOINT", 5)}
                className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1 shadow-sm transition-all"
              >
                ❄️ Freezer In
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveWo(wo);
                  setStage("FINAL_PACKING");
                  setValueAdded("10");
                }}
                className="h-12 rounded-2xl bg-slate-900 hover:bg-black active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1 shadow-sm transition-all"
              >
                📦 Input Packing
              </button>
            </div>
          </div>
        ))}

        {workOrders.length === 0 && (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 space-y-2">
            <ChefHat size={32} className="text-slate-300 mx-auto" />
            <p className="text-sm font-extrabold text-slate-700">Belum ada Work Order produksi hari ini.</p>
            <p className="text-xs font-medium text-slate-400">Owner atau Manager akan membuat Work Order penugasan.</p>
          </div>
        )}
      </div>

      {/* Detail Input Modal */}
      {activeWo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">Catat Incremental Task Kru</h3>
              <button type="button" onClick={() => setActiveWo(null)} className="text-slate-400">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Tahap Activity</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as any)}
                  className="h-11 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-extrabold text-xs text-slate-800"
                >
                  <option value="DOUGH_MIXING">1. Pembuatan Adonan (Batch)</option>
                  <option value="TRAY_PRINTING">2. Cetak Churros (Loyang)</option>
                  <option value="FREEZER_CHECKPOINT">3. Masukkan Freezer (Loyang)</option>
                  <option value="FINAL_PACKING">4. Vacuum Pack Bagus (Pack)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Jumlah Tambahan (+Value)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={valueAdded}
                    onChange={(e) => setValueAdded(e.target.value)}
                    className="h-11 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-black text-sm text-indigo-700"
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Defect / Patah (Pack)</label>
                  <input
                    type="number"
                    value={defectCount}
                    onChange={(e) => setDefectCount(e.target.value)}
                    className="h-11 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-black text-sm text-rose-600"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmitDetailedLog}
                disabled={submitting}
                className="w-full h-12 rounded-2xl bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Catatan Crew
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
