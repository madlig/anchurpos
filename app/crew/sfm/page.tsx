"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Check, ChefHat, Package, RefreshCw, Calendar, Play, ArrowRight, Plus, Snowflake, Layers, Box, X } from "lucide-react";
import type { WorkOrder, SFMTaskStep } from "@/types";

const PRODUKSI_STEPS: { key: SFMTaskStep; label: string; unit: string; icon: any }[] = [
  { key: "DOUGH_COOKING", label: "1. Masak Adonan Base", unit: "Batch", icon: ChefHat },
  { key: "MIXING_EGG", label: "2. Mixer & Emulsifikasi Telur", unit: "Batch", icon: Layers },
  { key: "TRAY_MOLDING", label: "3. Cetak Churros ke Loyang", unit: "Loyang", icon: Plus },
  { key: "FREEZER_CHECKPOINT", label: "4. Pembekuan Freezer", unit: "Loyang", icon: Snowflake },
  { key: "PRE_PACK", label: "5. Pre-Pack Thinwall / Vacuum", unit: "Pcs", icon: Package },
];

export default function CrewSFMTerminal() {
  const { getToken } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const [stepStartTime, setStepStartTime] = useState<number | null>(null);
  const [pcsOutputInput, setPcsOutputInput] = useState("196");
  const [scrapPcsInput, setScrapPcsInput] = useState("0");
  const [scrapReasonInput, setScrapReasonInput] = useState("");
  const [submittingStep, setSubmittingStep] = useState(false);

  const [activeWoForStep, setActiveWoForStep] = useState<{ wo: WorkOrder; stepIndex: number } | null>(null);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    });
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/sfm/work-orders?date=${date}`);
      if (res.ok) {
        const data: WorkOrder[] = await res.json();
        setWorkOrders(data.filter(wo => wo.status !== "COMPLETED"));
      }
    } catch (err) {
      console.error("Crew loadData error:", err);
    } finally {
      setLoading(false);
    }
  }, [date, fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleStartStep(wo: WorkOrder, stepIndex: number) {
    setActiveWoForStep({ wo, stepIndex });
    setStepStartTime(Date.now());
  }

  async function handleLogSubBatch(wo: WorkOrder, val: number) {
    setSubmittingStep(true);
    try {
      const duration = stepStartTime ? Math.max(1, Math.round((Date.now() - stepStartTime) / 60000)) : 10;
      const res = await fetchWithAuth(`/api/sfm/work-orders/${wo.id}/step`, {
        method: "POST",
        body: JSON.stringify({
          action: "SUB_BATCH",
          currentStep: "DOUGH_COOKING",
          subBatchVal: val,
          durationMinutes: duration,
        }),
      });

      if (res.ok) {
        setStepStartTime(Date.now());
        await loadData();
      }
    } finally {
      setSubmittingStep(false);
    }
  }

  async function handleNextStep(wo: WorkOrder, currentStepKey: string, nextStepKey: string) {
    setSubmittingStep(true);
    try {
      const duration = stepStartTime ? Math.max(1, Math.round((Date.now() - stepStartTime) / 60000)) : 15;
      const goodPcs = (currentStepKey === "PRE_PACK" || wo.woType !== "PRODUKSI") ? (parseFloat(pcsOutputInput) || 0) : 0;
      const scrapPcs = parseFloat(scrapPcsInput) || 0;

      const res = await fetchWithAuth(`/api/sfm/work-orders/${wo.id}/step`, {
        method: "POST",
        body: JSON.stringify({
          action: "STEP_TRANSITION",
          currentStep: currentStepKey,
          nextStep: nextStepKey,
          goodPcs,
          scrapPcs,
          durationMinutes: duration,
          notes: scrapReasonInput,
        }),
      });

      if (res.ok) {
        setActiveWoForStep(null);
        setStepStartTime(Date.now());
        setScrapPcsInput("0");
        setScrapReasonInput("");
        await loadData();
      }
    } finally {
      setSubmittingStep(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/80 pb-28 px-4 pt-4 max-w-lg mx-auto space-y-4">
      {/* Native App Mobile Header */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
            <ChefHat size={22} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800">Shop Floor Crew Terminal</h1>
            <p className="text-xs font-semibold text-slate-400">Eksekusi Task PWA Auto-Chained Timer</p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 flex items-center justify-center text-slate-700 active:scale-95 transition-all"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
        <span className="text-xs font-extrabold text-slate-500 flex items-center gap-1.5">
          <Calendar size={14} /> Tanggal
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
        {workOrders.map((wo) => {
          const isProduksi = wo.woType === "PRODUKSI";
          const currentStageKey = wo.currentStage || "DOUGH_COOKING";
          const currentStepIdx = isProduksi ? PRODUKSI_STEPS.findIndex(s => s.key === currentStageKey) : 0;
          const activeStep = isProduksi ? PRODUKSI_STEPS[currentStepIdx >= 0 ? currentStepIdx : 0] : { key: "PROCESS", label: `Selesaikan ${wo.woType}`, unit: wo.targetUom || "Pcs" };

          return (
            <div key={wo.id} className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex gap-2 items-center">
                  <span className="text-[11px] font-mono font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    {wo.woNumber}
                  </span>
                  <span className="text-[10px] font-black text-slate-900 uppercase">{wo.woType}</span>
                </div>
              </div>

              <div>
                <h2 className="text-base font-black text-slate-800">{wo.productName}</h2>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">Varian: {wo.variantNames || "N/A"}</p>
              </div>

              {/* Progress Summary Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs font-bold">
                {isProduksi ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Target Loyang:</span>
                      <span className="text-slate-800 font-extrabold">{wo.targetLoyang} Loyang</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Progress Cetak:</span>
                      <span className="text-slate-900 font-extrabold">{wo.summaryState?.totalTrayPrinted || 0} Loyang</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Target:</span>
                      <span className="text-slate-800 font-extrabold">{wo.woType === "PACKING_PESANAN" ? wo.targetPacks : wo.targetQty} {wo.targetUom || (wo.woType === "PACKING_PESANAN" ? "Pack" : "Qty")}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Sudah Selesai:</span>
                      <span className="text-emerald-700 font-extrabold">{wo.summaryState?.totalGoodPcs || wo.summaryState?.totalGoodPacks || 0}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Action Bar */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-700">
                  <span>Tahap Saat Ini:</span>
                  <span className="text-slate-900">{activeStep.label}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartStep(wo, currentStepIdx >= 0 ? currentStepIdx : 0)}
                  className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-black active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <Play size={16} /> Jalankan {activeStep.label}
                </button>
              </div>
            </div>
          );
        })}

        {workOrders.length === 0 && (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 space-y-2">
            <Package size={32} className="text-slate-300 mx-auto" />
            <p className="text-sm font-extrabold text-slate-700">Tidak ada penugasan aktif.</p>
            <p className="text-xs font-medium text-slate-400">Silakan cek kembali nanti atau minta Manager menerbitkan Work Order.</p>
          </div>
        )}
      </div>

      {/* Step Action Drawer Modal */}
      {activeWoForStep && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-extrabold text-slate-400 block">{activeWoForStep.wo.woNumber}</span>
                <h3 className="text-base font-black text-slate-800">
                  {activeWoForStep.wo.woType === "PRODUKSI" ? PRODUKSI_STEPS[activeWoForStep.stepIndex]?.label : `Selesaikan ${activeWoForStep.wo.woType}`}
                </h3>
              </div>
              <button type="button" onClick={() => setActiveWoForStep(null)} className="text-slate-400"><X size={20}/></button>
            </div>

            <div className="space-y-4 text-xs font-bold">
              {/* PRODUKSI: Sub-Batch Iteration */}
              {activeWoForStep.wo.woType === "PRODUKSI" && PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "DOUGH_COOKING" && (
                <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 space-y-2">
                  <span className="text-slate-900 font-extrabold block">Catat Sub-Batch Memasak Adonan:</span>
                  <div className="flex gap-2">
                    {["1.0", "1.5", "2.0"].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleLogSubBatch(activeWoForStep.wo, parseFloat(chip))}
                        disabled={submittingStep}
                        className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs shadow-2xs active:scale-95 transition-all"
                      >
                        + {chip} Batch
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-600 font-medium">Memasak bertahap (1.5 + 1.5) akan menambah akumulasi waktu secara otomatis tanpa pindah tahap.</p>
                </div>
              )}

              {/* Output & Scrap Log (For non-produksi or final step of produksi) */}
              {(activeWoForStep.wo.woType !== "PRODUKSI" || PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "PRE_PACK") && (
                <>
                  <div>
                    <label className="text-slate-700 font-extrabold block mb-1">Total Hasil Selesai (Good Output)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={pcsOutputInput}
                        onChange={(e) => setPcsOutputInput(e.target.value)}
                        className="h-11 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-black text-sm text-emerald-700 outline-none focus:border-emerald-500"
                      />
                      <span className="h-11 px-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-500">
                        {activeWoForStep.wo.woType === "PRODUKSI" ? "Pcs" : activeWoForStep.wo.targetUom || "Pack"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <label className="text-slate-700 font-extrabold block mb-1">Ada Cacat / Reject (Scrap)?</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={scrapPcsInput}
                      onChange={(e) => setScrapPcsInput(e.target.value)}
                      className="h-10 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-black text-xs text-rose-600 outline-none"
                    />
                  </div>
                </>
              )}

              {/* Submit / Next Step */}
              <button
                type="button"
                onClick={() => {
                  if (activeWoForStep.wo.woType === "PRODUKSI") {
                    const nextIdx = activeWoForStep.stepIndex + 1;
                    const nextKey = nextIdx < PRODUKSI_STEPS.length ? PRODUKSI_STEPS[nextIdx].key : "DONE";
                    handleNextStep(activeWoForStep.wo, PRODUKSI_STEPS[activeWoForStep.stepIndex].key, nextKey);
                  } else {
                    handleNextStep(activeWoForStep.wo, "PROCESS", "DONE");
                  }
                }}
                disabled={submittingStep}
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all mt-4"
              >
                {submittingStep ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {activeWoForStep.wo.woType === "PRODUKSI" && activeWoForStep.stepIndex + 1 < PRODUKSI_STEPS.length ? `Lanjut ke ${PRODUKSI_STEPS[activeWoForStep.stepIndex + 1].label}` : "Selesaikan Tugas"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
