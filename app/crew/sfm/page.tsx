"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Check, ChefHat, Package, RefreshCw, Calendar, Play, ArrowRight, Plus, Snowflake, Layers, Box, X, Clock, PauseCircle } from "lucide-react";
import type { WorkOrder, SFMTaskStep } from "@/types";

const PRODUKSI_STEPS: { key: SFMTaskStep; label: string; unit: string; icon: any }[] = [
  { key: "DOUGH_COOKING", label: "1. Masak Adonan Base", unit: "Batch", icon: ChefHat },
  { key: "MIXING_EGG", label: "2. Mixer & Emulsifikasi Telur", unit: "Batch", icon: Layers },
  { key: "TRAY_MOLDING", label: "3. Cetak Churros ke Loyang", unit: "Loyang", icon: Plus },
  { key: "FREEZER_CHECKPOINT", label: "4. Pembekuan Freezer", unit: "Loyang", icon: Snowflake },
  { key: "PRE_PACK", label: "5. Pre-Pack Thinwall / Vacuum", unit: "Pcs", icon: Package },
];

function LiveTimer({ startedAt }: { startedAt?: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!startedAt) return;
    const updateTime = () => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - start) / 1000));
      const hrs = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      const secs = diffSec % 60;
      
      if (hrs > 0) {
        setElapsed(`${hrs}j ${mins}m`);
      } else {
        setElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!startedAt || !elapsed) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-black text-[11px] border border-emerald-200/80 shadow-2xs animate-pulse">
      <Clock size={12} /> {elapsed}
    </span>
  );
}

export default function CrewSFMTerminal() {
  const { getToken } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [stepStartTime, setStepStartTime] = useState<number | null>(null);
  const [pcsOutputInput, setPcsOutputInput] = useState("196");
  const [pcsVariantOutput, setPcsVariantOutput] = useState<Record<string, string>>({});
  const [loyangInput, setLoyangInput] = useState("");
  const [prepackMode, setPrepackMode] = useState<"ALL_REGULAR" | "ALL_FULL" | "MIXED">("ALL_REGULAR");
  const [regularPackInput, setRegularPackInput] = useState("16");
  const [fullPackInput, setFullPackInput] = useState("0");
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
      const res = await fetchWithAuth(`/api/sfm/work-orders`);
      if (res.ok) {
        const data: WorkOrder[] = await res.json();
        setWorkOrders(data.filter(wo => wo.status !== "COMPLETED"));
      }
    } catch (err) {
      console.error("Crew loadData error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleStartStep(wo: WorkOrder, stepIndex: number) {
    setActiveWoForStep({ wo, stepIndex });
    setStepStartTime(Date.now());
    setLoyangInput(wo.summaryState?.totalTrayPrinted?.toString() || wo.targetLoyang?.toString() || "");
    setPrepackMode("ALL_REGULAR");
    setRegularPackInput(wo.targetPacks?.toString() || "16");
    setFullPackInput("0");
    
    if (wo.productionTargets && wo.productionTargets.length > 0) {
      const initial: Record<string, string> = {};
      wo.productionTargets.forEach(pt => {
        initial[pt.variantId] = "";
      });
      setPcsVariantOutput(initial);
    } else {
      setPcsOutputInput("196");
    }
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

  async function handleNextStep(wo: WorkOrder, currentStepKey: string, nextStepKey: string, isPause = false) {
    setSubmittingStep(true);
    try {
      const duration = stepStartTime ? Math.max(1, Math.round((Date.now() - stepStartTime) / 60000)) : 15;
      
      let goodPcs = 0;
      let goodPacks = 0;
      let packSize = 12;
      let loyangCount = 0;

      if (currentStepKey === "TRAY_MOLDING" || currentStepKey === "FREEZER_CHECKPOINT") {
        loyangCount = parseFloat(loyangInput) || 0;
        if (wo.productionTargets && wo.productionTargets.length > 0) {
          goodPcs = Object.values(pcsVariantOutput).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        } else {
          goodPcs = parseFloat(pcsOutputInput) || 0;
        }
      } else if (currentStepKey === "PRE_PACK" || wo.woType !== "PRODUKSI") {
        if (prepackMode === "ALL_REGULAR") {
          const reg = parseFloat(regularPackInput) || 0;
          goodPacks = reg;
          goodPcs = reg * 12;
        } else if (prepackMode === "ALL_FULL") {
          const full = parseFloat(fullPackInput) || 0;
          goodPacks = full;
          goodPcs = full * 16;
        } else {
          const regPacks = parseFloat(regularPackInput) || 0;
          const fullPacks = parseFloat(fullPackInput) || 0;
          goodPacks = regPacks + fullPacks;
          goodPcs = (regPacks * 12) + (fullPacks * 16);
        }
      }
      
      const scrapPcs = parseFloat(scrapPcsInput) || 0;

      const res = await fetchWithAuth(`/api/sfm/work-orders/${wo.id}/step`, {
        method: "POST",
        body: JSON.stringify({
          action: isPause ? "PAUSE" : "STEP_TRANSITION",
          currentStep: currentStepKey,
          nextStep: isPause ? currentStepKey : nextStepKey,
          loyangCount,
          goodPcs,
          goodPacks,
          packSize,
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
            <p className="text-xs font-semibold text-slate-400">Eksekusi Work Order Aktif Global</p>
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
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-[11px] font-mono font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    {wo.woNumber}
                  </span>
                  <span className="text-[10px] font-black text-slate-900 uppercase">{wo.woType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <LiveTimer startedAt={wo.startedAt || wo.createdAt} />
                  <span className="text-[10px] font-bold text-slate-400">
                    {new Date(wo.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div>
                <h2 className="text-base font-black text-slate-800">{wo.productName}</h2>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">Varian: {wo.productionTargets && wo.productionTargets.length > 0 ? wo.productionTargets.map(pt => pt.variantName).join(", ") : (wo.variantNames || "Original")}</p>
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
                    {wo.summaryState?.totalGoodPcs ? (
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                        <span className="text-slate-500">Hasil Cetak Churros:</span>
                        <span className="text-emerald-600 font-black">{wo.summaryState.totalGoodPcs} Pcs</span>
                      </div>
                    ) : null}
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-extrabold text-slate-400 block">{activeWoForStep.wo.woNumber}</span>
                <h3 className="text-base font-black text-slate-800">
                  {activeWoForStep.wo.woType === "PRODUKSI" ? PRODUKSI_STEPS[activeWoForStep.stepIndex]?.label : `Selesaikan ${activeWoForStep.wo.woType}`}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {stepStartTime && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700">Durasi Aktifitas:</span>
                    <LiveTimer startedAt={new Date(stepStartTime).toISOString()} />
                  </div>
                )}
                <button type="button" onClick={() => setActiveWoForStep(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1 rounded-full"><X size={18}/></button>
              </div>
            </div>

            <div className="space-y-4 text-xs font-bold">
              {/* PRODUKSI: Sub-Batch Iteration */}
              {activeWoForStep.wo.woType === "PRODUKSI" && PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "DOUGH_COOKING" && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-700 font-extrabold text-xs block">Progress Adonan</span>
                    <span className="text-sm font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">
                      {activeWoForStep.wo.summaryState?.totalDoughBatchesDone || 0} / {activeWoForStep.wo.targetBatches || activeWoForStep.wo.targetQty || 0} Batch
                    </span>
                  </div>
                  
                  <span className="text-slate-900 font-extrabold block mt-2">Catat Sub-Batch Memasak Adonan:</span>
                  <div className="flex gap-2">
                    {["1.0", "1.5", "2.0"].map((chip) => {
                      const val = parseFloat(chip);
                      const target = activeWoForStep.wo.targetBatches || activeWoForStep.wo.targetQty || 0;
                      const current = activeWoForStep.wo.summaryState?.totalDoughBatchesDone || 0;
                      const remaining = Math.max(0, target - current);
                      const isDisabled = submittingStep || (remaining > 0 && val > remaining);

                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => handleLogSubBatch(activeWoForStep.wo, val)}
                          disabled={isDisabled}
                          className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs shadow-2xs transition-all ${isDisabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-black text-white active:scale-95'}`}
                        >
                          + {chip} Batch
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold bg-slate-100 p-2 rounded-lg border border-slate-200/60 leading-relaxed">
                    Setiap klik mencatat durasi aktivitas sebelumnya & memulai timer baru. Anda dibatasi oleh total target adonan pada Work Order ini.
                  </p>
                </div>
              )}

              {/* TRAY_MOLDING & FREEZER_CHECKPOINT Form (Input Loyang & Pcs Mentah) */}
              {activeWoForStep.wo.woType === "PRODUKSI" && (PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "TRAY_MOLDING" || PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "FREEZER_CHECKPOINT") && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="text-slate-700 font-extrabold block mb-1">Total Loyang Aktual Terbuat</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Contoh: 12"
                        value={loyangInput}
                        onChange={(e) => setLoyangInput(e.target.value)}
                        className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white font-black text-sm text-slate-800 outline-none focus:border-slate-400"
                      />
                      <span className="h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-extrabold text-slate-500 shrink-0">Loyang</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 font-extrabold block mb-1">Hasil Cetakan Churros (Pcs Mentah)</label>
                    {activeWoForStep.wo.productionTargets && activeWoForStep.wo.productionTargets.length > 0 ? (
                      <div className="space-y-2">
                        {activeWoForStep.wo.productionTargets.map(pt => (
                          <div key={pt.variantId} className="flex gap-2 items-center">
                            <span className="w-1/3 text-xs font-bold text-slate-500 truncate">{pt.variantName}</span>
                            <input
                              type="number"
                              placeholder="0"
                              value={pcsVariantOutput[pt.variantId] || ""}
                              onChange={(e) => setPcsVariantOutput(prev => ({ ...prev, [pt.variantId]: e.target.value }))}
                              className="h-10 flex-1 px-3 rounded-xl border border-slate-200 bg-white font-black text-sm text-emerald-700 outline-none focus:border-emerald-500"
                            />
                            <span className="text-xs font-black text-slate-500 w-12 text-center">Pcs</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Contoh: 196"
                          value={pcsOutputInput}
                          onChange={(e) => setPcsOutputInput(e.target.value)}
                          className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white font-black text-sm text-emerald-700 outline-none focus:border-emerald-500"
                        />
                        <span className="h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-extrabold text-slate-500 shrink-0">Pcs</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PRE_PACK Form (Mode Selection: All Regular 12, All Full 16, or Mixed) */}
              {(activeWoForStep.wo.woType !== "PRODUKSI" || PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "PRE_PACK") && (
                <>
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 space-y-3">
                    <span className="text-emerald-950 font-black text-xs block">
                      Pilih Mode Skema Pre-Pack:
                    </span>

                    {/* Mode Selector Tabs */}
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-emerald-100/70 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setPrepackMode("ALL_REGULAR");
                          setRegularPackInput(activeWoForStep.wo.targetPacks?.toString() || "16");
                          setFullPackInput("0");
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all text-center ${
                          prepackMode === "ALL_REGULAR" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-800 hover:bg-emerald-200/60"
                        }`}
                      >
                        Seluruhnya Regular (12 Pcs)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrepackMode("ALL_FULL");
                          setRegularPackInput("0");
                          setFullPackInput(Math.floor(((activeWoForStep.wo.targetPacks || 16) * 12) / 16).toString());
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all text-center ${
                          prepackMode === "ALL_FULL" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-800 hover:bg-emerald-200/60"
                        }`}
                      >
                        Seluruhnya Full (16 Pcs)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrepackMode("MIXED")}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all text-center ${
                          prepackMode === "MIXED" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-800 hover:bg-emerald-200/60"
                        }`}
                      >
                        Campuran (Mix)
                      </button>
                    </div>

                    {/* Form Input Mode 1: ALL REGULAR */}
                    {prepackMode === "ALL_REGULAR" && (
                      <div>
                        <label className="text-emerald-900 font-extrabold block mb-1">
                          Jumlah Pack Regular (Standard Isi 12 Pcs)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="16"
                            value={regularPackInput}
                            onChange={(e) => setRegularPackInput(e.target.value)}
                            className="h-10 w-full px-3 rounded-xl border border-emerald-200 bg-white font-black text-sm text-emerald-800 outline-none focus:border-emerald-500"
                          />
                          <span className="h-10 px-3 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center font-extrabold text-emerald-800 shrink-0">Pack</span>
                        </div>
                      </div>
                    )}

                    {/* Form Input Mode 2: ALL FULL */}
                    {prepackMode === "ALL_FULL" && (
                      <div>
                        <label className="text-emerald-900 font-extrabold block mb-1">
                          Jumlah Pack Full (Pesanan Isi 16 Pcs)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="12"
                            value={fullPackInput}
                            onChange={(e) => setFullPackInput(e.target.value)}
                            className="h-10 w-full px-3 rounded-xl border border-emerald-200 bg-white font-black text-sm text-emerald-800 outline-none focus:border-emerald-500"
                          />
                          <span className="h-10 px-3 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center font-extrabold text-emerald-800 shrink-0">Pack</span>
                        </div>
                      </div>
                    )}

                    {/* Form Input Mode 3: MIXED */}
                    {prepackMode === "MIXED" && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-emerald-900 font-extrabold block mb-1">
                            1. Pack Regular (Isi 12 Pcs)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="0"
                              value={regularPackInput}
                              onChange={(e) => setRegularPackInput(e.target.value)}
                              className="h-10 w-full px-3 rounded-xl border border-emerald-200 bg-white font-black text-sm text-emerald-800 outline-none focus:border-emerald-500"
                            />
                            <span className="h-10 px-3 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center font-extrabold text-emerald-800 shrink-0">Pack</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-emerald-900 font-extrabold block mb-1">
                            2. Pack Full (Isi 16 Pcs)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="0"
                              value={fullPackInput}
                              onChange={(e) => setFullPackInput(e.target.value)}
                              className="h-10 w-full px-3 rounded-xl border border-emerald-200 bg-white font-black text-sm text-emerald-800 outline-none focus:border-emerald-500"
                            />
                            <span className="h-10 px-3 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center font-extrabold text-emerald-800 shrink-0">Pack</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Total Summary */}
                    <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between text-xs font-black text-emerald-900">
                      <span>Total Hasil Packing:</span>
                      <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-lg text-[11px]">
                        {prepackMode === "ALL_REGULAR"
                          ? `${parseFloat(regularPackInput) || 0} Pack (${(parseFloat(regularPackInput) || 0) * 12} Pcs)`
                          : prepackMode === "ALL_FULL"
                          ? `${parseFloat(fullPackInput) || 0} Pack (${(parseFloat(fullPackInput) || 0) * 16} Pcs)`
                          : `${(parseFloat(regularPackInput) || 0) + (parseFloat(fullPackInput) || 0)} Pack (${((parseFloat(regularPackInput) || 0) * 12) + ((parseFloat(fullPackInput) || 0) * 16)} Pcs)`
                        }
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

                  <div className="pt-1 border-t border-slate-100">
                    <label className="text-slate-700 font-extrabold block mb-1">Catatan Crew (Opsional)</label>
                    <textarea
                      placeholder="Misal: Mesin sempat mati 10 menit..."
                      value={scrapReasonInput}
                      onChange={(e) => setScrapReasonInput(e.target.value)}
                      rows={2}
                      className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 font-medium text-xs text-slate-800 outline-none focus:border-emerald-500"
                    />
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 mt-4">
                {/* Pause Button for FREEZER_CHECKPOINT / TRAY_MOLDING */}
                {activeWoForStep.wo.woType === "PRODUKSI" && (PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "TRAY_MOLDING" || PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "FREEZER_CHECKPOINT") && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = activeWoForStep.stepIndex + 1;
                      const nextKey = nextIdx < PRODUKSI_STEPS.length ? PRODUKSI_STEPS[nextIdx].key : "DONE";
                      handleNextStep(activeWoForStep.wo, PRODUKSI_STEPS[activeWoForStep.stepIndex].key, nextKey, true);
                    }}
                    disabled={submittingStep}
                    className="w-full h-11 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                  >
                    <PauseCircle size={16} /> Simpan di Freezer (Jeda & Lanjut Nanti)
                  </button>
                )}

                {/* Next Step / Complete Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (activeWoForStep.wo.woType === "PRODUKSI") {
                      const nextIdx = activeWoForStep.stepIndex + 1;
                      const nextKey = nextIdx < PRODUKSI_STEPS.length ? PRODUKSI_STEPS[nextIdx].key : "DONE";
                      handleNextStep(activeWoForStep.wo, PRODUKSI_STEPS[activeWoForStep.stepIndex].key, nextKey, false);
                    } else {
                      handleNextStep(activeWoForStep.wo, "PROCESS", "DONE", false);
                    }
                  }}
                  disabled={submittingStep}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  {submittingStep ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {activeWoForStep.wo.woType === "PRODUKSI" && activeWoForStep.stepIndex + 1 < PRODUKSI_STEPS.length ? `Lanjut ke ${PRODUKSI_STEPS[activeWoForStep.stepIndex + 1].label}` : "Selesaikan Task & Closing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
