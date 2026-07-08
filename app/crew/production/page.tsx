"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Minus, Plus, ChefHat } from "lucide-react";
import type { Variant, Production } from "@/types";

interface EntryInput {
  variantId: string;
  batches: string;
  loyangCount: string;
  pcsCount: string;
}

export default function CrewProductionPage() {
  const { getToken, role } = useAuth();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [todayProductions, setTodayProductions] = useState<Production[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<Map<string, EntryInput>>(new Map());
  const [notes, setNotes] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loyangTarget, setLoyangTarget] = useState(8);
  const [activeTab, setActiveTab] = useState<"standard" | "tiktok">("standard");

  // Back-dated production states
  const [enableCustomDate, setEnableCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState("");


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

  // Draft loading and saving
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedEntries = localStorage.getItem("prod_draft_entries_" + activeTab);
        const savedNotes = localStorage.getItem("prod_draft_notes_" + activeTab);
        if (savedEntries) {
          const parsed = JSON.parse(savedEntries);
          const map = new Map<string, EntryInput>(parsed);
          setEntries(map);
          setSelected(new Set(map.keys()));
        } else {
          setEntries(new Map());
          setSelected(new Set());
        }
        setNotes(savedNotes || "");
      } catch (e) {
        console.error("Gagal meload draft", e);
      }
      setDraftLoaded(true);
      setSuccess("");
      setError("");
    }
  }, [activeTab]);

  useEffect(() => {
    if (draftLoaded && typeof window !== "undefined") {
      localStorage.setItem("prod_draft_entries_" + activeTab, JSON.stringify(Array.from(entries.entries())));
      localStorage.setItem("prod_draft_notes_" + activeTab, notes);
    }
  }, [entries, notes, draftLoaded, activeTab]);

  function toggleVariant(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
      const nextEntries = new Map(entries);
      nextEntries.delete(id);
      setEntries(nextEntries);
    } else {
      next.add(id);
      const nextEntries = new Map(entries);
      nextEntries.set(id, { variantId: id, batches: "", loyangCount: "", pcsCount: "" });
      setEntries(nextEntries);
    }
    setSelected(next);
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
    setError("");
    setSuccess("");
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
      setError("Isi minimal 1 varian");
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
        setError(data.error || "Gagal menyimpan");
        return;
      }

      setSuccess(`Tersimpan — ${data.entriesSaved} varian`);
      if (data.warnings?.length > 0) {
        setSuccess((s) => s + ` (peringatan: ${data.warnings.join(", ")})`);
      }
      setSelected(new Set());
      setEntries(new Map());
      setNotes("");
      if (typeof window !== "undefined") {
        localStorage.removeItem("prod_draft_entries_" + activeTab);
        localStorage.removeItem("prod_draft_notes_" + activeTab);
      }
      await loadData();
    } catch {
      setError("Gagal menyimpan produksi");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
      </div>
    );
  }

  const totalLoyang = todayProductions.reduce((s, p) => s + p.loyangCount, 0);
  const progressPct = Math.round((totalLoyang / loyangTarget) * 100);

  return (
    <div className="page-enter min-h-screen pb-10" style={{ background: "#FCABB4" }}>
      {/* Header (Glassmorphism) */}
      <div className="px-5 pt-6 pb-6 mb-2 rounded-b-3xl sticky top-0 z-30 bg-white/90 backdrop-blur-xl shadow-sm border-b border-pink-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800" style={{ letterSpacing: "-0.02em" }}>
              {enableCustomDate && customDate ? `Produksi: ${customDate}` : "Produksi Hari Ini"}
            </h1>
            <p className="text-[13px] text-slate-500 mt-1 font-medium">
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
                className="text-xs border border-white/30 bg-white/20 text-white rounded-lg px-2 py-1 outline-none"
              />
            )}
          </div>
        </div>
      </div>

      {/* Sub-tabs Selector */}
      <div className="px-4 mb-6 mt-4 md:px-8 md:max-w-3xl">
        <div className="flex bg-white/20 backdrop-blur-md rounded-2xl p-1.5 gap-1" style={{ border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 4px 12px rgba(232,93,140,0.1)" }}>
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
      </div>

      <div className="px-4 pb-4 md:px-8 md:max-w-3xl space-y-6">

      {/* Summary stats card */}
      {todayProductions.length > 0 && (
        <div
          data-testid="production-summary-card"
          className="rounded-3xl transition-all"
          style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.5)", overflow: "hidden", boxShadow: "0 10px 30px rgba(232,93,140,0.2)" }}
        >
          <div className="flex" style={{ borderBottom: "1px solid rgba(241,245,249,0.5)" }}>
            {[
              { label: "Selesai", value: String(totalLoyang), color: "#E85D8C" },
              { label: "Target", value: String(loyangTarget), color: "#64748B" },
              { label: "Progress", value: `${progressPct}%`, color: progressPct >= 100 ? "#16A34A" : "#D97706" },
            ].map((s, i) => (
              <div
                key={s.label}
                className="flex-1 text-center py-4"
                style={{ borderRight: i < 2 ? "1px solid rgba(241,245,249,0.5)" : "none" }}
              >
                <p style={{ fontSize: "24px", fontWeight: "800", color: s.color, letterSpacing: "-0.02em" }}>{s.value}</p>
                <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's productions */}
      {todayProductions.length > 0 && (
        <div>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E", marginBottom: "12px" }}>Sudah Dicatat</p>
          <div className="rounded-3xl" style={{ background: "rgba(255,255,255,0.95)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.5)", boxShadow: "0 10px 30px rgba(232,93,140,0.15)" }}>
            {todayProductions.map((p, i) => {
              const barPct = Math.min(100, (p.loyangCount / loyangTarget) * 100);
              return (
                <div
                  key={p.id}
                  style={{ padding: "16px 20px", borderBottom: i < todayProductions.length - 1 ? "1px solid rgba(241,245,249,0.6)" : "none" }}
                  data-testid={`today-production-${i}`}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>{p.variantId}</span>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#E85D8C", padding: "4px 10px", borderRadius: "100px", background: "#FEF1F5" }}>
                      {p.loyangCount} loyang
                    </span>
                  </div>
                  <div style={{ height: "6px", borderRadius: "3px", background: "#F1F5F9", overflow: "hidden" }}>
                    <div style={{ height: "6px", borderRadius: "3px", background: "linear-gradient(90deg, #E85D8C 0%, #F472B6 100%)", width: `${barPct}%`, transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                  </div>
                  <p style={{ fontSize: "12px", color: "#64748B", marginTop: "8px", fontWeight: "500" }}>{p.batches} adonan</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Production Form */}
      <div className="rounded-3xl p-6" style={{ background: "#fff", border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 10px 40px rgba(232,93,140,0.2)" }}>
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: "#FEF1F5" }}>
            <ChefHat size={20} style={{ color: "#E85D8C" }} />
          </div>
          <p style={{ fontSize: "16px", fontWeight: "800", color: "#1C1C1E" }}>
            Tambah Produksi ({activeTab === "standard" ? "Standar" : "TikTok"})
          </p>
        </div>

      {/* Variant chips */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#94A3B8" }}>Pilih Varian</p>
        <div className="flex flex-wrap gap-2" data-testid="variant-chips">
          {variants.map((v) => {
            const isSelected = selected.has(v.id);
            return (
              <button
                key={v.id}
                onClick={() => toggleVariant(v.id)}
                data-testid={`variant-chip-${v.id}`}
                className="min-h-[48px] px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border tap-target"
                style={isSelected
                  ? { background: "#E85D8C", color: "#fff", borderColor: "#E85D8C", boxShadow: "0 4px 12px rgba(232,93,140,0.3)" }
                  : { background: "#fff", color: "#334155", borderColor: "#E2E8F0" }
                }
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
              className="rounded-3xl p-6 page-enter"
              style={{ background: "#FEF1F5", border: "1px solid rgba(232,93,140,0.1)", boxShadow: "0 4px 15px rgba(232,93,140,0.05)" }}
              data-testid={`entry-card-${vid}`}
            >
              <p className="font-extrabold text-lg mb-5" style={{ color: "#831843" }}>{variant.name}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#94A3B8" }}>
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
                  <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#94A3B8" }}>
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
                  <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#94A3B8" }}>
                    Total Pcs Churros
                  </label>
                  <Stepper
                    value={entry.pcsCount}
                    onChange={(v) => updateEntry(vid, "pcsCount", v)}
                    onStep={(d) => stepValue(vid, "pcsCount", d)}
                    step="12"
                    testId={`stepper-pcs-${vid}`}
                  />
                  <p className="text-xs text-stone-400 mt-1.5">Sesuai pcs yang dihasilkan</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <>
          <div className="mb-6">
            <label className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: "#94A3B8" }}>
              Catatan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl px-5 py-4 text-sm resize-none focus:outline-none transition-all"
              style={{ border: "2px solid #F1F5F9", background: "#F8FAFC", color: "#1C1C1E", minHeight: "100px" }}
              placeholder="Tambahkan catatan khusus hari ini..."
              data-testid="production-notes"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full min-h-[60px] rounded-2xl text-white font-extrabold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 tap-target hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)", boxShadow: "0 10px 25px rgba(232,93,140,0.4)" }}
            data-testid="save-production-button"
          >
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
            Simpan Semua Produksi
          </button>
        </>
      )}

      {error && (
        <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }} data-testid="production-error">
          <p className="text-sm font-medium" style={{ color: "#DC2626" }}>{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-2xl px-4 py-3 mt-4" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }} data-testid="production-success">
          <p className="text-sm font-medium" style={{ color: "#16A34A" }}>{success}</p>
        </div>
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
    <div className="flex items-center rounded-full p-1 gap-1" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }} data-testid={testId}>
      <button
        type="button"
        onClick={() => onStep(-1)}
        className="h-12 w-12 rounded-full flex items-center justify-center transition-colors tap-target"
        style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", color: "#334155" }}
        data-testid={testId ? `${testId}-minus` : undefined}
      >
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <Input
        type="number"
        step={step}
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-center font-black text-2xl tabular-nums border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-14 p-0"
        style={{ color: "#831843" }}
        data-testid={testId ? `${testId}-input` : undefined}
      />
      <button
        type="button"
        onClick={() => onStep(1)}
        className="h-12 w-12 rounded-full flex items-center justify-center text-white transition-colors tap-target"
        style={{ background: "#E85D8C", boxShadow: "0 2px 8px rgba(232,93,140,0.3)" }}
        data-testid={testId ? `${testId}-plus` : undefined}
      >
        <Plus size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
