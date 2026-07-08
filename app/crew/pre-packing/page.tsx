"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Minus, Plus, ChevronDown, ChevronUp, PackageOpen } from "lucide-react";
import type { Variant } from "@/types";

interface PoolItem { productionId: string; date: string; loyangRemaining: number; }

export default function CrewPrePackingPage() {
  const { getToken, role } = useAuth();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [bufferPcs, setBufferPcs] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [loyangUsed, setLoyangUsed] = useState("");
  const [resultRegularPacks, setResultRegularPacks] = useState("");
  const [resultFullPacks, setResultFullPacks] = useState("");
  const [resultTikTokPacks, setResultTikTokPacks] = useState("");
  const [leftoverPcs, setLeftoverPcs] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [poolLoading, setPoolLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"standard" | "tiktok">("standard");

  // Back-dated packing states
  const [enableCustomDate, setEnableCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState("");


  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    fetchWithAuth("/api/variants").then(async (res) => {
      if (res.ok) { const d: Variant[] = await res.json(); setVariants(d.filter((v) => v.isProductionVariant)); }
    }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  const loadPool = useCallback(async (variantId: string) => {
    setPoolLoading(true);
    try {
      const res = await fetchWithAuth(`/api/productions/loyang-pool?variantId=${variantId}&type=${activeTab}`);
      if (res.ok) {
        const d = await res.json();
        setPool(d.pool);
        setTotalAvailable(d.totalAvailable);
        setBufferPcs(d.bufferPcs ?? 0);
      }
    } finally { setPoolLoading(false); }
  }, [fetchWithAuth, activeTab]);

  // Draft load
  useEffect(() => {
    if (typeof window !== "undefined" && selectedVariant) {
      try {
        const saved = JSON.parse(localStorage.getItem(`prepack_draft_${activeTab}_${selectedVariant}`) || "{}");
        if (saved.loyangUsed) setLoyangUsed(saved.loyangUsed);
        if (saved.resultRegularPacks) setResultRegularPacks(saved.resultRegularPacks);
        if (saved.resultFullPacks) setResultFullPacks(saved.resultFullPacks);
        if (saved.resultTikTokPacks) setResultTikTokPacks(saved.resultTikTokPacks);
        if (saved.leftoverPcs) setLeftoverPcs(saved.leftoverPcs);
      } catch(e) {}
      setDraftLoaded(true);
    }
  }, [selectedVariant, activeTab]);

  // Draft save
  useEffect(() => {
    if (draftLoaded && selectedVariant && typeof window !== "undefined") {
      localStorage.setItem(`prepack_draft_${activeTab}_${selectedVariant}`, JSON.stringify({ 
        loyangUsed, resultRegularPacks, resultFullPacks, resultTikTokPacks, leftoverPcs 
      }));
    }
  }, [loyangUsed, resultRegularPacks, resultFullPacks, resultTikTokPacks, leftoverPcs, draftLoaded, activeTab, selectedVariant]);

  useEffect(() => {
    setSuccess("");
    setError("");
    if (selectedVariant) {
      setDraftLoaded(false);
      loadPool(selectedVariant);
    }
  }, [activeTab, selectedVariant, loadPool]);

  function selectVariant(id: string) {
    setSelectedVariant(id);
    setLoyangUsed(""); setResultRegularPacks(""); setResultFullPacks(""); setResultTikTokPacks(""); setLeftoverPcs("");
    setSuccess(""); setError(""); setShowDetail(false); loadPool(id);
  }

  function stepVal(setter: (v: string) => void, current: string, delta: number, max?: number) {
    const val = Math.max(0, (parseFloat(current) || 0) + delta);
    if (max !== undefined && val > max) return;
    setter(String(val));
  }

  async function handleSubmit() {
    setError(""); setSuccess("");
    const loyang = parseFloat(loyangUsed) || 0;
    const regPacks = parseInt(resultRegularPacks) || 0;
    const fullPacks = parseInt(resultFullPacks) || 0;
    const tiktokPacks = parseInt(resultTikTokPacks) || 0;
    const leftover = parseInt(leftoverPcs) || 0;
    
    if (loyang <= 0) { setError("Jumlah loyang harus lebih dari 0"); return; }
    
    if (activeTab === "standard" && regPacks === 0 && fullPacks === 0 && leftover === 0) {
      setError("Isi jumlah hasil pack atau sisa pcs"); return;
    }
    if (activeTab === "tiktok" && tiktokPacks === 0 && leftover === 0) {
      setError("Isi jumlah hasil pack atau sisa pcs"); return;
    }
    
    if (loyang > totalAvailable) { setError(`Loyang tidak cukup, tersedia hanya ${totalAvailable}`); return; }
    setSubmitting(true);

    try {
      const payload: any = {
        variantId: selectedVariant,
        totalLoyangUsed: loyang,
        type: activeTab,
        leftoverPcs: leftover,
        customDate: enableCustomDate && customDate ? customDate : undefined
      };
      
      if (activeTab === "standard") {
        payload.resultRegularPacks = regPacks;
        payload.resultFullPacks = fullPacks;
      } else {
        payload.resultTikTokPacks = tiktokPacks;
      }

      const res = await fetchWithAuth("/api/pre-packing", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Gagal menyimpan"); return; }
      setSuccess("Data pre-packing berhasil disimpan!");
      setLoyangUsed(""); setResultRegularPacks(""); setResultFullPacks(""); setResultTikTokPacks(""); setLeftoverPcs("");
      if (typeof window !== "undefined" && selectedVariant) {
        localStorage.removeItem(`prepack_draft_${activeTab}_${selectedVariant}`);
      }
      if (selectedVariant) loadPool(selectedVariant);
    } catch { setError("Gagal menyimpan pre-packing"); } finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} /></div>;

  return (
    <div className="page-enter min-h-screen pb-10" style={{ background: "#FCABB4" }}>
      {/* Header (Glassmorphism) */}
      <div className="px-5 pt-6 pb-6 mb-2 rounded-b-3xl sticky top-0 z-30 bg-white/90 backdrop-blur-xl shadow-sm border-b border-pink-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-pink-50 border border-pink-100">
              <PackageOpen size={20} className="text-pink-500" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800" style={{ letterSpacing: "-0.02em" }}>
              {enableCustomDate && customDate ? `Pre-Packing: ${customDate}` : "Pre-Packing"}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xxs font-bold text-slate-600 flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enableCustomDate}
                onChange={(e) => {
                  setEnableCustomDate(e.target.checked);
                  if (e.target.checked && !customDate) {
                    setCustomDate(new Date().toISOString().split("T")[0]);
                  }
                }}
                className="accent-pink-200"
              />
              Pilih Tanggal
            </label>
            {enableCustomDate && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="text-xs border border-white/30 bg-white/20 text-white rounded-lg px-2 py-1 outline-none"
              />
            )}
          </div>
        </div>
        <p className="text-xs mt-3 ml-13 font-medium" style={{ color: "rgba(255,255,255,0.9)", marginLeft: "52px" }}>Loyang → Pack Regular & Full</p>
      </div>

      <div className="px-4 mt-6 md:px-8 md:max-w-3xl">

      {/* Sub-tabs Selector */}
      <div className="flex bg-white/20 backdrop-blur-md rounded-2xl p-1.5 gap-1 mb-6" style={{ border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 4px 12px rgba(232,93,140,0.1)" }}>
        {[
          { key: "standard", label: "Churros Standar (Mentah)" },
          { key: "tiktok", label: "Churros TikTok (Setengah Matang)" },
        ].map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as "standard" | "tiktok")}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all tap-target"
              style={
                active
                  ? { background: "#fff", color: "#E85D8C", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }
                  : { color: "#fff" }
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Variant chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {variants.map((v) => (
          <button key={v.id} onClick={() => selectVariant(v.id)} className="min-h-[48px] px-5 py-2.5 rounded-full text-sm font-bold transition-all tap-target"
            style={selectedVariant === v.id
              ? { background: "#E85D8C", color: "#fff", boxShadow: "0 4px 12px rgba(232,93,140,0.3)", border: "1px solid #E85D8C" }
              : { background: "#fff", color: "#334155", border: "1px solid rgba(255,255,255,0.5)" }}
            data-testid={`variant-chip-${v.id}`}>
            {v.name}
          </button>
        ))}
      </div>

      {selectedVariant && (
        <>
          {poolLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#E85D8C" }} /></div>
          ) : (
            <>
              {/* Pool card */}
              <div className="rounded-3xl p-6 mb-6" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(255,255,255,0.5)", boxShadow: "0 10px 30px rgba(232,93,140,0.2)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-4xl font-black tabular-nums" style={{ color: "#831843" }}>{totalAvailable}</p>
                    <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: "#64748B" }}>loyang siap di-pack</p>
                    {bufferPcs > 0 && (
                      <div className="mt-3 text-xs font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-2" style={{ background: "#FEF1F5", color: "#E85D8C", border: "1px solid rgba(232,93,140,0.2)" }}>
                        <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
                        Stok buffer: {bufferPcs} pcs (akan dipakai)
                      </div>
                    )}
                  </div>
                  {pool.length > 0 && (
                    <button onClick={() => setShowDetail(!showDetail)} className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-widest font-bold tap-target px-3 py-2 rounded-xl" style={{ color: "#E85D8C", background: "#FEF1F5" }}>
                      {showDetail ? "Tutup" : "Rincian"}
                      {showDetail ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                </div>
                {showDetail && pool.length > 0 && (
                  <div className="mt-4 space-y-2 pt-4" style={{ borderTop: "1px dashed rgba(232,93,140,0.2)" }}>
                    {pool.map((p) => (
                      <div key={p.productionId} className="flex justify-between text-sm items-center">
                        <span className="font-semibold text-slate-500">{new Date(p.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span className="font-black text-pink-700 bg-pink-50 px-3 py-1 rounded-lg">{p.loyangRemaining} loyang</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {totalAvailable > 0 && (
                <div className="space-y-5 bg-white p-6 rounded-3xl" style={{ boxShadow: "0 10px 40px rgba(232,93,140,0.15)" }}>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: "#94A3B8" }}>Loyang Diambil (bisa desimal)</label>
                    <div className="flex items-center rounded-2xl p-1.5 gap-1.5" style={{ background: "#F8FAFC", border: "2px solid #F1F5F9" }}>
                      <button type="button" onClick={() => stepVal(setLoyangUsed, loyangUsed, -0.5, totalAvailable)} className="h-12 w-12 rounded-xl flex items-center justify-center tap-target hover:bg-white transition-all active:scale-95 text-slate-700 bg-white shadow-sm">
                        <Minus size={18} strokeWidth={3} />
                      </button>
                      <Input type="number" min="0" step="0.5" value={loyangUsed} onChange={(e) => setLoyangUsed(e.target.value)} className="flex-1 text-center font-black text-2xl tabular-nums border-0 bg-transparent focus-visible:ring-0 h-12 p-0 text-pink-900" />
                      <button type="button" onClick={() => stepVal(setLoyangUsed, loyangUsed, 0.5, totalAvailable)} className="h-12 w-12 rounded-xl flex items-center justify-center tap-target text-white transition-all active:scale-95 bg-pink-500 shadow-sm">
                        <Plus size={18} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {activeTab === "standard" ? (
                    <>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: "#94A3B8" }}>Hasil Pack Regular (Isi 12)</label>
                        <div className="flex items-center rounded-2xl p-1.5 gap-1.5" style={{ background: "#F8FAFC", border: "2px solid #F1F5F9" }}>
                          <button type="button" onClick={() => stepVal(setResultRegularPacks, resultRegularPacks, -1)} className="h-12 w-12 rounded-xl flex items-center justify-center tap-target hover:bg-white transition-all active:scale-95 text-slate-700 bg-white shadow-sm">
                            <Minus size={18} strokeWidth={3} />
                          </button>
                          <Input type="number" min="0" step="1" value={resultRegularPacks} onChange={(e) => setResultRegularPacks(e.target.value)} className="flex-1 text-center font-black text-2xl tabular-nums border-0 bg-transparent focus-visible:ring-0 h-12 p-0 text-pink-900" />
                          <button type="button" onClick={() => stepVal(setResultRegularPacks, resultRegularPacks, 1)} className="h-12 w-12 rounded-xl flex items-center justify-center tap-target text-white transition-all active:scale-95 bg-pink-500 shadow-sm">
                            <Plus size={18} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: "#94A3B8" }}>Hasil Pack Full (Isi 16)</label>
                        <div className="flex items-center rounded-2xl p-1.5 gap-1.5" style={{ background: "#F8FAFC", border: "2px solid #F1F5F9" }}>
                          <button type="button" onClick={() => stepVal(setResultFullPacks, resultFullPacks, -1)} className="h-12 w-12 rounded-xl flex items-center justify-center tap-target hover:bg-white transition-all active:scale-95 text-slate-700 bg-white shadow-sm">
                            <Minus size={18} strokeWidth={3} />
                          </button>
                          <Input type="number" min="0" step="1" value={resultFullPacks} onChange={(e) => setResultFullPacks(e.target.value)} className="flex-1 text-center font-black text-2xl tabular-nums border-0 bg-transparent focus-visible:ring-0 h-12 p-0 text-pink-900" />
                          <button type="button" onClick={() => stepVal(setResultFullPacks, resultFullPacks, 1)} className="h-12 w-12 rounded-xl flex items-center justify-center tap-target text-white transition-all active:scale-95 bg-pink-500 shadow-sm">
                            <Plus size={18} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: "#94A3B8" }}>Hasil Pack TikTok (Isi 12)</label>
                      <div className="flex items-center rounded-2xl p-1.5 gap-1.5" style={{ background: "#F8FAFC", border: "2px solid #F1F5F9" }}>
                        <button type="button" onClick={() => stepVal(setResultTikTokPacks, resultTikTokPacks, -1)} className="h-12 w-12 rounded-xl flex items-center justify-center tap-target hover:bg-white transition-all active:scale-95 text-slate-700 bg-white shadow-sm">
                          <Minus size={18} strokeWidth={3} />
                        </button>
                        <Input type="number" min="0" step="1" value={resultTikTokPacks} onChange={(e) => setResultTikTokPacks(e.target.value)} className="flex-1 text-center font-black text-2xl tabular-nums border-0 bg-transparent focus-visible:ring-0 h-12 p-0 text-pink-900" />
                        <button type="button" onClick={() => stepVal(setResultTikTokPacks, resultTikTokPacks, 1)} className="h-12 w-12 rounded-xl flex items-center justify-center tap-target text-white transition-all active:scale-95 bg-pink-500 shadow-sm">
                          <Plus size={18} strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: "#94A3B8" }}>Sisa / Reject (Pcs)</label>
                    <div className="flex items-center rounded-2xl p-1.5 gap-1.5" style={{ background: "#F8FAFC", border: "2px solid #F1F5F9" }}>
                      <button type="button" onClick={() => stepVal(setLeftoverPcs, leftoverPcs, -1)} className="h-12 w-12 rounded-xl flex items-center justify-center tap-target hover:bg-white transition-all active:scale-95 text-slate-700 bg-white shadow-sm">
                        <Minus size={18} strokeWidth={3} />
                      </button>
                      <Input type="number" min="0" step="1" value={leftoverPcs} onChange={(e) => setLeftoverPcs(e.target.value)} className="flex-1 text-center font-black text-2xl tabular-nums border-0 bg-transparent focus-visible:ring-0 h-12 p-0 text-pink-900" />
                      <button type="button" onClick={() => stepVal(setLeftoverPcs, leftoverPcs, 1)} className="h-12 w-12 rounded-xl flex items-center justify-center tap-target text-white transition-all active:scale-95 bg-pink-500 shadow-sm">
                        <Plus size={18} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  <button onClick={handleSubmit} disabled={submitting || !(parseFloat(loyangUsed) > 0)} className="w-full mt-2 min-h-[60px] rounded-2xl text-white font-extrabold text-base flex items-center justify-center gap-3 tap-target disabled:opacity-60 transition-all hover:shadow-xl active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)", boxShadow: "0 10px 25px rgba(232,93,140,0.4)" }} data-testid="submit-prepacking-button">
                    {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} strokeWidth={3} />}
                    Simpan Pre-Packing
                  </button>
                </div>
              )}

              {totalAvailable === 0 && (
                <div className="rounded-3xl border-2 border-dashed p-10 text-center bg-white/50 backdrop-blur-sm" style={{ borderColor: "rgba(255,255,255,0.6)" }}>
                  <PackageOpen size={32} className="mx-auto mb-3 text-white opacity-80" />
                  <p className="text-sm font-bold text-white">Belum ada loyang tersedia untuk varian ini</p>
                </div>
              )}
            </>
          )}
          {error && <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}><p className="text-sm font-medium" style={{ color: "#DC2626" }}>{error}</p></div>}
          {success && <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}><p className="text-sm font-medium" style={{ color: "#16A34A" }}>{success}</p></div>}
        </>
      )}
      </div>
    </div>
  );
}

