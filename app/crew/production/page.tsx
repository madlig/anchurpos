"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Minus, Plus, ChefHat, History, X, Calendar } from "lucide-react";
import type { Variant, Production } from "@/types";

interface EntryInput {
  variantId: string;
  batches: string;
  loyangCount: string;
  pcsCount: string;
}

export default function CrewProductionPage() {
  const { getToken, role } = useAuth();
  const { alert } = useAlertConfirm();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [todayProductions, setTodayProductions] = useState<Production[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<Map<string, EntryInput>>(new Map());
  const [notes, setNotes] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loyangTarget, setLoyangTarget] = useState(8);
  const [activeTab, setActiveTab] = useState<"standard" | "tiktok">("standard");

  // Back-dated production states
  const [enableCustomDate, setEnableCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState("");

  // History states
  const [showHistory, setShowHistory] = useState(false);
  const [historyVariantId, setHistoryVariantId] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<Production[]>([]);

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
    try {
      const activeDate = enableCustomDate && customDate ? customDate : new Date().toISOString().split("T")[0];
      const [varRes, prodRes, targetRes] = await Promise.all([
        fetchWithAuth("/api/variants"),
        fetchWithAuth(`/api/productions?date=${activeDate}&type=${activeTab}`),
        fetchWithAuth("/api/settings/production"),
      ]);
      if (varRes.ok) {
        const data: Variant[] = await varRes.json();
        setVariants(data.filter((v) => v.isProductionVariant));
      }
      if (prodRes.ok) setTodayProductions(await prodRes.json());
      if (targetRes.ok) {
        const t = await targetRes.json();
        setLoyangTarget(t.dailyLoyangTarget ?? 8);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, activeTab, enableCustomDate, customDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadHistory = useCallback(async (vId: string) => {
    if (!vId) return;
    setHistoryLoading(true);
    try {
      const res = await fetchWithAuth(`/api/productions?variantId=${vId}`);
      if (res.ok) {
        setHistoryData(await res.json());
      } else {
        setHistoryData([]);
      }
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (showHistory && historyVariantId) {
      loadHistory(historyVariantId);
    }
  }, [showHistory, historyVariantId, loadHistory]);

  useEffect(() => {
    if (typeof window !== "undefined" && !draftLoaded) {
      try {
        const savedEntriesStr = localStorage.getItem("prod_draft_entries_" + activeTab);
        const savedNotes = localStorage.getItem("prod_draft_notes_" + activeTab);
        if (savedNotes) setNotes(savedNotes);
        if (savedEntriesStr) {
          const parsed = JSON.parse(savedEntriesStr);
          if (Array.isArray(parsed)) {
            const nextEntries = new Map<string, EntryInput>();
            const nextSelected = new Set<string>();
            parsed.forEach((item: any) => {
              if (item && item.variantId) {
                nextEntries.set(item.variantId, item);
                nextSelected.add(item.variantId);
              }
            });
            setEntries(nextEntries);
            setSelected(nextSelected);
          }
        }
      } catch (err) {
        console.error("Failed to load draft", err);
      } finally {
        setDraftLoaded(true);
      }
    }
  }, [activeTab, draftLoaded]);

  useEffect(() => {
    if (draftLoaded && typeof window !== "undefined") {
      try {
        const toSave = Array.from(entries.values());
        if (toSave.length > 0) {
          localStorage.setItem("prod_draft_entries_" + activeTab, JSON.stringify(toSave));
        } else {
          localStorage.removeItem("prod_draft_entries_" + activeTab);
        }
        if (notes) {
          localStorage.setItem("prod_draft_notes_" + activeTab, notes);
        } else {
          localStorage.removeItem("prod_draft_notes_" + activeTab);
        }
      } catch (err) {
        console.error("Failed to save draft", err);
      }
    }
  }, [entries, notes, activeTab, draftLoaded]);

  function toggleVariant(variantId: string) {
    const nextSelected = new Set(selected);
    const nextEntries = new Map(entries);

    if (nextSelected.has(variantId)) {
      nextSelected.delete(variantId);
      nextEntries.delete(variantId);
    } else {
      nextSelected.add(variantId);
      nextEntries.set(variantId, { variantId, batches: "0", loyangCount: "0", pcsCount: "0" });
    }
    setSelected(nextSelected);
    setEntries(nextEntries);
  }

  function updateEntry(variantId: string, field: "batches" | "loyangCount" | "pcsCount", value: string) {
    const nextEntries = new Map(entries);
    const entry = nextEntries.get(variantId);
    if (entry) {
      nextEntries.set(variantId, { ...entry, [field]: value });
      setEntries(nextEntries);
    }
  }

  function stepValue(variantId: string, field: "batches" | "loyangCount" | "pcsCount", delta: number) {
    const entry = entries.get(variantId);
    if (!entry) return;
    const current = parseFloat(entry[field]) || 0;
    const step = field === "batches" ? 0.5 : field === "pcsCount" ? 12 : 1;
    const next = Math.max(0, current + delta * step);
    updateEntry(variantId, field, String(next));
  }

  async function handleSubmit() {
    setSubmitting(true);

    const batchEntries = Array.from(entries.values())
      .filter((e) => parseFloat(e.batches) > 0 || parseInt(e.loyangCount) > 0)
      .map((e) => ({
        variantId: e.variantId,
        batches: parseFloat(e.batches) || 0,
        loyangCount: parseInt(e.loyangCount) || 0,
        pcsCount: parseInt(e.pcsCount) || 0,
      }));

    if (batchEntries.length === 0) {
      await alert("Pilih minimal 1 varian dan isi jumlahnya", "Peringatan", "danger");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchWithAuth("/api/productions/batch", {
        method: "POST",
        body: JSON.stringify({
          entries: batchEntries,
          type: activeTab,
          notes,
          customDate: enableCustomDate && customDate ? customDate : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        await alert(data.error || "Gagal menyimpan", "Error", "danger");
        return;
      }

      let msg = `Berhasil menyimpan ${data.entriesSaved} data produksi.`;
      if (data.warnings?.length > 0) {
        msg += `\n(Peringatan: ${data.warnings.join(", ")})`;
      }

      await alert(msg, "Produksi Disimpan!", "success");

      setSelected(new Set());
      setEntries(new Map());
      setNotes("");
      if (typeof window !== "undefined") {
        localStorage.removeItem("prod_draft_entries_" + activeTab);
        localStorage.removeItem("prod_draft_notes_" + activeTab);
      }
      await loadData();
    } catch {
      await alert("Gagal koneksi, coba lagi", "Error", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" >
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const totalLoyang = todayProductions.reduce((s, p) => s + p.loyangCount, 0);
  const progressPct = Math.round((totalLoyang / loyangTarget) * 100);

  return (
    <div className="page-enter min-h-screen pb-10 bg-slate-50" >
      {/* Header (Glassmorphism) */}
      <div className="px-5 pt-6 pb-6 mb-2 rounded-b-3xl sticky top-0 z-30 bg-white/90 backdrop-blur-xl shadow-sm border-b border-pink-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 -tracking-[0.02em]">
              {enableCustomDate && customDate ? `Produksi: ${customDate}` : "Produksi Hari Ini"}
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              {todayProductions.length} item produksi tercatat
            </p>
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
                className="text-xs border border-slate-300 bg-white text-slate-700 rounded-lg px-2 py-1 outline-none"
              />
            )}
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-pink-50 hover:bg-pink-100 text-pink-900 transition-colors"
            >
              <History size={14} /> Riwayat
            </button>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden slide-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-brand-50">
              <div>
                <h2 className="text-base font-extrabold text-slate-800">Riwayat Produksi</h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">Cek kapan produk terakhir dibuat</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-2 bg-white rounded-xl text-slate-400 hover:text-slate-600 shadow-sm transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Pilih Produk</label>
              <select
                value={historyVariantId}
                onChange={(e) => setHistoryVariantId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">-- Pilih Produk --</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {!historyVariantId ? (
                <div className="text-center py-10">
                  <History size={32} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-sm font-bold text-slate-400">Pilih produk di atas untuk melihat riwayat</p>
                </div>
              ) : historyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm font-bold text-slate-400">Belum ada riwayat produksi</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.map(prod => (
                    <div key={prod.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <Calendar size={14} className="text-primary" />
                          {new Date(prod.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </p>
                        <p className="text-xs font-bold text-slate-400 mt-1">
                          {prod.loyangCount} loyang • {prod.pcsCount} pcs
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-1 rounded-lg text-xs font-black uppercase tracking-widest bg-primary/10 text-primary">
                          {prod.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-tabs Selector */}
      <div className="px-4 mb-6 mt-4 md:px-8 md:max-w-3xl">
        <div className="flex bg-white rounded-2xl p-1.5 gap-1 shadow-sm border border-slate-200">
          {[
            { key: "standard", label: "Churros Standar (Mentah)" },
            { key: "tiktok", label: "Churros TikTok (Setengah Matang)" },
          ].map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as "standard" | "tiktok")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all tap-target ${active ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-4 md:px-8 md:max-w-3xl space-y-6">

      {/* Summary stats card */}
      {todayProductions.length > 0 && (
        <div
          data-testid="production-summary-card"
          className="rounded-3xl transition-all bg-white shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="flex border-b border-slate-100">
            {[
              { label: "Selesai", value: String(totalLoyang), color: "text-primary" },
              { label: "Target", value: String(loyangTarget), color: "text-slate-600" },
              { label: "Progress", value: `${progressPct}%`, color: progressPct >= 100 ? "text-green-600" : "text-amber-600" },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`flex-1 text-center py-4 ${i < 2 ? 'border-r border-slate-100' : ''}`}
              >
                <p className={`text-2xl font-extrabold -tracking-[0.02em] ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5 font-semibold uppercase tracking-[0.05em]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's productions */}
      {todayProductions.length > 0 && (
        <div>
          <p className="text-sm font-bold text-slate-800 mb-3">Sudah Dicatat</p>
          <div className="rounded-3xl bg-white overflow-hidden border border-slate-200 shadow-sm">
            {todayProductions.map((p, i) => {
              const barPct = Math.min(100, (p.loyangCount / loyangTarget) * 100);
              return (
                <div
                  key={p.id}
                  className={`p-4 md:px-5 ${i < todayProductions.length - 1 ? 'border-b border-slate-100' : ''}`}
                  data-testid={`today-production-${i}`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-sm font-bold text-slate-800">{p.variantId}</span>
                    <span className="text-xs font-bold text-primary px-2.5 py-1 rounded-full bg-primary/10">
                      {p.loyangCount} loyang
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-pink-400 transition-all duration-500" style={{ width: `${barPct}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 font-medium">{p.batches} adonan</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Production Form */}
      <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-primary/10">
            <ChefHat size={20} className="text-primary" />
          </div>
          <p className="text-base font-extrabold text-slate-800">
            Tambah Produksi ({activeTab === "standard" ? "Standar" : "TikTok"})
          </p>
        </div>

        {(role === "owner" || role === "manager") && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded text-primary focus:ring-primary border-slate-300" 
                checked={enableCustomDate}
                onChange={(e) => setEnableCustomDate(e.target.checked)}
              />
              <span className="text-sm font-bold text-slate-700">Input Data Backdated (Mundur)</span>
            </label>
            {enableCustomDate && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm font-bold bg-white border border-slate-200 focus:ring-2 focus:ring-primary transition-all"
              />
            )}
          </div>
        )}

      {/* Variant chips */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-400">Pilih Varian</p>
        <div className="flex flex-wrap gap-2" data-testid="variant-chips">
          {variants.map((v) => {
            const isSelected = selected.has(v.id);
            return (
              <button
                key={v.id}
                onClick={() => toggleVariant(v.id)}
                data-testid={`variant-chip-${v.id}`}
                className={`min-h-[48px] px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border tap-target ${isSelected ? 'bg-primary text-white border-primary shadow-md shadow-pink-500/20' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              >
                {v.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Entry cards */}
      <div className="space-y-4 mb-4">
        {Array.from(selected).map((vid) => {
          const variant = variants.find((v) => v.id === vid);
          const entry = entries.get(vid);
          if (!variant || !entry) return null;
          return (
            <div
              key={vid}
              className="rounded-3xl p-6 page-enter bg-pink-50/50 border border-pink-100 shadow-sm"
              data-testid={`entry-card-${vid}`}
            >
              <p className="font-extrabold text-lg mb-5 text-pink-900">{variant.name}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-2 block text-slate-500">
                    Jumlah Adonan
                  </label>
                  <Stepper
                    value={entry.batches}
                    onChange={(v) => updateEntry(vid, "batches", v)}
                    onStep={(d) => stepValue(vid, "batches", d)}
                    step="0.5"
                    testId={`stepper-batches-${vid}`}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-2 block text-slate-500">
                    Jumlah Loyang
                  </label>
                  <Stepper
                    value={entry.loyangCount}
                    onChange={(v) => updateEntry(vid, "loyangCount", v)}
                    onStep={(d) => stepValue(vid, "loyangCount", d)}
                    step="1"
                    testId={`stepper-loyang-${vid}`}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-2 block text-slate-500">
                    Total Pcs Churros
                  </label>
                  <Stepper
                    value={entry.pcsCount}
                    onChange={(v) => updateEntry(vid, "pcsCount", v)}
                    onStep={(d) => stepValue(vid, "pcsCount", d)}
                    step="12"
                    testId={`stepper-pcs-${vid}`}
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Sesuai pcs yang dihasilkan</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <>
          <div className="mb-6">
            <label className="text-xs font-bold uppercase tracking-widest mb-3 block text-slate-400">
              Catatan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl px-5 py-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-slate-200 bg-slate-50 text-slate-800 min-h-[100px]"
              placeholder="Tambahkan catatan khusus hari ini..."
              data-testid="production-notes"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full min-h-[60px] rounded-2xl text-white font-extrabold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 tap-target hover:shadow-lg bg-gradient-to-br from-primary to-rose-600 shadow-md shadow-pink-500/20"
            data-testid="save-production-button"
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
            Simpan Semua Produksi
          </button>
        </>
      )}

      </div>{/* /Add Production Form */}

      </div>{/* /px-4 */}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  onStep,
  step,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  onStep: (delta: number) => void;
  step: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center rounded-2xl p-1 gap-1 bg-white border border-slate-200 shadow-sm" data-testid={testId}>
      <button
        type="button"
        onClick={() => onStep(-1)}
        className="h-14 w-14 rounded-xl flex items-center justify-center transition-colors tap-target bg-slate-50 hover:bg-slate-100 text-slate-600 active:scale-95"
        data-testid={testId ? `${testId}-minus` : undefined}
      >
        <Minus size={20} strokeWidth={2.5} />
      </button>
      <Input
        type="number"
        step={step}
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-center font-black text-2xl tabular-nums border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-14 p-0 text-pink-900"
        data-testid={testId ? `${testId}-input` : undefined}
      />
      <button
        type="button"
        onClick={() => onStep(1)}
        className="h-14 w-14 rounded-xl flex items-center justify-center transition-colors tap-target bg-primary/10 hover:bg-primary/20 text-primary active:scale-95"
        data-testid={testId ? `${testId}-plus` : undefined}
      >
        <Plus size={20} strokeWidth={2.5} />
      </button>
    </div>
  );
}
