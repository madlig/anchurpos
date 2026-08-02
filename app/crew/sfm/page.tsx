"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Check, ChefHat, Package, RefreshCw, Calendar, Play, ArrowRight, Plus, Snowflake, Layers, Box, X, Clock, CheckCircle2, Circle } from "lucide-react";
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

  const [pcsOutputInput, setPcsOutputInput] = useState("196");
  const [pcsVariantOutput, setPcsVariantOutput] = useState<Record<string, string>>({});
  const [prepackVariantOutput, setPrepackVariantOutput] = useState<Record<string, { regular: string, full: string }>>({});
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
    setLoyangInput(wo.summaryState?.totalTrayPrinted?.toString() || wo.targetLoyang?.toString() || "");
    setPrepackMode("ALL_REGULAR");
    setRegularPackInput(wo.targetPacks?.toString() || "16");
    setFullPackInput("0");
    
    if (wo.productionTargets && wo.productionTargets.length > 0) {
      const initialPcs: Record<string, string> = {};
      const initialPrepack: Record<string, { regular: string, full: string }> = {};
      wo.productionTargets.forEach(pt => {
        initialPcs[pt.variantId] = "";
        initialPrepack[pt.variantId] = { regular: "", full: "" };
      });
      setPcsVariantOutput(initialPcs);
      setPrepackVariantOutput(initialPrepack);
    } else {
      setPcsOutputInput("196");
    }
  }

  async function handleLogSubBatch(wo: WorkOrder, val: number) {
    setSubmittingStep(true);
    try {
      const res = await fetchWithAuth(`/api/sfm/work-orders/${wo.id}/step`, {
        method: "POST",
        body: JSON.stringify({
          action: "SUB_BATCH",
          currentStep: "DOUGH_COOKING",
          subBatchVal: val,
        }),
      });

      if (res.ok) {
        await loadData();
      }
    } finally {
      setSubmittingStep(false);
    }
  }

  async function handleNextStep(wo: WorkOrder, currentStepKey: string, nextStepKey: string) {
    setSubmittingStep(true);
    try {
      let goodPcs = 0;
      let goodPacks = 0;
      let packSize = 12;
      let loyangCount = 0;

      if (currentStepKey === "TRAY_MOLDING") {
        loyangCount = parseFloat(loyangInput) || 0;
        if (wo.productionTargets && wo.productionTargets.length > 0) {
          goodPcs = Object.values(pcsVariantOutput).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        } else {
          goodPcs = parseFloat(pcsOutputInput) || 0;
        }
      } else if (currentStepKey === "PRE_PACK" || wo.woType !== "PRODUKSI") {
        if (wo.productionTargets && wo.productionTargets.length > 0) {
          Object.values(prepackVariantOutput).forEach(p => {
            const reg = parseFloat(p.regular) || 0;
            const ful = parseFloat(p.full) || 0;
            goodPacks += (reg + ful);
            goodPcs += (reg * 12) + (ful * 16);
          });
        } else {
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
      }

      const scrapPcs = parseFloat(scrapPcsInput) || 0;

      const res = await fetchWithAuth(`/api/sfm/work-orders/${wo.id}/step`, {
        method: "POST",
        body: JSON.stringify({
          action: "STEP_TRANSITION",
          currentStep: currentStepKey,
          nextStep: nextStepKey,
          loyangCount,
          goodPcs,
          goodPacks,
          packSize,
          scrapPcs,
          prepackOutputs: wo.productionTargets && wo.productionTargets.length > 0 ? prepackVariantOutput : undefined,
          notes: scrapReasonInput,
        }),
      });

      if (res.ok) {
        setActiveWoForStep(null);
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

              {/* Mini Dashboard Progress Tracker */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3 shadow-sm">
                {isProduksi ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-500">Target Produksi:</span>
                      <span className="text-slate-800 font-extrabold">{wo.targetLoyang} Loyang</span>
                    </div>
                    {/* 5-Step Progress Tracker dengan Time Tracking */}
                    <div className="space-y-1.5">
                      {PRODUKSI_STEPS.map((step, idx) => {
                        const isDone = idx < currentStepIdx;
                        const isActive = idx === currentStepIdx;
                        const Icon = step.icon;
                        const stepDuration = wo.stepDurationsMinutes?.[step.key] || 0;
                        const liveStartedAt = isActive
                          ? (step.key === "FREEZER_CHECKPOINT" && wo.freezerInAt ? wo.freezerInAt : wo.currentStepStartedAt)
                          : undefined;
                        const fmtDur = (m: number) => m >= 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m}m`;

                        return (
                          <div key={step.key} className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                            isActive ? "bg-emerald-50 border-emerald-200 shadow-sm" : isDone ? "bg-white border-slate-200" : "bg-slate-50/50 border-slate-200/60"
                          }`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                              isDone ? "bg-emerald-500 text-white" : isActive ? "bg-emerald-600 text-white animate-pulse" : "bg-slate-200 text-slate-400"
                            }`}>
                              {isDone ? <CheckCircle2 size={14} /> : isActive ? <span className="w-2 h-2 rounded-full bg-white" /> : <Circle size={12} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Icon size={12} className={isActive ? "text-emerald-700" : isDone ? "text-slate-600" : "text-slate-400"} />
                                <span className={`text-[11px] font-extrabold truncate ${isActive ? "text-emerald-800" : isDone ? "text-slate-600" : "text-slate-400"}`}>
                                  {step.label}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {isActive ? (
                                liveStartedAt ? (
                                  <LiveTimer startedAt={liveStartedAt} />
                                ) : (
                                  <span className="text-[10px] font-black text-emerald-700 animate-pulse">Dimulai</span>
                                )
                              ) : isDone ? (
                                <span className="text-[10px] font-bold text-slate-500">{fmtDur(stepDuration)}</span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-300">-</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Progress ringkas per tahap */}
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>Adonan: {wo.summaryState?.totalDoughBatchesDone || 0}/{wo.targetBatches || 0} Batch</span>
                      <span>Cetak: {wo.summaryState?.totalTrayPrinted || 0}/{wo.targetLoyang || 0} Loyang</span>
                      <span>Pack: {wo.summaryState?.totalGoodPacks || 0} Pack</span>
                    </div>
                  </div>
                ) : wo.woType === "PACKING_PESANAN" ? (
                  <div className="space-y-2 text-xs font-bold">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                      <span className="text-slate-500">Target Pesanan:</span>
                      <span className="text-slate-800 font-extrabold">{wo.targetPacks} Pack</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider block mb-2 flex items-center gap-1"><Package size={12}/> Daftar Barang Pesanan</span>
                      <div className="space-y-1.5">
                        {wo.sourceOrderDetails?.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-slate-700 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            <span className="font-extrabold">{item.qty}x {item.productName}</span>
                            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{item.variantName || "Original"}</span>
                          </div>
                        )) || <span className="text-slate-400 italic text-xs">Akan dimuat saat memproses...</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs font-bold">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Target:</span>
                      <span className="text-slate-800 font-extrabold">{wo.targetQty} {wo.targetUom}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Sudah Selesai:</span>
                      <span className="text-emerald-700 font-extrabold">{wo.summaryState?.totalGoodPcs || 0}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-extrabold text-slate-700">
                  <span>Tahap Saat Ini:</span>
                  <span className="text-slate-900">{activeStep.label}</span>
                </div>

                {isProduksi && currentStageKey === "FREEZER_CHECKPOINT" && wo.freezerInAt && (
                  <div className="flex items-center justify-center gap-2 p-2 rounded-2xl bg-sky-50 border border-sky-200">
                    <Snowflake size={14} className="text-sky-600" />
                    <span className="text-[10px] font-bold text-sky-700">Membeku di Freezer sejak:</span>
                    <LiveTimer startedAt={wo.freezerInAt} />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleStartStep(wo, currentStepIdx >= 0 ? currentStepIdx : 0)}
                  className={`w-full h-12 rounded-2xl active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
                    isProduksi && currentStageKey === "FREEZER_CHECKPOINT" ? "bg-sky-600 hover:bg-sky-700" : "bg-slate-900 hover:bg-black"
                  }`}
                >
                  <Play size={16} />
                  {isProduksi && currentStageKey === "FREEZER_CHECKPOINT" ? "Lanjut Pre-Pack (Sudah Beku)" : `Jalankan ${activeStep.label}`}
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
                {activeWoForStep.wo.currentStepStartedAt && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700">Durasi Step:</span>
                    <LiveTimer startedAt={activeWoForStep.wo.currentStepStartedAt} />
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

              {/* MIXING_EGG Info Card (tidak ada input numerik, BOM telur auto-deduct) */}
              {activeWoForStep.wo.woType === "PRODUKSI" && PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "MIXING_EGG" && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 shadow-sm">
                  <span className="text-amber-950 font-black text-xs block flex items-center gap-1.5">
                    <Layers size={14} /> Mixer & Emulsifikasi Telur
                  </span>
                  <p className="text-[11px] text-amber-900 font-bold leading-relaxed">
                    Adonan sudah didiamkan di baskom stainless steel. Pindahkan ke mixer, tambahkan telur sesuai resep BOM (sudah auto-deduct dari stok), lalu kocok hingga adonan tercampur rata dan lembut.
                  </p>
                  <p className="text-[10px] text-amber-700 font-bold bg-amber-100 p-2 rounded-lg border border-amber-200/60 leading-relaxed">
                    Tidak perlu input jumlah. Setelah adonan siap, klik tombol di bawah untuk lanjut ke cetak loyang.
                  </p>
                </div>
              )}

              {/* TRAY_MOLDING Form (Input Loyang & Pcs Mentah - input final) */}
              {activeWoForStep.wo.woType === "PRODUKSI" && PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "TRAY_MOLDING" && (
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

              {/* FREEZER_CHECKPOINT Info Card (jeda pembekuan, timer dari freezerInAt) */}
              {activeWoForStep.wo.woType === "PRODUKSI" && PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "FREEZER_CHECKPOINT" && (
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-2 shadow-sm">
                  <span className="text-sky-950 font-black text-xs block flex items-center gap-1.5">
                    <Snowflake size={14} /> Pembekuan di Freezer
                  </span>
                  <p className="text-[11px] text-sky-900 font-bold leading-relaxed">
                    Loyang sudah masuk freezer pembekuan. Tunggu hingga churros benar-benar beku sebelum dipindahkan ke pre-pack.
                  </p>
                  {activeWoForStep.wo.freezerInAt && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-white rounded-xl border border-sky-200">
                      <span className="text-[10px] font-bold text-sky-700">Waktu membeku:</span>
                      <LiveTimer startedAt={activeWoForStep.wo.freezerInAt} />
                    </div>
                  )}
                  <p className="text-[10px] text-sky-700 font-bold bg-sky-100 p-2 rounded-lg border border-sky-200/60 leading-relaxed">
                    Anda bisa tutup halaman ini dan kembali nanti. Timer tetap berjalan. Klik tombol di bawah saat churros sudah beku.
                  </p>
                </div>
              )}

              {/* PRE_PACK Form (Multi-Variant vs Single) */}
              {(activeWoForStep.wo.woType !== "PRODUKSI" || PRODUKSI_STEPS[activeWoForStep.stepIndex]?.key === "PRE_PACK") && (
                <>
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 space-y-3">
                    <span className="text-emerald-950 font-black text-xs block">
                      Hasil Pre-Pack & Vacuum:
                    </span>

                    {activeWoForStep.wo.productionTargets && activeWoForStep.wo.productionTargets.length > 0 ? (
                      <div className="space-y-4">
                        {activeWoForStep.wo.productionTargets.map(pt => (
                          <div key={pt.variantId} className="p-2.5 bg-white border border-emerald-100 rounded-xl space-y-2">
                            <span className="font-extrabold text-slate-800 text-xs block">{pt.variantName}</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Reguler (12 Pcs)</label>
                                <div className="flex gap-1">
                                  <input type="number" placeholder="0" 
                                    value={prepackVariantOutput[pt.variantId]?.regular || ""} 
                                    onChange={(e) => setPrepackVariantOutput(prev => ({...prev, [pt.variantId]: {...prev[pt.variantId], regular: e.target.value}}))}
                                    className="h-8 w-full px-2 rounded-lg border border-slate-200 text-xs font-bold text-emerald-800 outline-none focus:border-emerald-500" />
                                  <span className="h-8 px-2 rounded-lg bg-slate-100 border border-slate-200 text-[10px] flex items-center text-slate-500">Pack</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 mb-1 block">Full (16 Pcs)</label>
                                <div className="flex gap-1">
                                  <input type="number" placeholder="0" 
                                    value={prepackVariantOutput[pt.variantId]?.full || ""} 
                                    onChange={(e) => setPrepackVariantOutput(prev => ({...prev, [pt.variantId]: {...prev[pt.variantId], full: e.target.value}}))}
                                    className="h-8 w-full px-2 rounded-lg border border-slate-200 text-xs font-bold text-emerald-800 outline-none focus:border-emerald-500" />
                                  <span className="h-8 px-2 rounded-lg bg-slate-100 border border-slate-200 text-[10px] flex items-center text-slate-500">Pack</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {/* Mode Selector Tabs for Single Variant */}
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
                      </>
                    )}
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
                {/* Next Step / Complete Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (activeWoForStep.wo.woType === "PRODUKSI") {
                      const curKey = PRODUKSI_STEPS[activeWoForStep.stepIndex].key;
                      const nextIdx = activeWoForStep.stepIndex + 1;
                      const nextKey = nextIdx < PRODUKSI_STEPS.length ? PRODUKSI_STEPS[nextIdx].key : "DONE";
                      handleNextStep(activeWoForStep.wo, curKey, nextKey);
                    } else {
                      handleNextStep(activeWoForStep.wo, "PROCESS", "DONE");
                    }
                  }}
                  disabled={submittingStep}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  {submittingStep ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {activeWoForStep.wo.woType === "PRODUKSI"
                    ? (PRODUKSI_STEPS[activeWoForStep.stepIndex].key === "FREEZER_CHECKPOINT" ? "Sudah Beku, Lanjut Pre-Pack" :
                       PRODUKSI_STEPS[activeWoForStep.stepIndex].key === "TRAY_MOLDING" ? "Selesai Cetak & Masukkan ke Freezer" :
                       activeWoForStep.stepIndex + 1 < PRODUKSI_STEPS.length ? `Lanjut ke ${PRODUKSI_STEPS[activeWoForStep.stepIndex + 1].label}` : "Selesai Pre-Pack & Closing")
                    : "Selesaikan Task & Closing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
