"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Check, ChefHat, Package, AlertTriangle, RefreshCw, CheckCircle2, Calendar } from "lucide-react";
import type { WorkOrder } from "@/types";

export default function CrewProductionPage() {
  const { getToken } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Output Logging Modal
  const [activeWoForLog, setActiveWoForLog] = useState<{ wo: WorkOrder; action: "GOOD_OUTPUT" | "SCRAP" } | null>(null);
  const [logQty, setLogQty] = useState("10");
  const [scrapReason, setScrapReason] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);

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

  async function handleSubmitLog() {
    if (!activeWoForLog) return;
    setSubmittingLog(true);
    try {
      const res = await fetchWithAuth(`/api/sfm/work-orders/${activeWoForLog.wo.id}/log`, {
        method: "POST",
        body: JSON.stringify({
          action: activeWoForLog.action,
          valueAdded: parseFloat(logQty) || 0,
          defectCount: activeWoForLog.action === "SCRAP" ? (parseInt(logQty) || 1) : 0,
          defectReason: scrapReason,
          notes: logNotes,
        }),
      });

      if (res.ok) {
        setActiveWoForLog(null);
        setLogQty("10");
        setScrapReason("");
        setLogNotes("");
        await loadData();
      }
    } finally {
      setSubmittingLog(false);
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
            <h1 className="text-base font-black text-slate-800">Tugas Produksi Dapur</h1>
            <p className="text-xs font-semibold text-slate-400">Generic Shop Floor PWA Execution</p>
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
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                wo.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {wo.status}
              </span>
            </div>

            <div>
              <h2 className="text-base font-black text-slate-800">{wo.productName}</h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Penugasan dari Owner</p>
            </div>

            {/* Target vs Progress */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs font-bold">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Target Production:</span>
                <span className="text-slate-800 font-extrabold">{wo.targetPacks} Pack</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Hasil Produksi Bagus:</span>
                <span className="text-emerald-700 font-extrabold">{wo.summaryState?.totalGoodPacks || 0} Pack</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Cacat / Scrap (Waste):</span>
                <span className="text-rose-600 font-extrabold">{wo.summaryState?.totalDefectPacks || 0} Pack</span>
              </div>
            </div>

            {/* 2 Main Actions Buttons (56px Touch Target) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveWoForLog({ wo, action: "GOOD_OUTPUT" });
                  setLogQty("10");
                }}
                className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
              >
                <CheckCircle2 size={16} /> Catat Hasil
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveWoForLog({ wo, action: "SCRAP" });
                  setLogQty("1");
                }}
                className="h-12 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-rose-200 transition-all active:scale-95"
              >
                <AlertTriangle size={16} /> Catat Scrap
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

      {/* Output / Scrap Modal */}
      {activeWoForLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-extrabold text-slate-400 block">{activeWoForLog.wo.woNumber}</span>
                <h3 className="text-base font-black text-slate-800">
                  {activeWoForLog.action === "GOOD_OUTPUT" ? "Catat Hasil Produksi Bagus" : "Catat Produk Cacat / Scrap"}
                </h3>
              </div>
              <button type="button" onClick={() => setActiveWoForLog(null)} className="text-slate-400">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  {activeWoForLog.action === "GOOD_OUTPUT" ? "Jumlah Hasil Produksi (Pack Bagus)" : "Jumlah Item Rusak / Cacat (Pack)"}
                </label>
                <input
                  type="number"
                  placeholder="Nilai kustom..."
                  value={logQty}
                  onChange={(e) => setLogQty(e.target.value)}
                  className={`h-11 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-black text-sm outline-none ${
                    activeWoForLog.action === "GOOD_OUTPUT" ? "text-emerald-700" : "text-rose-600"
                  }`}
                />
                
                {/* SAP/Odoo Dynamic Quick Preset Chips */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {["1", "5", "10", "25", "50"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setLogQty(chip)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition-all ${
                        logQty === chip
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      +{chip} Pack
                    </button>
                  ))}
                </div>
              </div>

              {activeWoForLog.action === "SCRAP" && (
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Alasan Cacat / Scrap</label>
                  <input
                    type="text"
                    placeholder="Contoh: Patah saat pencetakan, Gosong..."
                    value={scrapReason}
                    onChange={(e) => setScrapReason(e.target.value)}
                    className="h-10 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold text-xs outline-none"
                  />
                </div>
              )}

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  placeholder="Catatan pengerjaan..."
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="h-10 w-full px-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold text-xs outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmitLog}
                disabled={submittingLog}
                className={`w-full h-12 rounded-2xl text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md ${
                  activeWoForLog.action === "GOOD_OUTPUT" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {submittingLog ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 
                {activeWoForLog.action === "GOOD_OUTPUT" ? "Simpan Hasil Produksi" : "Simpan Log Scrap"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
