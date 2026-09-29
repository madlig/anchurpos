"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChefHat, Package, Clock, Camera, Check, AlertTriangle, Plus, Trash2,
  ChevronLeft, Sparkles, Send, Copy, CheckCircle2, Loader2, Pause, Play,
  Layers, Flame, Box, ShieldCheck, Scale, Zap, Info
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Variant, FreezerRakStock } from "@/types";

interface CookingTargetItem {
  variantId: string;
  variantName: string;
  batches: number;
  loyang: number;
  pcs: number;
}

interface PrepackItem {
  variantId: string;
  variantName: string;
  regularPacks: number;
  fullPacks: number;
  loyangUsed: number;
}

interface SauceItem {
  ingredientId: string;
  ingredientName: string;
  outputPcs: number;
}

export default function CrewShiftReportPage() {
  const { user, getToken } = useAuth();
  const router = useRouter();

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<any | null>(null);
  const [copiedWa, setCopiedWa] = useState(false);

  // Master Data
  const [variants, setVariants] = useState<Variant[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; role: string }[]>([]);
  const [freezerRakList, setFreezerRakList] = useState<FreezerRakStock[]>([]);
  const [mainIngredients, setMainIngredients] = useState<{ id: string; name: string; unit: string; currentStock: number }[]>([]);

  // Shift Meta
  const [date, setDate] = useState(() => new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta" }).split(",")[0]);
  const [shiftMode, setShiftMode] = useState<"solo" | "duo">("solo");
  const [selectedCrew1, setSelectedCrew1] = useState("");
  const [selectedCrew2, setSelectedCrew2] = useState("");

  // SOP Sanitation Checklist
  const [openingSanitation, setOpeningSanitation] = useState(true);
  const [closingSanitation, setClosingSanitation] = useState(true);

  // 1-Tap Cooking Timer state
  const [cookingTimerState, setCookingTimerState] = useState<"idle" | "running" | "paused" | "finished">("idle");
  const [cookingStartMs, setCookingStartMs] = useState<number | null>(null);
  const [cookingElapsedSec, setCookingElapsedSec] = useState(0);
  const [cookingPauseMs, setCookingPauseMs] = useState(0);
  const [cookingLastPauseStart, setCookingLastPauseStart] = useState<number | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [recordedCookingMinutes, setRecordedCookingMinutes] = useState(0);

  // Activity Block Toggles
  const [hasCooking, setHasCooking] = useState(true);
  const [hasPrepack, setHasPrepack] = useState(false);
  const [hasSauce, setHasSauce] = useState(false);
  const [hasOrderPacking, setHasOrderPacking] = useState(false);
  const [hasRawOpname, setHasRawOpname] = useState(true);
  const [hasExtraTask, setHasExtraTask] = useState(false);

  // Activity 1: Cooking
  const [cookingTargets, setCookingTargets] = useState<CookingTargetItem[]>([
    { variantId: "", variantName: "Original", batches: 3, loyang: 12, pcs: 576 },
  ]);

  // Activity 2: Prepack
  const [prepackItems, setPrepackItems] = useState<PrepackItem[]>([]);

  // Activity 3: Sauce Repack
  const [sauceItems, setSauceItems] = useState<SauceItem[]>([]);

  // Activity 4: Order Packing
  const [orderPackingCount, setOrderPackingCount] = useState(0);
  const [orderPackingNotes, setOrderPackingNotes] = useState("");

  // Activity 5: Sisa Bahan Fisik (Opname)
  const [rawRemainings, setRawRemainings] = useState<Record<string, string>>({});
  const [flavorStatus, setFlavorStatus] = useState<Record<string, "aman" | "dikit_lagi" | "habis">>({
    "perasa-red-velvet": "dikit_lagi",
    "perasa-taro": "habis",
    "pewarna-taro": "dikit_lagi",
  });

  // Activity 6: Deep Cleaning / Extra Task
  const [isDeepCleaning, setIsDeepCleaning] = useState(false);
  const [extraTaskDesc, setExtraTaskDesc] = useState("");
  const [extraTaskDuration, setExtraTaskDuration] = useState("60");

  // General notes & photo
  const [notes, setNotes] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    });
  }, [getToken]);

  // Load initial data
  useEffect(() => {
    async function init() {
      setLoadingInitial(true);
      try {
        const [vRes, eRes, rRes, iRes] = await Promise.all([
          fetchWithAuth("/api/variants"),
          fetchWithAuth("/api/employees"),
          fetchWithAuth("/api/sfm/freezer-rak"),
          fetchWithAuth("/api/ingredients"),
        ]);

        if (vRes.ok) {
          const vData: Variant[] = await vRes.json();
          setVariants(vData);
          if (vData.length > 0) {
            setCookingTargets((prev) => [
              { ...prev[0], variantId: vData[0].id, variantName: vData[0].name },
            ]);
          }
        }

        if (eRes.ok) {
          const eData = await eRes.json();
          const activeCrews = eData.filter((e: any) => e.role === "crew" && e.isActive !== false);
          setEmployees(activeCrews);
          if (activeCrews.length > 0) {
            setSelectedCrew1(activeCrews[0].id);
            if (activeCrews.length > 1) setSelectedCrew2(activeCrews[1].id);
          }
        }

        if (rRes.ok) {
          setFreezerRakList(await rRes.json());
        }

        if (iRes.ok) {
          const allIng = await iRes.json();
          const mains = allIng.filter((i: any) =>
            ["mentega", "gula-pasir", "tepung-terigu", "telur", "vanili", "air", "garam"].some((keyword) =>
              i.id.includes(keyword) || i.name.toLowerCase().includes(keyword)
            )
          );
          setMainIngredients(mains);
        }
      } catch (err) {
        console.error("Init shift report error:", err);
      } finally {
        setLoadingInitial(false);
      }
    }
    init();
  }, [fetchWithAuth]);

  // Timer interval for cooking
  useEffect(() => {
    let interval: any;
    if (cookingTimerState === "running" && cookingStartMs) {
      interval = setInterval(() => {
        const now = Date.now();
        const activeMs = now - cookingStartMs - cookingPauseMs;
        setCookingElapsedSec(Math.max(0, Math.floor(activeMs / 1000)));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cookingTimerState, cookingStartMs, cookingPauseMs]);

  // Timer controls
  const handleStartTimer = () => {
    setCookingStartMs(Date.now());
    setCookingPauseMs(0);
    setCookingTimerState("running");
  };

  const handlePauseTimer = (reason: string) => {
    setCookingLastPauseStart(Date.now());
    setPauseReason(reason);
    setCookingTimerState("paused");
  };

  const handleResumeTimer = () => {
    if (cookingLastPauseStart) {
      const pDiff = Date.now() - cookingLastPauseStart;
      setCookingPauseMs((prev) => prev + pDiff);
    }
    setCookingTimerState("running");
  };

  const handleFinishTimer = () => {
    let finalSec = cookingElapsedSec;
    if (cookingStartMs && cookingTimerState === "running") {
      const activeMs = Date.now() - cookingStartMs - cookingPauseMs;
      finalSec = Math.max(0, Math.floor(activeMs / 1000));
    }
    const mins = Math.max(1, Math.round(finalSec / 60));
    setRecordedCookingMinutes(mins);
    setCookingTimerState("finished");
  };

  // Photo capture & client compression via HTML5 Canvas
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 960;
        let w = img.width;
        let h = img.height;
        if (w > h && w > MAX_DIM) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else if (h > MAX_DIM) {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          setPhotoBase64(compressed);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // Add cooking target row
  const addCookingTarget = () => {
    const defaultVar = variants[0];
    setCookingTargets([
      ...cookingTargets,
      { variantId: defaultVar?.id || "", variantName: defaultVar?.name || "Original", batches: 1, loyang: 4, pcs: 192 },
    ]);
  };

  const updateCookingTarget = (index: number, field: string, val: any) => {
    setCookingTargets((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: val };
      if (field === "batches") {
        const b = parseFloat(val) || 0;
        item.loyang = Math.round(b * 4); // ~12 loyang per 3 batches
        item.pcs = Math.round(b * 192);
      }
      if (field === "variantId") {
        const vObj = variants.find((v) => v.id === val);
        if (vObj) item.variantName = vObj.name;
      }
      next[index] = item;
      return next;
    });
  };

  const removeCookingTarget = (index: number) => {
    setCookingTargets((prev) => prev.filter((_, i) => i !== index));
  };

  // Add prepack item
  const addPrepackItem = () => {
    const defaultVar = variants[0];
    setPrepackItems([
      ...prepackItems,
      { variantId: defaultVar?.id || "", variantName: defaultVar?.name || "Original", regularPacks: 16, fullPacks: 0, loyangUsed: 4 },
    ]);
  };

  const updatePrepackItem = (index: number, field: string, val: any) => {
    setPrepackItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: val };
      if (field === "variantId") {
        const vObj = variants.find((v) => v.id === val);
        if (vObj) item.variantName = vObj.name;
      }
      next[index] = item;
      return next;
    });
  };

  // Overtime Calculation logic
  const totalCookingBatches = hasCooking ? cookingTargets.reduce((sum, t) => sum + (Number(t.batches) || 0), 0) : 0;
  const crewCount = shiftMode === "duo" ? 2 : 1;
  const maxNormalBatches = crewCount * 2; // standard 2 batches per person
  const isOvertimeBatches = totalCookingBatches > maxNormalBatches;
  const isOvertimeExtra = hasExtraTask && isDeepCleaning;
  const isEligibleOvertime = isOvertimeBatches || isOvertimeExtra;

  // Submit Shift Report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCrew1) {
      alert("Pilih minimal 1 kru yang bertugas");
      return;
    }

    const crewIds = shiftMode === "duo" ? [selectedCrew1, selectedCrew2].filter(Boolean) : [selectedCrew1];
    const crewNames = crewIds.map((id) => employees.find((e) => e.id === id)?.name || "Kru").filter(Boolean);

    const payload: any = {
      date,
      shiftMode,
      crewIds,
      crewNames,
      picDapurName: shiftMode === "duo" ? employees.find((e) => e.id === selectedCrew1)?.name : undefined,
      picPackingName: shiftMode === "duo" ? employees.find((e) => e.id === selectedCrew2)?.name : undefined,
      photoUrls: photoBase64 ? [photoBase64] : [],
      activities: {},
      rawMaterialRemaining: [],
      criticalFlavorsStatus: [],
      overtimeClaim: {
        isOvertimeEligible: isEligibleOvertime,
        reason: isOvertimeBatches
          ? `Produksi ${totalCookingBatches} adonan (> standar ${maxNormalBatches} adonan)`
          : isOvertimeExtra
          ? `Tugas ekstra: ${extraTaskDesc || "Deep cleaning"}`
          : "",
        status: "pending_owner",
      },
      notes,
      sopChecklist: {
        openingSanitationDone: openingSanitation,
        closingSanitationDone: closingSanitation,
      },
    };

    if (hasCooking && cookingTargets.length > 0) {
      payload.activities.cookingAndMolding = {
        targets: cookingTargets.map((t) => ({
          variantId: t.variantId,
          variantName: t.variantName,
          batches: Number(t.batches) || 0,
          loyang: Number(t.loyang) || 0,
          pcs: Number(t.pcs) || 0,
        })),
        durationMinutes: recordedCookingMinutes || (Math.max(1, Math.round(cookingElapsedSec / 60))),
        pauseMinutes: Math.round(cookingPauseMs / 60000),
        pauseReasons: pauseReason ? [pauseReason] : [],
      };
    }

    if (hasPrepack && prepackItems.length > 0) {
      payload.activities.thinwallPrepack = {
        items: prepackItems.map((p) => ({
          variantId: p.variantId,
          variantName: p.variantName,
          regularPacks: Number(p.regularPacks) || 0,
          fullPacks: Number(p.fullPacks) || 0,
          loyangUsed: Number(p.loyangUsed) || 0,
        })),
        durationMinutes: 30,
      };
    }

    if (hasSauce && sauceItems.length > 0) {
      payload.activities.sauceRepack = {
        items: sauceItems.map((s) => ({
          ingredientId: s.ingredientId,
          ingredientName: s.ingredientName,
          outputPcs: Number(s.outputPcs) || 0,
        })),
        durationMinutes: 20,
      };
    }

    if (hasOrderPacking && orderPackingCount > 0) {
      payload.activities.orderPacking = {
        totalPackagesPacked: Number(orderPackingCount),
        notes: orderPackingNotes,
      };
    }

    if (hasExtraTask) {
      payload.activities.deepCleaningAndExtra = {
        isDeepCleaning,
        description: extraTaskDesc,
        durationMinutes: Number(extraTaskDuration) || 60,
      };
    }

    // Raw remaining
    if (hasRawOpname) {
      payload.rawMaterialRemaining = Object.entries(rawRemainings).map(([ingId, val]) => {
        const ing = mainIngredients.find((i) => i.id === ingId);
        return {
          ingredientId: ingId,
          name: ing?.name || ingId,
          physicalStock: parseFloat(val) || 0,
          unit: ing?.unit || "gr",
        };
      });

      payload.criticalFlavorsStatus = Object.entries(flavorStatus).map(([id, st]) => {
        const label = id.replace("perasa-", "").replace("pewarna-", "").replace(/-/g, " ");
        return {
          ingredientId: id,
          name: `Toffieco ${label}`,
          status: st,
        };
      });
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/sfm/shift-reports", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const resData = await res.json();
        setSubmittedSuccess({
          ...payload,
          reportNumber: resData.reportNumber,
          speedScore: resData.speedScore,
        });
      } else {
        const err = await res.json();
        alert(err.error || "Gagal mengirim laporan shift");
      }
    } catch (err) {
      alert("Terjadi kesalahan koneksi");
    } finally {
      setSubmitting(false);
    }
  };

  // Generate WhatsApp summary text (matches Ajeng's format)
  const generateWaText = () => {
    if (!submittedSuccess) return "";
    const s = submittedSuccess;
    const dateFormatted = new Date(s.date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let lines = [`${dateFormatted}\n`];

    if (s.activities?.cookingAndMolding?.targets?.length > 0) {
      lines.push("Produksi");
      s.activities.cookingAndMolding.targets.forEach((t: any) => {
        lines.push(`• ${t.variantName} ${t.batches} adonan (${t.pcs} pcs)`);
      });
      lines.push("");
    }

    if (s.activities?.thinwallPrepack?.items?.length > 0) {
      lines.push("Prepack Thinwall");
      s.activities.thinwallPrepack.items.forEach((p: any) => {
        lines.push(`• ${p.variantName}: ${p.regularPacks} pack regular (isi 12), ${p.fullPacks} pack full (isi 16)`);
      });
      lines.push("");
    }

    if (s.rawMaterialRemaining?.length > 0 || s.criticalFlavorsStatus?.length > 0) {
      lines.push("Stock opname");
      s.rawMaterialRemaining.forEach((r: any) => {
        lines.push(`• ${r.name.toLowerCase()} ${r.physicalStock} ${r.unit}`);
      });
      s.criticalFlavorsStatus.forEach((f: any) => {
        const stStr = f.status === "habis" ? "habis" : f.status === "dikit_lagi" ? "dikit lagi" : "aman";
        lines.push(`• ${f.name.toLowerCase()} ${stStr}`);
      });
      lines.push("");
    }

    if (s.activities?.deepCleaningAndExtra?.isDeepCleaning) {
      lines.push(`Tugas Tambahan: ${s.activities.deepCleaningAndExtra.description || "Deep cleaning dapur"}\n`);
    }

    lines.push(`Petugas: ${s.crewNames.join(", ")}`);
    return lines.join("\n");
  };

  const copyToClipboard = () => {
    const text = generateWaText();
    navigator.clipboard.writeText(text);
    setCopiedWa(true);
    setTimeout(() => setCopiedWa(false), 3000);
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 max-w-xl mx-auto space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  // Success view
  if (submittedSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 max-w-xl mx-auto space-y-5 animate-in fade-in">
        <div className="bg-emerald-600 text-white rounded-3xl p-6 text-center shadow-lg space-y-3">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-black">Laporan Shift Terkirim!</h2>
          <p className="text-xs text-emerald-100 font-medium">
            Nomor: <span className="font-mono font-bold">{submittedSuccess.reportNumber}</span>
          </p>
          <div className="inline-flex items-center gap-2 bg-emerald-700/80 px-3 py-1.5 rounded-full text-xs font-bold">
            <Zap size={14} /> Skor Kecepatan: {submittedSuccess.speedScore}% (Optimal)
          </div>
        </div>

        {/* WhatsApp Preview Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-emerald-600" /> Ringkasan Format WhatsApp
            </span>
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black hover:bg-emerald-100 flex items-center gap-1 active:scale-95 transition-all"
            >
              {copiedWa ? <Check size={14} /> : <Copy size={14} />}
              {copiedWa ? "Tersalin!" : "Salin ke WA"}
            </button>
          </div>
          <pre className="bg-slate-50 p-3.5 rounded-2xl text-xs font-mono text-slate-700 whitespace-pre-wrap border border-slate-100 leading-relaxed max-h-60 overflow-y-auto">
            {generateWaText()}
          </pre>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/crew/sfm")}
            className="flex-1 py-3.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm active:scale-95 transition-all text-center"
          >
            Kembali ke Terminal
          </button>
          <button
            onClick={() => {
              setSubmittedSuccess(null);
              setPhotoBase64(null);
            }}
            className="px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm active:scale-95 transition-all"
          >
            Lapor Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28 px-4 pt-4 max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            href="/crew/sfm"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 active:scale-95"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-black text-slate-800 leading-tight">Laporan Shift Mandiri</h1>
            <p className="text-[11px] font-semibold text-slate-400">Pusat Catat Hasil Kerja Dapur</p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
          {new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card 1: Shift Meta & Kru */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider">1. Petugas Shift</label>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setShiftMode("solo")}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  shiftMode === "solo" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                Solo (1 Org)
              </button>
              <button
                type="button"
                onClick={() => setShiftMode("duo")}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  shiftMode === "duo" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                Duo (2 Org)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-1">
                {shiftMode === "duo" ? "PIC Stasiun Dapur (Masak)" : "Kru Utama"}
              </span>
              <select
                value={selectedCrew1}
                onChange={(e) => setSelectedCrew1(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            {shiftMode === "duo" && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">PIC Stasiun Packing (Prepack)</span>
                <select
                  value={selectedCrew2}
                  onChange={(e) => setSelectedCrew2(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* SOP Sanitasi Check */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-100">
              <input
                type="checkbox"
                checked={openingSanitation}
                onChange={(e) => setOpeningSanitation(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-0"
              />
              <span>SOP Buka: Hairnet, Masker, Meja Bersih</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-100">
              <input
                type="checkbox"
                checked={closingSanitation}
                onChange={(e) => setClosingSanitation(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-0"
              />
              <span>SOP Tutup: Cuci Alat, Pel Lantai</span>
            </label>
          </div>
        </div>

        {/* Card 2: 1-Tap Checkpoint Timer Masak Adonan */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={16} className="text-amber-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                Timer Masak Adonan (KPI)
              </span>
            </div>
            {cookingTimerState === "running" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-400/30 animate-pulse">
                • LIVE BERJALAN
              </span>
            )}
            {cookingTimerState === "paused" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-400/30">
                ⏸️ DIJEDA ({pauseReason})
              </span>
            )}
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-2xl font-black font-mono">
                {String(Math.floor(cookingElapsedSec / 60)).padStart(2, "0")}:
                {String(cookingElapsedSec % 60).padStart(2, "0")}
              </div>
              <p className="text-[10px] text-slate-400">
                Standar: ~45m per adonan • Beban: {totalCookingBatches} adonan
              </p>
            </div>

            <div className="flex gap-1.5">
              {cookingTimerState === "idle" && (
                <button
                  type="button"
                  onClick={handleStartTimer}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black active:scale-95 transition-all flex items-center gap-1"
                >
                  <Play size={14} /> Mulai Masak
                </button>
              )}

              {cookingTimerState === "running" && (
                <>
                  <button
                    type="button"
                    onClick={() => handlePauseTimer("Gas Habis / Istirahat")}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold active:scale-95"
                  >
                    <Pause size={14} /> Jeda
                  </button>
                  <button
                    type="button"
                    onClick={handleFinishTimer}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black active:scale-95"
                  >
                    Selesai Masak
                  </button>
                </>
              )}

              {cookingTimerState === "paused" && (
                <button
                  type="button"
                  onClick={handleResumeTimer}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black active:scale-95"
                >
                  <Play size={14} /> Lanjut
                </button>
              )}

              {cookingTimerState === "finished" && (
                <span className="text-xs font-black text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                  ✓ Tercatat {recordedCookingMinutes}m
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Checklist Aktivitas Shift (Tidak Kaku) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              2. Aktivitas Dikerjakan
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Pilih yang relevan</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: "cooking", label: "🍳 Masak Adonan", active: hasCooking, set: setHasCooking },
              { id: "prepack", label: "📦 Prepack Thinwall", active: hasPrepack, set: setHasPrepack },
              { id: "sauce", label: "🍯 Repack Saus", active: hasSauce, set: setHasSauce },
              { id: "packing", label: "🚚 Packing Order", active: hasOrderPacking, set: setHasOrderPacking },
              { id: "opname", label: "⚖️ Sisa Bahan", active: hasRawOpname, set: setHasRawOpname },
              { id: "extra", label: "🧹 Tugas Ekstra", active: hasExtraTask, set: setHasExtraTask },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => btn.set(!btn.active)}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between ${
                  btn.active
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span className="truncate">{btn.label}</span>
                {btn.active && <Check size={12} />}
              </button>
            ))}
          </div>

          {/* Sub-form A: Masak Adonan */}
          {hasCooking && (
            <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900">Masak & Cetak (Masuk Freezer Rak)</span>
                <button
                  type="button"
                  onClick={addCookingTarget}
                  className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded hover:bg-amber-300"
                >
                  + Tambah Varian
                </button>
              </div>

              {cookingTargets.map((target, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs space-y-2">
                  <div className="flex gap-2 items-center">
                    <select
                      value={target.variantId}
                      onChange={(e) => updateCookingTarget(idx, "variantId", e.target.value)}
                      className="flex-1 h-9 px-2 rounded-lg border border-slate-200 text-xs font-bold"
                    >
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    {cookingTargets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCookingTarget(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Adonan</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={target.batches}
                        onChange={(e) => updateCookingTarget(idx, "batches", e.target.value)}
                        className="w-full h-8 px-2 rounded border border-slate-200 text-xs font-bold text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Loyang (~12/3b)</span>
                      <input
                        type="number"
                        min="1"
                        value={target.loyang}
                        onChange={(e) => updateCookingTarget(idx, "loyang", e.target.value)}
                        className="w-full h-8 px-2 rounded border border-slate-200 text-xs font-bold text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Total Pcs</span>
                      <input
                        type="number"
                        min="1"
                        value={target.pcs}
                        onChange={(e) => updateCookingTarget(idx, "pcs", e.target.value)}
                        className="w-full h-8 px-2 rounded border border-slate-200 text-xs font-bold text-center"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sub-form B: Prepack Thinwall */}
          {hasPrepack && (
            <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-900">Prepack Thinwall (Pindah ke Freezer Peti)</span>
                <button
                  type="button"
                  onClick={addPrepackItem}
                  className="text-[10px] font-bold bg-blue-200 text-blue-900 px-2 py-0.5 rounded hover:bg-blue-300"
                >
                  + Tambah Item
                </button>
              </div>

              {prepackItems.length === 0 ? (
                <p className="text-xs text-blue-600/70 italic text-center py-2">
                  Klik + Tambah Item untuk mencatat thinwall yang diprepack
                </p>
              ) : (
                prepackItems.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={item.variantId}
                        onChange={(e) => updatePrepackItem(idx, "variantId", e.target.value)}
                        className="flex-1 h-9 px-2 rounded-lg border border-slate-200 text-xs font-bold"
                      >
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setPrepackItems(prepackItems.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">Reguler (12pcs)</span>
                        <input
                          type="number"
                          min="0"
                          value={item.regularPacks}
                          onChange={(e) => updatePrepackItem(idx, "regularPacks", e.target.value)}
                          className="w-full h-8 px-2 rounded border border-slate-200 text-xs font-bold text-center"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">Full (16pcs)</span>
                        <input
                          type="number"
                          min="0"
                          value={item.fullPacks}
                          onChange={(e) => updatePrepackItem(idx, "fullPacks", e.target.value)}
                          className="w-full h-8 px-2 rounded border border-slate-200 text-xs font-bold text-center"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">Loyang Dipakai</span>
                        <input
                          type="number"
                          min="0"
                          value={item.loyangUsed}
                          onChange={(e) => updatePrepackItem(idx, "loyangUsed", e.target.value)}
                          className="w-full h-8 px-2 rounded border border-slate-200 text-xs font-bold text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub-form D: Order Packing */}
          {hasOrderPacking && (
            <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-200/70 space-y-2">
              <span className="text-xs font-black text-purple-900 block">
                Packing Pesanan (Shopee / TikTok / B2B)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">Jumlah Paket Selesai</span>
                  <input
                    type="number"
                    min="0"
                    value={orderPackingCount}
                    onChange={(e) => setOrderPackingCount(parseInt(e.target.value) || 0)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-bold"
                    placeholder="Contoh: 15"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">Catatan Ekspedisi</span>
                  <input
                    type="text"
                    value={orderPackingNotes}
                    onChange={(e) => setOrderPackingNotes(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium"
                    placeholder="cth: 10 J&T, 5 SPX"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-form E: Timbangan Sisa Bahan Baku */}
          {hasRawOpname && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Scale size={14} className="text-slate-600" /> Timbangan Sisa Bahan Utama
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">Timbang fisik akhir shift</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {mainIngredients.slice(0, 6).map((ing) => (
                  <div key={ing.id} className="bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-[11px] font-bold text-slate-700 block truncate">{ing.name}</span>
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={rawRemainings[ing.id] ?? ""}
                        onChange={(e) => setRawRemainings({ ...rawRemainings, [ing.id]: e.target.value })}
                        className="w-full h-8 px-2 rounded border border-slate-200 text-xs font-bold"
                      />
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">{ing.unit || "gr"}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status Perasa Kritis */}
              <div className="pt-2 border-t border-slate-200/60 space-y-2">
                <span className="text-[11px] font-black text-slate-600 block">Status Perasa / Pewarna</span>
                <div className="space-y-1.5">
                  {[
                    { id: "perasa-red-velvet", name: "Toffieco Red Velvet" },
                    { id: "perasa-taro", name: "Toffieco Taro" },
                    { id: "pewarna-taro", name: "Pewarna Taro" },
                  ].map((p) => {
                    const st = flavorStatus[p.id] || "aman";
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 text-xs"
                      >
                        <span className="font-bold text-slate-700">{p.name}</span>
                        <div className="flex gap-1">
                          {(["aman", "dikit_lagi", "habis"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setFlavorStatus({ ...flavorStatus, [p.id]: s })}
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold capitalize transition-all ${
                                st === s
                                  ? s === "habis"
                                    ? "bg-red-500 text-white"
                                    : s === "dikit_lagi"
                                    ? "bg-amber-500 text-white"
                                    : "bg-emerald-600 text-white"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                              }`}
                            >
                              {s === "dikit_lagi" ? "Dikit" : s}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Sub-form F: Tugas Tambahan */}
          {hasExtraTask && (
            <div className="p-3.5 bg-rose-50/60 rounded-2xl border border-rose-200/70 space-y-2">
              <span className="text-xs font-black text-rose-900 block">Tugas Tambahan / Deep Cleaning</span>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={isDeepCleaning}
                  onChange={(e) => setIsDeepCleaning(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-0"
                />
                <span>Deep cleaning dapur / freezer peti</span>
              </label>
              <input
                type="text"
                value={extraTaskDesc}
                onChange={(e) => setExtraTaskDesc(e.target.value)}
                placeholder="Rincian pekerjaan ekstra..."
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs bg-white"
              />
            </div>
          )}
        </div>

        {/* Card 4: Overtime Status Indicator */}
        {isEligibleOvertime ? (
          <div className="bg-amber-500/10 border-2 border-amber-400/40 rounded-3xl p-4 flex items-start gap-3 animate-in fade-in">
            <Zap className="text-amber-500 mt-0.5 shrink-0" size={18} />
            <div className="text-xs">
              <span className="font-black text-amber-950 block">⚡ Memenuhi Kriteria Lemburan</span>
              <p className="text-amber-800/90 font-medium mt-0.5">
                {isOvertimeBatches &&
                  `Produksi ${totalCookingBatches} adonan melebihi batas standar normal shift (${maxNormalBatches} adonan). `}
                {isOvertimeExtra && "Tercatat ada tugas tambahan deep cleaning. "}
                Klaim ini akan masuk ke modul Payroll untuk persetujuan Owner.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-100/70 rounded-2xl p-3 text-center text-slate-500 text-[11px] font-semibold">
            Beban kerja: {totalCookingBatches} / {maxNormalBatches} adonan standar shift.
          </div>
        )}

        {/* Card 5: Foto Bukti Kerja */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Camera size={14} className="text-slate-600" /> Foto Bukti Shift (Wajib)
            </span>
            {photoBase64 && (
              <button
                type="button"
                onClick={() => setPhotoBase64(null)}
                className="text-[10px] text-red-500 font-bold hover:underline"
              >
                Hapus Foto
              </button>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoCapture}
            className="hidden"
          />

          {photoBase64 ? (
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
              <img src={photoBase64} alt="Bukti Shift" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1"
              >
                <Camera size={12} /> Ambil Ulang
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-500 transition-all active:scale-98"
            >
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                <Camera size={22} />
              </div>
              <span className="text-xs font-black text-slate-700">Jepret Foto Freezer / Meja Produksi</span>
              <span className="text-[10px] text-slate-400">Bukti visual kondisi loyang di freezer</span>
            </button>
          )}

          <div>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan untuk manajer/owner (opsional)..."
              className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Sticky Submit Bar on Mobile */}
        <div className="fixed bottom-0 left-0 right-0 p-3.5 bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="max-w-xl mx-auto">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Kirim Laporan Shift
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
