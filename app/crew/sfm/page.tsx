"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Check, ChefHat, Package, RefreshCw, Snowflake, Layers, X, Clock, Play, Plus, Box, PenLine, AlertTriangle, Pause, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { WorkOrder } from "@/types";

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
  const [submitting, setSubmitting] = useState(false);

  // Modals state
  const [pauseModalWo, setPauseModalWo] = useState<WorkOrder | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const [inputModal, setInputModal] = useState<{
    wo: WorkOrder;
    variantId: string;
    variantName: string;
    action: "CUT_TRAY" | "TRAY_MOLDING" | "PARTIAL_PREPACK";
  } | null>(null);

  const [inputValue1, setInputValue1] = useState(""); // loyangCount (cut/cetak) or regularPacks (prepack)
  const [inputValue2, setInputValue2] = useState(""); // goodPcs (cut) or fullPacks (prepack)
  const [inputValue3, setInputValue3] = useState(""); // loyangUsed (prepack)

  const [closeModalWo, setCloseModalWo] = useState<WorkOrder | null>(null);

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
    const fetchInterval = setInterval(() => {
      if (document.visibilityState === "visible") loadData();
    }, 30000);
    const handleFCM = () => loadData();
    window.addEventListener("fcm_message", handleFCM);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(fetchInterval);
      window.removeEventListener("fcm_message", handleFCM);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadData]);

  async function handleAction(woId: string, payload: any) {
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/sfm/work-orders/${woId}/step`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await loadData();
        return true;
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Terjadi kesalahan.");
        return false;
      }
    } catch (err) {
      alert("Network error.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPause() {
    if (!pauseModalWo) return;
    const reason = pauseReason === "Lainnya" ? customReason : pauseReason;
    if (!reason) return alert("Pilih alasan jeda");
    const ok = await handleAction(pauseModalWo.id, { action: "PAUSE", currentStep: pauseModalWo.currentStage || "DOUGH_COOKING", pausedReason: reason });
    if (ok) setPauseModalWo(null);
  }

  async function submitResume(wo: WorkOrder) {
    await handleAction(wo.id, { action: "RESUME", currentStep: wo.currentStage || "DOUGH_COOKING" });
  }

  async function submitInput() {
    if (!inputModal) return;
    const { wo, variantId, action } = inputModal;
    
    let payload: any = { action, currentStep: "PROCESS", variantId };
    
    if (action === "TRAY_MOLDING") {
      payload.loyangCount = parseFloat(inputValue1) || 0;
      if (payload.loyangCount <= 0) return alert("Jumlah loyang harus > 0");
    } else if (action === "CUT_TRAY") {
      payload.loyangCount = parseFloat(inputValue1) || 0;
      payload.goodPcs = parseFloat(inputValue2) || 0;
      if (payload.loyangCount <= 0 || payload.goodPcs <= 0) return alert("Jumlah loyang & pcs potong harus > 0");
    } else if (action === "PARTIAL_PREPACK") {
      const regPacks = parseFloat(inputValue1) || 0;
      const fullPacks = parseFloat(inputValue2) || 0;
      const lUsed = parseFloat(inputValue3) || 0;
      
      if (regPacks === 0 && fullPacks === 0) return alert("Minimal 1 pack dihasilkan");
      if (lUsed <= 0) return alert("Jumlah loyang yang diambil dari freezer harus > 0");
      
      payload.prepackOutputs = {
        [variantId]: { regular: regPacks.toString(), full: fullPacks.toString() }
      };
      payload.loyangCount = lUsed;
      payload.goodPacks = regPacks + fullPacks;
    }

    const ok = await handleAction(wo.id, payload);
    if (ok) {
      setInputModal(null);
      setInputValue1(""); setInputValue2(""); setInputValue3("");
    }
  }

  async function submitCloseWO() {
    if (!closeModalWo) return;
    const ok = await handleAction(closeModalWo.id, { action: "CLOSE_WO", currentStep: "PRE_PACK" });
    if (ok) setCloseModalWo(null);
  }

  return (
    <div className="min-h-screen bg-slate-50/80 pb-28 px-4 pt-4 max-w-xl mx-auto space-y-4">
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
            <ChefHat size={22} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800">Crew SFM Terminal</h1>
            <p className="text-xs font-semibold text-slate-400">Paralel Lane Mode</p>
          </div>
        </div>
        <button onClick={loadData} className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 flex items-center justify-center text-slate-700 active:scale-95 transition-all">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && workOrders.length === 0 ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {workOrders.map((wo) => {
            const isPaused = !!wo.pausedAt;
            const isProduksi = wo.woType === "PRODUKSI";
            
            // Resolve variants for parallel lane
            const lanes = [];
            if (isProduksi) {
              if (wo.productionTargets && wo.productionTargets.length > 0) {
                wo.productionTargets.forEach(t => {
                  lanes.push({
                    variantId: t.variantId,
                    variantName: t.variantName,
                    targetBatches: Number(t.targetBatches) || 0,
                    targetLoyang: Number(t.targetLoyang) || (Number(t.targetBatches) || 0) * 4,
                    state: wo.variantState?.[t.variantId] || { doughBatchesDone: 0, mixingBatchesDone: 0, loyangPrinted: 0, loyangCut: 0, frozenTrays: 0, goodPacks: 0, goodPcs: 0, defectPcs: 0 }
                  });
                });
              } else if (wo.variantIds && wo.variantIds.length > 0) {
                wo.variantIds.forEach((vId, idx) => {
                  lanes.push({
                    variantId: vId,
                    variantName: wo.variantNames?.split(",")[idx]?.trim() || "Varian",
                    targetBatches: Number(wo.targetBatches) || 0,
                    targetLoyang: Number(wo.targetLoyang) || (Number(wo.targetBatches) || 0) * 4,
                    state: wo.variantState?.[vId] || { doughBatchesDone: 0, mixingBatchesDone: 0, loyangPrinted: 0, loyangCut: 0, frozenTrays: 0, goodPacks: 0, goodPcs: 0, defectPcs: 0 }
                  });
                });
              } else {
                lanes.push({
                  variantId: wo.productId,
                  variantName: "Original",
                  targetBatches: Number(wo.targetBatches) || 0,
                  targetLoyang: Number(wo.targetLoyang) || (Number(wo.targetBatches) || 0) * 4,
                  state: wo.variantState?.[wo.productId] || { doughBatchesDone: wo.summaryState?.totalDoughBatchesDone || 0, mixingBatchesDone: 0, loyangPrinted: wo.summaryState?.totalTrayPrinted || 0, loyangCut: 0, frozenTrays: wo.summaryState?.totalTrayInFreezer || 0, goodPacks: wo.summaryState?.totalGoodPacks || 0, goodPcs: wo.summaryState?.totalGoodPcs || 0, defectPcs: wo.summaryState?.totalDefectPcs || 0 }
                });
              }
            }

            const canCloseWO = isProduksi && lanes.every(l => l.state.frozenTrays === 0) && lanes.some(l => l.state.goodPacks > 0);

            return (
              <div key={wo.id} className={`bg-white rounded-3xl p-5 border shadow-sm space-y-4 relative overflow-hidden ${isPaused ? 'border-amber-400 shadow-amber-100' : 'border-slate-200/90'}`}>
                {/* Paused Overlay Area */}
                {isPaused && (
                  <div className="absolute inset-0 bg-amber-500/10 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center pointer-events-none p-4">
                    <div className="bg-white/95 p-5 rounded-2xl shadow-xl border border-amber-200 text-center pointer-events-auto max-w-xs w-full">
                      <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Pause size={24} className="fill-amber-600" />
                      </div>
                      <h3 className="text-lg font-black text-amber-900 mb-1">DIJEDA</h3>
                      <p className="text-xs font-bold text-amber-700 mb-4">{wo.pausedReason}</p>
                      <LiveTimer startedAt={wo.pausedAt} />
                      <div className="mt-5">
                        <button onClick={() => submitResume(wo)} disabled={submitting} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm active:scale-95 transition-all">
                          {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Lanjutkan Pekerjaan"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-[11px] font-mono font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {wo.woNumber}
                    </span>
                    <span className="text-[10px] font-black text-emerald-800 uppercase bg-emerald-50 px-2 rounded">{wo.woType}</span>
                  </div>
                  {!isPaused && (
                    <button onClick={() => setPauseModalWo(wo)} className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1 active:scale-95">
                      <Pause size={12} className="fill-amber-700" /> JEDA
                    </button>
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-800">{wo.productName}</h2>
                </div>

                {/* Parallel Lanes */}
                {isProduksi ? (
                  <div className="space-y-4">
                    {lanes.map((lane, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                          <span className="text-sm font-black text-slate-700">Lane: {lane.variantName}</span>
                        </div>

                        {/* Dough & Mixing Parallel */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black text-slate-500 flex items-center gap-1"><ChefHat size={12}/> Masak</span>
                              <span className="text-[10px] font-bold text-slate-600">{lane.state.doughBatchesDone}/{lane.targetBatches}B</span>
                            </div>
                            <div className="flex gap-1">
                              {[1, 1.5].map(v => (
                                <button key={v} onClick={() => handleAction(wo.id, { action: "SUB_BATCH", subBatchVal: v, variantId: lane.variantId })} className="flex-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold py-1.5 rounded-lg active:scale-95 border border-emerald-200">+{v}</button>
                              ))}
                            </div>
                            {lane.state.doughStationStartedAt && <div className="mt-1.5 text-center"><LiveTimer startedAt={typeof lane.state.doughStationStartedAt === "string" ? lane.state.doughStationStartedAt : (lane.state.doughStationStartedAt as any).toDate?.().toISOString() || undefined} /></div>}
                          </div>

                          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black text-slate-500 flex items-center gap-1"><Layers size={12}/> Mixer</span>
                              <span className="text-[10px] font-bold text-slate-600">{lane.state.mixingBatchesDone}/{lane.targetBatches}B</span>
                            </div>
                            <div className="flex gap-1">
                              {[1, 1.5].map(v => (
                                <button key={v} onClick={() => handleAction(wo.id, { action: "MIXING_SUB_BATCH", subBatchVal: v, variantId: lane.variantId })} className="flex-1 bg-purple-100 text-purple-800 text-[10px] font-extrabold py-1.5 rounded-lg active:scale-95 border border-purple-200">+{v}</button>
                              ))}
                            </div>
                            {lane.state.mixingStationStartedAt && <div className="mt-1.5 text-center"><LiveTimer startedAt={typeof lane.state.mixingStationStartedAt === "string" ? lane.state.mixingStationStartedAt : (lane.state.mixingStationStartedAt as any).toDate?.().toISOString() || undefined} /></div>}
                          </div>
                        </div>

                        {/* Molding & Cut */}
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => { setInputValue1(""); setInputModal({ wo, variantId: lane.variantId, variantName: lane.variantName, action: "TRAY_MOLDING" })}} className="bg-white p-2 rounded-xl border border-blue-200 shadow-2xs flex flex-col items-center justify-center gap-1 active:scale-95 group hover:border-blue-400">
                            <span className="text-[10px] font-black text-blue-700 flex items-center gap-1"><Plus size={12}/> Cetak (Utuh)</span>
                            <span className="text-[10px] font-bold text-slate-500">{lane.state.loyangPrinted} Loyang</span>
                          </button>
                          
                          <button onClick={() => { setInputValue1(""); setInputValue2(""); setInputModal({ wo, variantId: lane.variantId, variantName: lane.variantName, action: "CUT_TRAY" })}} className="bg-white p-2 rounded-xl border border-rose-200 shadow-2xs flex flex-col items-center justify-center gap-1 active:scale-95 group hover:border-rose-400">
                            <span className="text-[10px] font-black text-rose-700 flex items-center gap-1"><PenLine size={12}/> Potong</span>
                            <span className="text-[10px] font-bold text-slate-500">{lane.state.loyangCut} L / {lane.state.goodPcs} Pcs</span>
                          </button>
                        </div>

                        {/* Freezer & Pack */}
                        <div className="grid grid-cols-[1fr,2fr] gap-2">
                          <div className="bg-sky-50 p-2 rounded-xl border border-sky-200 flex flex-col justify-center items-center">
                            <Snowflake size={16} className="text-sky-600 mb-1" />
                            <span className="text-[10px] font-black text-sky-800 text-center leading-tight">{lane.state.frozenTrays} Loyang<br/>Beku</span>
                          </div>
                          
                          <button onClick={() => { setInputValue1(""); setInputValue2(""); setInputValue3(""); setInputModal({ wo, variantId: lane.variantId, variantName: lane.variantName, action: "PARTIAL_PREPACK" })}} className="bg-emerald-600 text-white p-2 rounded-xl border border-emerald-700 shadow-md flex flex-col justify-center items-center active:scale-95">
                            <Package size={16} className="mb-1" />
                            <span className="text-[11px] font-black">Pre-Pack (Cicil)</span>
                            <span className="text-[10px] font-medium opacity-90">{lane.state.goodPacks} Pack selesai</span>
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Close WO Button */}
                    {canCloseWO ? (
                      <button onClick={() => setCloseModalWo(wo)} className="w-full py-4 rounded-2xl bg-black text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 hover:bg-slate-800 mt-4 border border-slate-700">
                        <CheckCircle2 size={18} /> TUTUP WORK ORDER
                      </button>
                    ) : (
                      <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-center mt-2">
                        <p className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1"><AlertTriangle size={12}/> Tombol Tutup WO akan muncul jika freezer kosong.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  // Non-Produksi fallback
                  <div className="space-y-3">
                     <p className="text-sm font-bold text-slate-600">Bukan WO Produksi.</p>
                     <button onClick={() => handleAction(wo.id, { action: "CLOSE_WO", currentStep: "PROCESS" })} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm">Selesaikan</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Input Modals */}
      {pauseModalWo && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-black text-amber-900 mb-4 flex items-center gap-2"><Pause size={20}/> Jeda WO {pauseModalWo.woNumber}</h3>
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block mb-2">Pilih Alasan Jeda:</label>
              {["Istirahat / WC", "Gangguan Mesin", "Bahan Habis", "Lainnya"].map(r => (
                <button key={r} onClick={() => setPauseReason(r)} className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold text-left border ${pauseReason === r ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{r}</button>
              ))}
              {pauseReason === "Lainnya" && (
                <input type="text" placeholder="Tulis alasan..." value={customReason} onChange={(e) => setCustomReason(e.target.value)} className="w-full mt-2 h-10 px-3 rounded-xl border border-amber-300 bg-white font-bold text-sm text-slate-800 outline-none focus:border-amber-500" />
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setPauseModalWo(null)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold active:scale-95">Batal</button>
              <button onClick={submitPause} disabled={submitting} className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-black active:scale-95 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : "JEDA WO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {inputModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-base font-black text-slate-800">
                {inputModal.action === "TRAY_MOLDING" ? "Cetak Utuh" : inputModal.action === "CUT_TRAY" ? "Potong Churros" : "Pre-Pack Cicilan"}
              </h3>
              <button onClick={() => setInputModal(null)} className="p-1 rounded-full bg-slate-100 text-slate-400"><X size={16}/></button>
            </div>
            <p className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg inline-block mb-2">Lane: {inputModal.variantName}</p>

            {inputModal.action === "TRAY_MOLDING" && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Jumlah Loyang Dicetak</label>
                <input type="number" placeholder="Contoh: 5" value={inputValue1} onChange={(e) => setInputValue1(e.target.value)} className="h-12 w-full px-4 rounded-xl border border-slate-200 bg-slate-50 font-black text-lg text-slate-800 outline-none focus:border-blue-400" />
              </div>
            )}

            {inputModal.action === "CUT_TRAY" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Loyang yang Dipotong</label>
                  <input type="number" placeholder="Loyang" value={inputValue1} onChange={(e) => setInputValue1(e.target.value)} className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-black text-sm outline-none focus:border-rose-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Total Pcs Dihasilkan</label>
                  <input type="number" placeholder="Pcs Mentah" value={inputValue2} onChange={(e) => setInputValue2(e.target.value)} className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-black text-sm outline-none focus:border-rose-400" />
                </div>
              </div>
            )}

            {inputModal.action === "PARTIAL_PREPACK" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Loyang diambil dari Freezer</label>
                  <input type="number" placeholder="Berapa loyang beku?" value={inputValue3} onChange={(e) => setInputValue3(e.target.value)} className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-black text-sm outline-none focus:border-emerald-400" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Pack Reguler (12Pcs)</label>
                    <input type="number" placeholder="0" value={inputValue1} onChange={(e) => setInputValue1(e.target.value)} className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-black text-sm outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Pack Full (16Pcs)</label>
                    <input type="number" placeholder="0" value={inputValue2} onChange={(e) => setInputValue2(e.target.value)} className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-black text-sm outline-none focus:border-emerald-400" />
                  </div>
                </div>
              </div>
            )}

            <button onClick={submitInput} disabled={submitting} className="w-full py-3 mt-4 rounded-xl bg-black text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 shadow-lg">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : "SIMPAN"}
            </button>
          </div>
        </div>
      )}

      {closeModalWo && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800">Tutup Work Order?</h3>
            <p className="text-xs font-bold text-slate-500">
              Pastikan semua loyang dari freezer sudah selesai di pre-pack. Setelah ditutup, WO tidak bisa dikerjakan lagi.
            </p>
            <div className="flex gap-2 pt-4">
              <button onClick={() => setCloseModalWo(null)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold active:scale-95">Batal</button>
              <button onClick={submitCloseWO} disabled={submitting} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black active:scale-95 flex items-center justify-center">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : "TUTUP WO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
