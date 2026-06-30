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
  const [regularPacks, setRegularPacks] = useState("");
  const [fullPacks, setFullPacks] = useState("");
  const [tiktokPacks, setTikTokPacks] = useState("");
  const [leftoverPcs, setLeftoverPcs] = useState("");
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

  useEffect(() => {
    setLoyangUsed("");
    setRegularPacks("");
    setFullPacks("");
    setTikTokPacks("");
    setLeftoverPcs("");
    setSuccess("");
    setError("");
    if (selectedVariant) loadPool(selectedVariant);
  }, [activeTab, selectedVariant, loadPool]);

  function selectVariant(id: string) {
    setSelectedVariant(id); setLoyangUsed(""); setRegularPacks(""); setFullPacks(""); setTikTokPacks(""); setLeftoverPcs("");
    setSuccess(""); setError(""); setShowDetail(false); loadPool(id);
  }

  function stepVal(setter: (v: string) => void, current: string, delta: number, max?: number) {
    const val = Math.max(0, (parseInt(current) || 0) + delta);
    if (max !== undefined && val > max) return;
    setter(String(val));
  }

  async function handleSubmit() {
    setError(""); setSuccess("");
    const loyang = parseInt(loyangUsed) || 0;
    if (loyang <= 0) { setError("Jumlah loyang harus lebih dari 0"); return; }
    if (loyang > totalAvailable) { setError(`Loyang tidak cukup, tersedia hanya ${totalAvailable}`); return; }
    setSubmitting(true);
    try {
      const payload: any = {
        variantId: selectedVariant,
        totalLoyangUsed: loyang,
        type: activeTab,
        leftoverPcs: parseInt(leftoverPcs) || 0,
        customDate: enableCustomDate && customDate ? customDate : undefined
      };
      if (activeTab === "standard") {
        payload.resultRegularPacks = parseInt(regularPacks) || 0;
        payload.resultFullPacks = parseInt(fullPacks) || 0;
      } else {
        payload.resultTikTokPacks = parseInt(tiktokPacks) || 0;
      }

      const res = await fetchWithAuth("/api/pre-packing", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Gagal menyimpan"); return; }
      setSuccess("Tersimpan!"); setLoyangUsed(""); setRegularPacks(""); setFullPacks(""); setTikTokPacks(""); setLeftoverPcs("");
      if (selectedVariant) loadPool(selectedVariant);
    } catch { setError("Gagal menyimpan pre-packing"); } finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} /></div>;

  return (
    <div className="px-5 pt-6 pb-4 md:px-8 md:pt-8 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "#FEF1F5" }}>
            <PackageOpen size={16} style={{ color: "#E85D8C" }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#1C1C1E" }}>
            {enableCustomDate && customDate ? `Pre-Packing: ${customDate}` : "Pre-Packing"}
          </h1>
        </div>

        {role && (role === "owner" || role === "manager") && (
          <div className="flex items-center gap-2">
            <label className="text-xxs font-bold text-slate-500 flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enableCustomDate}
                onChange={(e) => {
                  setEnableCustomDate(e.target.checked);
                  if (e.target.checked && !customDate) {
                    setCustomDate(new Date().toISOString().split("T")[0]);
                  }
                }}
                className="accent-pink-600"
              />
              Tanggal Mundur
            </label>
            {enableCustomDate && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-700 bg-white"
              />
            )}
          </div>
        )}
      </div>
      <p className="text-sm mb-5 ml-10" style={{ color: "#64748B" }}>Loyang → Pack Regular & Full</p>

      {/* Sub-tabs Selector */}
      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1 mb-5" style={{ border: "1px solid #E2E8F0" }}>
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
                  : { color: "#64748B" }
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Variant chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {variants.map((v) => (
          <button key={v.id} onClick={() => selectVariant(v.id)} className="min-h-[48px] px-5 py-2.5 rounded-full text-sm font-bold transition-all tap-target"
            style={selectedVariant === v.id
              ? { background: "#E85D8C", color: "#fff", boxShadow: "0 4px 12px rgba(232,93,140,0.3)" }
              : { background: "#fff", color: "#334155", border: "1px solid #E2E8F0" }}
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
              <div className="rounded-3xl p-5 mb-5" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-extrabold tabular-nums" style={{ color: "#1C1C1E" }}>{totalAvailable}</p>
                    <p className="text-sm" style={{ color: "#64748B" }}>loyang siap di-pack</p>
                    {bufferPcs > 0 && (
                      <div className="mt-2 text-xs font-semibold px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5" style={{ background: "#FEF1F5", color: "#E85D8C" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span>
                        Stok buffer: {bufferPcs} pcs (akan otomatis dipakai)
                      </div>
                    )}
                  </div>
                  {pool.length > 0 && (
                    <button onClick={() => setShowDetail(!showDetail)} className="flex items-center gap-1 text-xs font-semibold tap-target" style={{ color: "#E85D8C" }}>
                      {showDetail ? "Sembunyikan" : "Rincian"}
                      {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>
                {showDetail && pool.length > 0 && (
                  <div className="mt-3 space-y-1 pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
                    {pool.map((p) => (
                      <div key={p.productionId} className="flex justify-between text-xs" style={{ color: "#64748B" }}>
                        <span>{new Date(p.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                        <span className="font-mono font-bold">{p.loyangRemaining} loyang</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {totalAvailable > 0 && (
                <div className="space-y-4">
                  {(activeTab === "standard" 
                    ? [
                        { label: "Loyang dipakai sekarang", val: loyangUsed, set: setLoyangUsed, max: totalAvailable },
                        { label: "Jadi pack Regular berapa", val: regularPacks, set: setRegularPacks, max: undefined },
                        { label: "Jadi pack Full berapa", val: fullPacks, set: setFullPacks, max: undefined },
                        { label: "Sisa pcs churros tidak masuk pack (buffer baru)", val: leftoverPcs, set: setLeftoverPcs, max: undefined },
                      ]
                    : [
                        { label: "Loyang dipakai sekarang", val: loyangUsed, set: setLoyangUsed, max: totalAvailable },
                        { label: "Jadi pack TikTok berapa", val: tiktokPacks, set: setTikTokPacks, max: undefined },
                        { label: "Sisa pcs churros tidak masuk pack (buffer baru)", val: leftoverPcs, set: setLeftoverPcs, max: undefined },
                      ]
                  ).map(({ label, val, set, max }) => (
                    <div key={label}>
                      <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#94A3B8" }}>{label}</label>
                      <div className="flex items-center rounded-full p-1 gap-1" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                        <button type="button" onClick={() => stepVal(set, val, -1, max)} className="h-12 w-12 rounded-full flex items-center justify-center tap-target" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", color: "#334155" }}>
                          <Minus size={18} strokeWidth={2.5} />
                        </button>
                        <Input type="number" min="0" value={val} onChange={(e) => set(e.target.value)} className="flex-1 text-center font-extrabold text-xl tabular-nums border-0 bg-transparent focus-visible:ring-0 h-12 p-0" style={{ color: "#1C1C1E" }} />
                        <button type="button" onClick={() => stepVal(set, val, 1, max)} className="h-12 w-12 rounded-full text-white flex items-center justify-center tap-target" style={{ background: "#E85D8C" }}>
                          <Plus size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button onClick={handleSubmit} disabled={submitting || !(parseInt(loyangUsed) > 0)} className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 tap-target disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)", boxShadow: "0 8px 20px rgba(232,93,140,0.3)" }} data-testid="submit-prepacking-button">
                    {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                    Simpan
                  </button>
                </div>
              )}

              {totalAvailable === 0 && (
                <div className="rounded-2xl border-2 border-dashed p-8 text-center" style={{ borderColor: "#E2E8F0" }}>
                  <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Belum ada loyang tersedia untuk varian ini</p>
                </div>
              )}
            </>
          )}
          {error && <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}><p className="text-sm font-medium" style={{ color: "#DC2626" }}>{error}</p></div>}
          {success && <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}><p className="text-sm font-medium" style={{ color: "#16A34A" }}>{success}</p></div>}
        </>
      )}
    </div>
  );
}

