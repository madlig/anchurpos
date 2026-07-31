"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Check, ChefHat, Package, AlertTriangle, RefreshCw, Calendar, Play, ArrowRight, Plus, Snowflake, Layers } from "lucide-react";
import type { WorkOrder, SFMTaskStep } from "@/types";

const TASK_STEPS: { key: SFMTaskStep; label: string; unit: string; icon: any }[] = [
  { key: "DOUGH_COOKING", label: "1. Masak Adonan Base", unit: "Batch", icon: ChefHat },
  { key: "MIXING_EGG", label: "2. Mixer & Emulsifikasi Telur", unit: "Batch", icon: Layers },
  { key: "TRAY_MOLDING", label: "3. Cetak Churros ke Loyang", unit: "Loyang", icon: Plus },
  { key: "FREEZER_CHECKPOINT", label: "4. Pembekuan Freezer", unit: "Loyang", icon: Snowflake },
  { key: "PRE_PACK", label: "5. Pre-Pack Thinwall / Vacuum", unit: "Pcs", icon: Package },
];

export default function CrewProductionPage() {
  const { getToken } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Step Auto-Timer Tracking State
  const [stepStartTime, setStepStartTime] = useState<number | null>(null);
  const [subBatchInput, setSubBatchInput] = useState("1.5");
  const [pcsOutputInput, setPcsOutputInput] = useState("196");
  const [scrapPcsInput, setScrapPcsInput] = useState("0");
  const [scrapReasonInput, setScrapReasonInput] = useState("");
  const [submittingStep, setSubmittingStep] = useState(false);

  // Active Step Action Modal
  const [activeWoForStep, setActiveWoForStep] = useState<{ wo: WorkOrder; stepIndex: number } | null>(null);

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

  // Start Step Task (Auto-Timer)
  function handleStartStep(wo: WorkOrder, stepIndex: number) {
    setActiveWoForStep({ wo, stepIndex });
    setStepStartTime(Date.now());
  }

  // Handle Sub-Batch Iteration Log (e.g. 1.5 + 1.5 adonan)
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
        setStepStartTime(Date.now()); // Keep timer running for next sub-batch!
        await loadData();
      }
    } finally {
      setSubmittingStep(false);
    }
  }

  // Handle Auto-Chained Step Transition (Single Tap Next Step)
  async function handleNextStep(wo: WorkOrder, currentStepKey: string, nextStepKey: string) {
    setSubmittingStep(true);
    try {
      const duration = stepStartTime ? Math.max(1, Math.round((Date.now() - stepStartTime) / 60000)) : 15;
      const goodPcs = currentStepKey === "PRE_PACK" ? (parseFloat(pcsOutputInput) || 196) : 0;
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
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shrink-0">
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
        {workOrders.map((wo) => {
          const currentStageKey = wo.currentStage || "DOUGH_COOKING";
          const currentStepIdx = TASK_STEPS.findIndex(s => s.key === currentStageKey);
          const activeStep = TASK_STEPS[currentStepIdx >= 0 ? currentStepIdx : 0];

          return (
            <div key={wo.id} className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-[11px] font-mono font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                  {wo.woNumber}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  wo.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {wo.status}
                </span>
              </div>

              <div>
                <h2 className="text-base font-black text-slate-800">{wo.productName}</h2>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">Penugasan dari Manager</p>
              </div>

              {/* Progress Summary Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs font-bold">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">1. Adonan Dimasak:</span>
                  <span className="text-indigo-700 font-extrabold">{wo.summaryState?.totalDoughBatchesDone || 0} / {wo.targetBatches} Batch</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">2. Hasil Pcs Bagus:</span>
                  <span className="text-emerald-700 font-extrabold">{wo.summaryState?.totalGoodPcs || 0} Pcs ({wo.summaryState?.totalGoodPacks || 0} Pack)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">3. Cacat / Scrap:</span>
                  <span className="text-rose-600 font-extrabold">{wo.summaryState?.totalDefectPcs || 0} Pcs</span>
                </div>
              </div>

              {/* Auto-Chained Step Pipeline Action Bar */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-700">
                  <span>Tahap Saat Ini:</span>
                  <span className="text-indigo-600">{activeStep.label}</span>
                </div>

                {/* Single Tap Step Control */}
                {wo.status !== "COMPLETED" ? (
                  <button
                    type="button"
                    onClick={() => handleStartStep(wo, currentStepIdx >= 0 ? currentStepIdx : 0)}
                    className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-black active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                  >
                    <Play size={16} /> Jalankan {activeStep.label}
                  </button>
                ) : (
                  <div className="w-full py-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-xs text-center flex items-center justify-center gap-1.5">
                    <Check size={16} /> Work Order Selesai 100%
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {workOrders.length === 0 && (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 space-y-2">
            <ChefHat size={32} className="text-slate-300 mx-auto" />
            <p className="text-sm font-extrabold text-slate-700">Belum ada Work Order produksi hari ini.</p>
            <p className="text-xs font-medium text-slate-400">Owner atau Manager akan menerbitkan Work Order penugasan.</p>
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
                  {TASK_STEPS[activeWoForStep.stepIndex]?.label}
                </h3>
              </div>
              <button type="button" onClick={() => setActiveWoForStep(null)} className="text-slate-400">✕</button>
            </div>

            <div className="space-y-4 text-xs font-bold">
              {/* Sub-Batch Dough Cooking Iteration Option */}
              {TASK_STEPS[activeWoForStep.stepIndex]?.key === "DOUGH_COOKING" && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
                  <span className="text-indigo-900 font-extrabold block">Catat Sub-Batch Memasak Adonan:</span>
                  <div className="flex gap-2">
                    {["1.0", "1.5", "2.0"].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleLogSubBatch(activeWoForStep.wo, parseFloat(chip))}
                        disabled={submittingStep}
                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-2xs active:scale-95"
                      >
                        + {chip} Batch
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-indigo-600 font-medium">Memasak bertahap (1.5 + 1.5) akan menambah akumulasi waktu secara otomatis.</p>
                </div>
              )}

              {/* Pre-Pack Output Input */}
              {TASK_STEPS[activeWoForStep.stepIndex]?.key === "PRE_PACK" && (
                <div>
                  <label className="text-slate-700 font-extrabold block mb-1">Hasil Produksi Pcs Churros (Thinwall / Vacuum)</label>
                  <input
                    type="number"
                    value={pcsOutputInput}
                    onChange={(e) => setPcsOutputInput(e.target.value)}
                    className="h-11 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-black text-sm text-emerald-700 outline-none"
                  />
                  {/* Dynamic Quantity Chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {["12", "60", "120", "196"].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setPcsOutputInput(chip)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition-all ${
                          pcsOutputInput === chip ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        +{chip} Pcs ({Math.floor(Number(chip)/12)} Pack)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scrap Input */}
              <div className="pt-1 border-t border-slate-100">
                <label className="text-slate-700 font-extrabold block mb-1">Ada Patah / Cacat (Scrap Pcs)?</label>
                <input
                  type="number"
                  placeholder="0"
                  value={scrapPcsInput}
                  onChange={(e) => setScrapPcsInput(e.target.value)}
                  className="h-10 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-black text-xs text-rose-600 outline-none"
                />
              </div>

              {/* Auto-Chained Next Step Button */}
              <button
                type="button"
                onClick={() => {
                  const nextIdx = activeWoForStep.stepIndex + 1;
                  const nextKey = nextIdx < TASK_STEPS.length ? TASK_STEPS[nextIdx].key : "DONE";
                  handleNextStep(activeWoForStep.wo, TASK_STEPS[activeWoForStep.stepIndex].key, nextKey);
                }}
                disabled={submittingStep}
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95"
              >
                {submittingStep ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {activeWoForStep.stepIndex + 1 < TASK_STEPS.length ? `Selesai & Lanjut ke ${TASK_STEPS[activeWoForStep.stepIndex + 1].label}` : "Selesaikan Seluruh Work Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
