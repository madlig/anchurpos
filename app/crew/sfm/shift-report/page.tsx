"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChefHat, Package, Clock, Camera, Check, AlertTriangle, Plus, Trash2,
  ChevronLeft, Sparkles, Send, Copy, CheckCircle2, Loader2, Pause, Play,
  Layers, Flame, Box, ShieldCheck, Scale, Zap, Info, Truck, HelpCircle,
  CheckSquare, Square
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Variant, FreezerRakStock } from "@/types";

// Standard Cycle Times for automatic duration estimation
const STD_COOKING_MIN_PER_BATCH = 45;
const STD_PREPACK_MIN_PER_PACK = 1.5;
const STD_SAUCE_MIN_PER_CUP = 0.6;
const STD_SUGAR_MIN_PER_PACK = 0.5;
const STD_ORDER_PACKING_MIN_PER_PKG = 3.0;

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
  cupSize: string;
  durationMinutes: number;
}

interface SugarItem {
  ingredientId: string;
  sugarType: string;
  outputPacks: number;
  weightPerPack: string;
  durationMinutes: number;
}

const COMMON_SAUCE_FLAVORS = [
  { id: "glaze-coklat", name: "Glaze Coklat" },
  { id: "glaze-keju", name: "Glaze Keju" },
  { id: "glaze-tiramisu", name: "Glaze Tiramisu" },
  { id: "glaze-matcha", name: "Glaze Matcha" },
  { id: "glaze-strawberry", name: "Glaze Strawberry" },
  { id: "glaze-taro", name: "Glaze Taro" },
  { id: "glaze-vanilla", name: "Glaze Vanilla" },
];

const COMMON_SUGAR_TYPES = [
  { id: "sugar-snow", name: "Gula Halus (Snow Sugar)" },
  { id: "sugar-cinnamon", name: "Cinnamon Sugar (Kayu Manis)" },
  { id: "sugar-palm", name: "Palm Sugar (Gula Aren)" },
];

const COURIER_OPTIONS = ["J&T Express", "Shopee Xpress (SPX)", "SiCepat", "Paxel", "GoSend / Grab Instant"];

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

  // SOP Sanitasi Awal (Buka)
  const [openingHairnet, setOpeningHairnet] = useState(true);
  const [openingMasker, setOpeningMasker] = useState(true);
  const [openingCuciTangan, setOpeningCuciTangan] = useState(true);
  const [openingLapMeja, setOpeningLapMeja] = useState(true);

  // Master Shift Duration (Optional Timer)
  const [shiftTimerActive, setShiftTimerActive] = useState(false);
  const [shiftTimerStartMs, setShiftTimerStartMs] = useState<number | null>(null);
  const [shiftTimerElapsedSec, setShiftTimerElapsedSec] = useState(0);
  const [operationalPauseMinutes, setOperationalPauseMinutes] = useState(0);
  const [operationalPauseReason, setOperationalPauseReason] = useState("");

  // Activity Station Toggles
  const [hasCooking, setHasCooking] = useState(true);
  const [hasPrepack, setHasPrepack] = useState(false);
  const [hasSauce, setHasSauce] = useState(false);
  const [hasSugar, setHasSugar] = useState(false);
  const [hasOrderPacking, setHasOrderPacking] = useState(false);
  const [hasRawOpname, setHasRawOpname] = useState(true);
  const [hasExtraTask, setHasExtraTask] = useState(false);

  // Stasiun 1: Masak Adonan
  const [cookingTargets, setCookingTargets] = useState<CookingTargetItem[]>([
    { variantId: "", variantName: "Original", batches: 3, loyang: 12, pcs: 576 },
  ]);
  const [cookingDurationMinutes, setCookingDurationMinutes] = useState<number>(135);

  // Stasiun 2: Prepack Thinwall
  const [prepackItems, setPrepackItems] = useState<PrepackItem[]>([]);
  const [prepackDurationMinutes, setPrepackDurationMinutes] = useState<number>(30);

  // Stasiun 3: Repack Saus
  const [sauceItems, setSauceItems] = useState<SauceItem[]>([
    { ingredientId: "glaze-coklat", ingredientName: "Glaze Coklat", outputPcs: 50, cupSize: "25ml", durationMinutes: 30 },
  ]);
  const [sauceDurationMinutes, setSauceDurationMinutes] = useState<number>(30);

  // Stasiun 4: Repack Gula
  const [sugarItems, setSugarItems] = useState<SugarItem[]>([
    { ingredientId: "sugar-snow", sugarType: "Gula Halus (Snow Sugar)", outputPacks: 30, weightPerPack: "25gr", durationMinutes: 20 },
  ]);
  const [sugarDurationMinutes, setSugarDurationMinutes] = useState<number>(20);

  // Stasiun 5: Packing Order
  const [orderShopee, setOrderShopee] = useState(0);
  const [orderTiktok, setOrderTiktok] = useState(0);
  const [orderWhatsappB2b, setOrderWhatsappB2b] = useState(0);
  const [selectedCouriers, setSelectedCouriers] = useState<string[]>(["J&T Express"]);
  const [orderPackingNotes, setOrderPackingNotes] = useState("");
  const [orderPackingDurationMinutes, setOrderPackingDurationMinutes] = useState<number>(30);

  const totalOrderPackages = useMemo(() => {
    return (Number(orderShopee) || 0) + (Number(orderTiktok) || 0) + (Number(orderWhatsappB2b) || 0);
  }, [orderShopee, orderTiktok, orderWhatsappB2b]);

  // Stasiun 6: Sisa Bahan Fisik (Opname)
  const [rawRemainings, setRawRemainings] = useState<Record<string, string>>({});
  const [flavorStatus, setFlavorStatus] = useState<Record<string, "aman" | "dikit_lagi" | "habis">>({
    "perasa-red-velvet": "dikit_lagi",
    "perasa-taro": "habis",
    "pewarna-taro": "dikit_lagi",
  });

  // Stasiun 7: SOP Tutup (Pembersihan & Closing)
  const [closingCuciAlat, setClosingCuciAlat] = useState(true);
  const [closingPelLantai, setClosingPelLantai] = useState(true);
  const [closingMatikanKompor, setClosingMatikanKompor] = useState(true);
  const [closingMatikanLampu, setClosingMatikanLampu] = useState(true);
  const [closingKunciFreezer, setClosingKunciFreezer] = useState(true);
  const [closingKunciPintu, setClosingKunciPintu] = useState(true);

  // Extra Task / Deep Cleaning
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
          fetchWithAuth("/api/employees").catch(() => null),
          fetchWithAuth("/api/sfm/freezer-rak").catch(() => null),
          fetchWithAuth("/api/ingredients").catch(() => null),
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

        if (eRes && eRes.ok) {
          const eData = await eRes.json();
          const activeCrews = Array.isArray(eData) ? eData.filter((e: any) => e.role === "crew" && e.isActive !== false) : [];
          setEmployees(activeCrews);
          if (activeCrews.length > 0) {
            const myEmp = activeCrews.find((e: any) => e.id === user?.uid);
            const defaultCrew1 = myEmp ? myEmp.id : activeCrews[0].id;
            setSelectedCrew1(defaultCrew1);
            if (activeCrews.length > 1) {
              const otherCrew = activeCrews.find((e: any) => e.id !== defaultCrew1);
              setSelectedCrew2(otherCrew ? otherCrew.id : activeCrews[1].id);
            }
          }
        } else {
          // Fallback if role is restricted or empty
          if (user) {
            setEmployees([{ id: user.uid, name: user.displayName || "Kru Shift", role: "crew" }]);
            setSelectedCrew1(user.uid);
          }
        }

        if (rRes && rRes.ok) {
          setFreezerRakList(await rRes.json());
        }

        if (iRes && iRes.ok) {
          const allIng = await iRes.json();
          const mains = Array.isArray(allIng) ? allIng.filter((i: any) =>
            ["mentega", "gula-pasir", "tepung-terigu", "telur", "vanili", "air", "garam"].some((keyword) =>
              i.id?.includes(keyword) || i.name?.toLowerCase().includes(keyword)
            )
          ) : [];
          setMainIngredients(mains);

          const initRemainings: Record<string, string> = {};
          mains.forEach((m: any) => {
            initRemainings[m.id] = String(m.currentStock || 0);
          });
          setRawRemainings(initRemainings);
        }
      } catch (err) {
        console.error("Shift report init error:", err);
      } finally {
        setLoadingInitial(false);
      }
    }

    init();
  }, [fetchWithAuth, user]);

  // Master Shift Timer interval
  useEffect(() => {
    let timer: any;
    if (shiftTimerActive && shiftTimerStartMs) {
      timer = setInterval(() => {
        setShiftTimerElapsedSec(Math.floor((Date.now() - shiftTimerStartMs) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [shiftTimerActive, shiftTimerStartMs]);

  // Update total estimated batches & auto update recommended cooking minutes
  const totalCookingBatches = useMemo(() => {
    return cookingTargets.reduce((sum, t) => sum + (Number(t.batches) || 0), 0);
  }, [cookingTargets]);

  useEffect(() => {
    if (totalCookingBatches > 0) {
      setCookingDurationMinutes(Math.round(totalCookingBatches * STD_COOKING_MIN_PER_BATCH));
    }
  }, [totalCookingBatches]);

  // Helper functions for Cooking Targets
  const addCookingTarget = () => {
    const defaultVar = variants[0];
    setCookingTargets([
      ...cookingTargets,
      { variantId: defaultVar?.id || "", variantName: defaultVar?.name || "Varian", batches: 1, loyang: 4, pcs: 192 },
    ]);
  };

  const removeCookingTarget = (idx: number) => {
    setCookingTargets(cookingTargets.filter((_, i) => i !== idx));
  };

  const updateCookingTarget = (idx: number, field: keyof CookingTargetItem, val: any) => {
    const updated = [...cookingTargets];
    if (field === "variantId") {
      const v = variants.find((item) => item.id === val);
      updated[idx].variantId = val;
      updated[idx].variantName = v?.name || val;
    } else if (field === "batches") {
      const num = parseFloat(val) || 0;
      updated[idx].batches = num;
      // 1 adonan = 11-13 loyang (approx 4 loyang per 1 batch jika batch = 1 adonan)
      updated[idx].loyang = Math.round(num * 12);
      updated[idx].pcs = Math.round(num * 192);
    } else {
      (updated[idx] as any)[field] = val;
    }
    setCookingTargets(updated);
  };

  // Helper functions for Prepack Items
  const addPrepackItem = () => {
    const defaultVar = variants[0];
    setPrepackItems([
      ...prepackItems,
      { variantId: defaultVar?.id || "", variantName: defaultVar?.name || "Varian", regularPacks: 16, fullPacks: 0, loyangUsed: 4 },
    ]);
  };

  const updatePrepackItem = (idx: number, field: keyof PrepackItem, val: any) => {
    const updated = [...prepackItems];
    if (field === "variantId") {
      const v = variants.find((item) => item.id === val);
      updated[idx].variantId = val;
      updated[idx].variantName = v?.name || val;
    } else {
      (updated[idx] as any)[field] = val;
    }
    setPrepackItems(updated);
  };

  // Helper functions for Sauce Items
  const addSauceItem = () => {
    const nextSauce = COMMON_SAUCE_FLAVORS[sauceItems.length % COMMON_SAUCE_FLAVORS.length];
    setSauceItems([
      ...sauceItems,
      { ingredientId: nextSauce.id, ingredientName: nextSauce.name, outputPcs: 30, cupSize: "25ml", durationMinutes: 20 },
    ]);
  };

  const updateSauceItem = (idx: number, field: keyof SauceItem, val: any) => {
    const updated = [...sauceItems];
    if (field === "ingredientId") {
      const s = COMMON_SAUCE_FLAVORS.find((item) => item.id === val);
      updated[idx].ingredientId = val;
      updated[idx].ingredientName = s?.name || val;
    } else {
      (updated[idx] as any)[field] = val;
    }
    setSauceItems(updated);
  };

  // Helper functions for Sugar Items
  const addSugarItem = () => {
    const nextSugar = COMMON_SUGAR_TYPES[sugarItems.length % COMMON_SUGAR_TYPES.length];
    setSugarItems([
      ...sugarItems,
      { ingredientId: nextSugar.id, sugarType: nextSugar.name, outputPacks: 25, weightPerPack: "25gr", durationMinutes: 15 },
    ]);
  };

  const updateSugarItem = (idx: number, field: keyof SugarItem, val: any) => {
    const updated = [...sugarItems];
    if (field === "ingredientId") {
      const s = COMMON_SUGAR_TYPES.find((item) => item.id === val);
      updated[idx].ingredientId = val;
      updated[idx].sugarType = s?.name || val;
    } else {
      (updated[idx] as any)[field] = val;
    }
    setSugarItems(updated);
  };

  // Toggle courier selection
  const toggleCourier = (courier: string) => {
    if (selectedCouriers.includes(courier)) {
      setSelectedCouriers(selectedCouriers.filter((c) => c !== courier));
    } else {
      setSelectedCouriers([...selectedCouriers, courier]);
    }
  };

  // Photo compression on client
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 1280;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        setPhotoBase64(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCrew1) {
      alert("Pilih minimal 1 kru penanggung jawab shift!");
      return;
    }

    const crewIds = [selectedCrew1];
    const crewNames = [employees.find((e) => e.id === selectedCrew1)?.name || user?.displayName || "Kru 1"];
    if (shiftMode === "duo" && selectedCrew2) {
      crewIds.push(selectedCrew2);
      crewNames.push(employees.find((e) => e.id === selectedCrew2)?.name || "Kru 2");
    }

    const payload: any = {
      date,
      shiftMode,
      crewIds,
      crewNames,
      picDapurId: selectedCrew1,
      picDapurName: crewNames[0],
      picPackingId: shiftMode === "duo" ? selectedCrew2 : selectedCrew1,
      picPackingName: shiftMode === "duo" ? crewNames[1] : crewNames[0],
      photoUrls: photoBase64 ? [photoBase64] : [],
      activities: {},
      rawMaterialRemaining: [],
      criticalFlavorsStatus: [],
      notes,
      sopChecklist: {
        openingSanitationDone: openingHairnet && openingMasker && openingCuciTangan && openingLapMeja,
        closingSanitationDone: closingCuciAlat && closingPelLantai && closingMatikanKompor && closingMatikanLampu && closingKunciFreezer && closingKunciPintu,
      },
    };

    // Activity 1: Cooking
    if (hasCooking && cookingTargets.length > 0) {
      payload.activities.cookingAndMolding = {
        targets: cookingTargets.map((t) => ({
          variantId: t.variantId,
          variantName: t.variantName,
          batches: Number(t.batches) || 0,
          loyang: Number(t.loyang) || 0,
          pcs: Number(t.pcs) || 0,
        })),
        durationMinutes: cookingDurationMinutes || 135,
        pauseMinutes: operationalPauseMinutes || 0,
        pauseReasons: operationalPauseReason ? [operationalPauseReason] : [],
      };
    }

    // Activity 2: Prepack
    if (hasPrepack && prepackItems.length > 0) {
      payload.activities.thinwallPrepack = {
        items: prepackItems.map((p) => ({
          variantId: p.variantId,
          variantName: p.variantName,
          regularPacks: Number(p.regularPacks) || 0,
          fullPacks: Number(p.fullPacks) || 0,
          loyangUsed: Number(p.loyangUsed) || 0,
        })),
        durationMinutes: prepackDurationMinutes || 30,
      };
    }

    // Activity 3: Sauce Repack
    if (hasSauce && sauceItems.length > 0) {
      payload.activities.sauceRepack = {
        items: sauceItems.map((s) => ({
          ingredientId: s.ingredientId,
          ingredientName: s.ingredientName,
          outputPcs: Number(s.outputPcs) || 0,
          cupSize: s.cupSize,
        })),
        durationMinutes: sauceDurationMinutes || 30,
      };
    }

    // Activity 4: Sugar Repack
    if (hasSugar && sugarItems.length > 0) {
      payload.activities.sugarRepack = {
        items: sugarItems.map((s) => ({
          ingredientId: s.ingredientId,
          sugarType: s.sugarType,
          outputPacks: Number(s.outputPacks) || 0,
          weightPerPack: s.weightPerPack,
        })),
        durationMinutes: sugarDurationMinutes || 20,
      };
    }

    // Activity 5: Order Packing
    if (hasOrderPacking && totalOrderPackages > 0) {
      payload.activities.orderPacking = {
        totalPackagesPacked: totalOrderPackages,
        breakdown: {
          shopee: Number(orderShopee) || 0,
          tiktok: Number(orderTiktok) || 0,
          whatsappB2b: Number(orderWhatsappB2b) || 0,
        },
        expeditions: selectedCouriers,
        notes: orderPackingNotes,
        durationMinutes: orderPackingDurationMinutes || 30,
      };
    }

    // Extra Tasks
    if (hasExtraTask) {
      payload.activities.deepCleaningAndExtra = {
        isDeepCleaning,
        description: extraTaskDesc || "Tugas tambahan luar jadwal",
        durationMinutes: Number(extraTaskDuration) || 60,
      };
    }

    // Raw remaining opname
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

  // Generate WhatsApp summary text (matches Ajeng's real group report format)
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

    if (s.activities?.sauceRepack?.items?.length > 0) {
      lines.push("Repack Saus");
      s.activities.sauceRepack.items.forEach((sau: any) => {
        lines.push(`• ${sau.ingredientName}: ${sau.outputPcs} cup (${sau.cupSize || "25ml"})`);
      });
      lines.push("");
    }

    if (s.activities?.sugarRepack?.items?.length > 0) {
      lines.push("Repack Gula");
      s.activities.sugarRepack.items.forEach((sug: any) => {
        lines.push(`• ${sug.sugarType}: ${sug.outputPacks} pouch (${sug.weightPerPack || "25gr"})`);
      });
      lines.push("");
    }

    if (s.activities?.orderPacking?.totalPackagesPacked > 0) {
      const op = s.activities.orderPacking;
      lines.push(`Packing Pesanan: ${op.totalPackagesPacked} paket`);
      if (op.breakdown) {
        lines.push(`• Shopee: ${op.breakdown.shopee || 0}, TikTok: ${op.breakdown.tiktok || 0}, WA/B2B: ${op.breakdown.whatsappB2b || 0}`);
      }
      if (op.expeditions?.length > 0) {
        lines.push(`• Ekspedisi: ${op.expeditions.join(", ")}`);
      }
      lines.push("");
    }

    if (s.rawMaterialRemaining?.length > 0 || s.criticalFlavorsStatus?.length > 0) {
      lines.push("Stock opname sisa");
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
    <div className="min-h-screen bg-slate-50/70 pb-32 px-4 pt-4 max-w-xl mx-auto space-y-4">
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
            <h1 className="text-base font-black text-slate-800 leading-tight">Laporan Shift Dapur</h1>
            <p className="text-[11px] font-semibold text-slate-400">Catat Hasil Kerja & Output Harian</p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
          {new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card 1: Shift Meta & Kru & SOP Buka */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              1. Identitas Kru & SOP Buka
            </span>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setShiftMode("solo")}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  shiftMode === "solo" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                }`}
              >
                Solo (1 Orang)
              </button>
              <button
                type="button"
                onClick={() => setShiftMode("duo")}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  shiftMode === "duo" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                }`}
              >
                Duo (2 Orang)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">
                {shiftMode === "solo" ? "Kru Penanggung Jawab" : "Kru 1 (Stasiun Dapur)"}
              </label>
              <select
                value={selectedCrew1}
                onChange={(e) => setSelectedCrew1(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:ring-2 focus:ring-slate-900/10"
                required
              >
                {employees.length === 0 ? (
                  <option value="">Tidak ada opsi kru</option>
                ) : (
                  employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {shiftMode === "duo" && (
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Kru 2 (Stasiun Packing / Bantuan)
                </label>
                <select
                  value={selectedCrew2}
                  onChange={(e) => setSelectedCrew2(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:ring-2 focus:ring-slate-900/10"
                  required
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

          {/* SOP BUKA (Sanitasi Awal) */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" /> Checklist SOP Buka Shift
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  checked={openingHairnet}
                  onChange={(e) => setOpeningHairnet(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0"
                />
                <span className="text-[11px]">Pakai Hairnet</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  checked={openingMasker}
                  onChange={(e) => setOpeningMasker(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0"
                />
                <span className="text-[11px]">Pakai Masker</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  checked={openingCuciTangan}
                  onChange={(e) => setOpeningCuciTangan(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0"
                />
                <span className="text-[11px]">Cuci Tangan & Kaki</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  checked={openingLapMeja}
                  onChange={(e) => setOpeningLapMeja(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0"
                />
                <span className="text-[11px]">Lap Meja Kerja</span>
              </label>
            </div>
          </div>
        </div>

        {/* Card 2: Pemilihan Stasiun Pekerjaan (Elegan & Profesional) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              2. Pilih Stasiun yang Dikerjakan
            </span>
            <span className="text-[10px] text-slate-400 font-bold">Pilih sesuai shift hari ini</span>
          </div>

          {/* Station Selector Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { id: "cooking", label: "Masak Adonan", icon: ChefHat, active: hasCooking, set: setHasCooking, color: "text-amber-600" },
              { id: "prepack", label: "Prepack Thinwall", icon: Package, active: hasPrepack, set: setHasPrepack, color: "text-blue-600" },
              { id: "sauce", label: "Repack Saus", icon: Flame, active: hasSauce, set: setHasSauce, color: "text-rose-600" },
              { id: "sugar", label: "Repack Gula", icon: Sparkles, active: hasSugar, set: setHasSugar, color: "text-amber-500" },
              { id: "packing", label: "Packing Order", icon: Truck, active: hasOrderPacking, set: setHasOrderPacking, color: "text-purple-600" },
              { id: "opname", label: "Sisa Bahan Fisik", icon: Scale, active: hasRawOpname, set: setHasRawOpname, color: "text-emerald-600" },
            ].map((st) => {
              const Icon = st.icon;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => st.set(!st.active)}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between h-20 active:scale-95 ${
                    st.active
                      ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                      : "bg-slate-50/80 border-slate-200 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Icon size={16} className={st.active ? "text-amber-400" : st.color} />
                    {st.active ? <Check size={14} className="text-emerald-400 font-black" /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                  </div>
                  <span className="text-xs font-black leading-tight">{st.label}</span>
                </button>
              );
            })}
          </div>

          {/* Kendala / Jeda Operasional (Tidak Memotong KPI) */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
              <Clock size={13} className="text-amber-600" /> Jeda / Kendala Dapur (Opsional)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Waktu Terhambat</label>
                <div className="flex gap-1">
                  {[0, 15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setOperationalPauseMinutes(m)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-black border transition-all ${
                        operationalPauseMinutes === m
                          ? "bg-amber-500 text-white border-amber-600"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      {m === 0 ? "Nol" : `${m}m`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Alasan Kendala</label>
                <input
                  type="text"
                  placeholder="Misal: Gas habis, mati lampu..."
                  value={operationalPauseReason}
                  onChange={(e) => setOperationalPauseReason(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========== SUB-FORM 1: MASAK ADONAN ========== */}
        {hasCooking && (
          <div className="bg-white rounded-3xl p-5 border border-amber-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-amber-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <ChefHat size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    Stasiun 1: Masak Adonan
                  </h3>
                  <p className="text-[10px] text-amber-700 font-medium">Bahan dipotong & hasil masuk Freezer Rak</p>
                </div>
              </div>
              <button
                type="button"
                onClick={addCookingTarget}
                className="text-[11px] font-bold bg-amber-500 text-white px-2.5 py-1 rounded-xl hover:bg-amber-600 flex items-center gap-1 active:scale-95"
              >
                <Plus size={12} /> Varian
              </button>
            </div>

            {cookingTargets.map((target, idx) => (
              <div key={idx} className="bg-amber-50/50 p-3 rounded-2xl border border-amber-200/70 space-y-2">
                <div className="flex gap-2 items-center">
                  <select
                    value={target.variantId}
                    onChange={(e) => updateCookingTarget(idx, "variantId", e.target.value)}
                    className="flex-1 h-9 px-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
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
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-2 rounded-xl border border-amber-100">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Jumlah Adonan</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={target.batches}
                      onChange={(e) => updateCookingTarget(idx, "batches", e.target.value)}
                      className="w-full text-center text-sm font-black text-amber-900 border-0 outline-none"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-amber-100">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Loyang Cetak</span>
                    <input
                      type="number"
                      min="1"
                      value={target.loyang}
                      onChange={(e) => updateCookingTarget(idx, "loyang", e.target.value)}
                      className="w-full text-center text-sm font-black text-amber-900 border-0 outline-none"
                    />
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-amber-100">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Total Pcs</span>
                    <input
                      type="number"
                      min="1"
                      value={target.pcs}
                      onChange={(e) => updateCookingTarget(idx, "pcs", e.target.value)}
                      className="w-full text-center text-sm font-black text-amber-900 border-0 outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Quick Duration Selector for Cooking (Zero Friction) */}
            <div className="pt-2 border-t border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-amber-900">
                Durasi Masak: <strong className="text-amber-950 font-black">{cookingDurationMinutes} Menit</strong>
                <span className="text-[10px] text-amber-700/80 block">Standar: ~45m per adonan</span>
              </span>
              <div className="flex gap-1 flex-wrap">
                {[60, 90, 120, 135, 150, 180].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setCookingDurationMinutes(mins)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border ${
                      cookingDurationMinutes === mins
                        ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                        : "bg-white text-slate-700 border-amber-200"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== SUB-FORM 2: PREPACK THINWALL ========== */}
        {hasPrepack && (
          <div className="bg-white rounded-3xl p-5 border border-blue-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-blue-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Package size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-blue-950 uppercase tracking-wide">
                    Stasiun 2: Prepack Thinwall
                  </h3>
                  <p className="text-[10px] text-blue-700 font-medium">Dari Freezer Rak masuk ke Freezer Peti Toko</p>
                </div>
              </div>
              <button
                type="button"
                onClick={addPrepackItem}
                className="text-[11px] font-bold bg-blue-500 text-white px-2.5 py-1 rounded-xl hover:bg-blue-600 flex items-center gap-1 active:scale-95"
              >
                <Plus size={12} /> Item
              </button>
            </div>

            {prepackItems.length === 0 ? (
              <p className="text-xs text-blue-600/70 italic text-center py-2">
                Tekan tombol + Item untuk mencatat thinwall yang diprepack
              </p>
            ) : (
              prepackItems.map((item, idx) => (
                <div key={idx} className="bg-blue-50/50 p-3 rounded-2xl border border-blue-200/70 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={item.variantId}
                      onChange={(e) => updatePrepackItem(idx, "variantId", e.target.value)}
                      className="flex-1 h-9 px-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
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
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Reguler (12pcs)</span>
                      <input
                        type="number"
                        min="0"
                        value={item.regularPacks}
                        onChange={(e) => updatePrepackItem(idx, "regularPacks", e.target.value)}
                        className="w-full text-center text-sm font-black text-blue-900 border-0 outline-none"
                      />
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Full (16pcs)</span>
                      <input
                        type="number"
                        min="0"
                        value={item.fullPacks}
                        onChange={(e) => updatePrepackItem(idx, "fullPacks", e.target.value)}
                        className="w-full text-center text-sm font-black text-blue-900 border-0 outline-none"
                      />
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Loyang Terpakai</span>
                      <input
                        type="number"
                        min="0"
                        value={item.loyangUsed}
                        onChange={(e) => updatePrepackItem(idx, "loyangUsed", e.target.value)}
                        className="w-full text-center text-sm font-black text-blue-900 border-0 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Quick Duration Selector for Prepack */}
            <div className="pt-2 border-t border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-blue-900">
                Durasi Prepack: <strong className="text-blue-950 font-black">{prepackDurationMinutes} Menit</strong>
              </span>
              <div className="flex gap-1 flex-wrap">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setPrepackDurationMinutes(mins)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border ${
                      prepackDurationMinutes === mins
                        ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                        : "bg-white text-slate-700 border-blue-200"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== SUB-FORM 3: REPACK SAUS ========== */}
        {hasSauce && (
          <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
                  <Flame size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-rose-950 uppercase tracking-wide">
                    Stasiun 3: Repack Saus (Cup)
                  </h3>
                  <p className="text-[10px] text-rose-700 font-medium">Bahan curah glaze dipindah ke cup kecil</p>
                </div>
              </div>
              <button
                type="button"
                onClick={addSauceItem}
                className="text-[11px] font-bold bg-rose-500 text-white px-2.5 py-1 rounded-xl hover:bg-rose-600 flex items-center gap-1 active:scale-95"
              >
                <Plus size={12} /> Saus
              </button>
            </div>

            {sauceItems.map((item, idx) => (
              <div key={idx} className="bg-rose-50/50 p-3 rounded-2xl border border-rose-200/70 space-y-2">
                <div className="flex gap-2 items-center">
                  <select
                    value={item.ingredientId}
                    onChange={(e) => updateSauceItem(idx, "ingredientId", e.target.value)}
                    className="flex-1 h-9 px-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    {COMMON_SAUCE_FLAVORS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={item.cupSize}
                    onChange={(e) => updateSauceItem(idx, "cupSize", e.target.value)}
                    className="w-24 h-9 px-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    <option value="25ml">Cup 25ml</option>
                    <option value="35ml">Cup 35ml</option>
                  </select>
                  {sauceItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSauceItems(sauceItems.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="bg-white p-2 rounded-xl border border-rose-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500">Jumlah Cup Terisi:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      value={item.outputPcs}
                      onChange={(e) => updateSauceItem(idx, "outputPcs", parseInt(e.target.value) || 0)}
                      className="w-20 text-center text-sm font-black text-rose-900 border border-slate-200 rounded-lg py-1"
                    />
                    <span className="text-xs font-bold text-slate-400">Cup</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Quick Duration for Sauce Repack */}
            <div className="pt-2 border-t border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-rose-900">
                Durasi Repack Saus: <strong className="text-rose-950 font-black">{sauceDurationMinutes} Menit</strong>
              </span>
              <div className="flex gap-1 flex-wrap">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSauceDurationMinutes(mins)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border ${
                      sauceDurationMinutes === mins
                        ? "bg-rose-600 text-white border-rose-700 shadow-2xs"
                        : "bg-white text-slate-700 border-rose-200"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== SUB-FORM 4: REPACK GULA ========== */}
        {hasSugar && (
          <div className="bg-white rounded-3xl p-5 border border-amber-300 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-amber-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    Stasiun 4: Repack Gula (Pouch)
                  </h3>
                  <p className="text-[10px] text-amber-700 font-medium">Pengemasan gula tabur ke pouch kecil</p>
                </div>
              </div>
              <button
                type="button"
                onClick={addSugarItem}
                className="text-[11px] font-bold bg-amber-500 text-white px-2.5 py-1 rounded-xl hover:bg-amber-600 flex items-center gap-1 active:scale-95"
              >
                <Plus size={12} /> Gula
              </button>
            </div>

            {sugarItems.map((item, idx) => (
              <div key={idx} className="bg-amber-50/50 p-3 rounded-2xl border border-amber-200/70 space-y-2">
                <div className="flex gap-2 items-center">
                  <select
                    value={item.ingredientId}
                    onChange={(e) => updateSugarItem(idx, "ingredientId", e.target.value)}
                    className="flex-1 h-9 px-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    {COMMON_SUGAR_TYPES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={item.weightPerPack}
                    onChange={(e) => updateSugarItem(idx, "weightPerPack", e.target.value)}
                    className="w-24 h-9 px-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    <option value="25gr">25 gram</option>
                    <option value="50gr">50 gram</option>
                    <option value="100gr">100 gram</option>
                  </select>
                  {sugarItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSugarItems(sugarItems.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="bg-white p-2 rounded-xl border border-amber-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500">Jumlah Pouch Terisi:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      value={item.outputPacks}
                      onChange={(e) => updateSugarItem(idx, "outputPacks", parseInt(e.target.value) || 0)}
                      className="w-20 text-center text-sm font-black text-amber-900 border border-slate-200 rounded-lg py-1"
                    />
                    <span className="text-xs font-bold text-slate-400">Pouch</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Quick Duration for Sugar Repack */}
            <div className="pt-2 border-t border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-amber-900">
                Durasi Repack Gula: <strong className="text-amber-950 font-black">{sugarDurationMinutes} Menit</strong>
              </span>
              <div className="flex gap-1 flex-wrap">
                {[15, 20, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSugarDurationMinutes(mins)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border ${
                      sugarDurationMinutes === mins
                        ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                        : "bg-white text-slate-700 border-amber-200"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== SUB-FORM 5: PACKING ORDER (SHOPEE / TIKTOK / B2B) ========== */}
        {hasOrderPacking && (
          <div className="bg-white rounded-3xl p-5 border border-purple-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-purple-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                  <Truck size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-purple-950 uppercase tracking-wide">
                    Stasiun 5: Packing Order Ekspedisi & B2B
                  </h3>
                  <p className="text-[10px] text-purple-700 font-medium">Packing pesanan marketplace & WhatsApp</p>
                </div>
              </div>
              <span className="text-xs font-black bg-purple-100 text-purple-800 px-2.5 py-1 rounded-xl">
                Total: {totalOrderPackages} Paket
              </span>
            </div>

            {/* Platform Breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-purple-50/50 p-2.5 rounded-2xl border border-purple-100 text-center">
                <span className="text-[10px] font-black text-orange-600 block mb-1">Shopee</span>
                <input
                  type="number"
                  min="0"
                  value={orderShopee}
                  onChange={(e) => setOrderShopee(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-sm font-black text-slate-800 bg-white border border-slate-200 rounded-lg py-1"
                />
                <span className="text-[9px] text-slate-400 block mt-0.5">Paket</span>
              </div>
              <div className="bg-purple-50/50 p-2.5 rounded-2xl border border-purple-100 text-center">
                <span className="text-[10px] font-black text-slate-900 block mb-1">TikTok</span>
                <input
                  type="number"
                  min="0"
                  value={orderTiktok}
                  onChange={(e) => setOrderTiktok(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-sm font-black text-slate-800 bg-white border border-slate-200 rounded-lg py-1"
                />
                <span className="text-[9px] text-slate-400 block mt-0.5">Paket</span>
              </div>
              <div className="bg-purple-50/50 p-2.5 rounded-2xl border border-purple-100 text-center">
                <span className="text-[10px] font-black text-emerald-700 block mb-1">WA / B2B</span>
                <input
                  type="number"
                  min="0"
                  value={orderWhatsappB2b}
                  onChange={(e) => setOrderWhatsappB2b(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-sm font-black text-slate-800 bg-white border border-slate-200 rounded-lg py-1"
                />
                <span className="text-[9px] text-slate-400 block mt-0.5">Paket</span>
              </div>
            </div>

            {/* Courier Selection Chips */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-500 block">Ekspedisi yang Digunakan:</span>
              <div className="flex flex-wrap gap-1.5">
                {COURIER_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCourier(c)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                      selectedCouriers.includes(c)
                        ? "bg-purple-700 text-white border-purple-800"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <input
                type="text"
                value={orderPackingNotes}
                onChange={(e) => setOrderPackingNotes(e.target.value)}
                placeholder="Catatan packing / kendala resi (opsional)..."
                className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-medium"
              />
            </div>

            {/* Quick Duration for Order Packing */}
            <div className="pt-2 border-t border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-purple-900">
                Durasi Packing Order: <strong className="text-purple-950 font-black">{orderPackingDurationMinutes} Menit</strong>
              </span>
              <div className="flex gap-1 flex-wrap">
                {[15, 30, 45, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setOrderPackingDurationMinutes(mins)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border ${
                      orderPackingDurationMinutes === mins
                        ? "bg-purple-600 text-white border-purple-700 shadow-2xs"
                        : "bg-white text-slate-700 border-purple-200"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== SUB-FORM 6: TIMBANGAN SISA BAHAN & STATUS PERASA ========== */}
        {hasRawOpname && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Scale size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Stasiun 6: Sisa Bahan Fisik (Opname)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Timbang berat fisik sisa bahan akhir shift</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {mainIngredients.slice(0, 6).map((ing) => (
                <div key={ing.id} className="bg-slate-50/70 p-2.5 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-700 block truncate">{ing.name}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={rawRemainings[ing.id] ?? ""}
                      onChange={(e) => setRawRemainings({ ...rawRemainings, [ing.id]: e.target.value })}
                      className="w-full h-8 px-2 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                    />
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{ing.unit || "gr"}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Status Perasa Kritis */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-black text-slate-700 block">Status Perasa & Pewarna</span>
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
                      className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-100 text-xs"
                    >
                      <span className="font-bold text-slate-700">{p.name}</span>
                      <div className="flex gap-1">
                        {(["aman", "dikit_lagi", "habis"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setFlavorStatus({ ...flavorStatus, [p.id]: s })}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold capitalize transition-all ${
                              st === s
                                ? s === "habis"
                                  ? "bg-red-500 text-white"
                                  : s === "dikit_lagi"
                                  ? "bg-amber-500 text-white"
                                  : "bg-emerald-600 text-white"
                                : "bg-white text-slate-400 hover:bg-slate-100 border border-slate-200"
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

        {/* ========== SUB-FORM 7: SOP TUTUP & KEBERSIHAN (POSISI BENAR DI AKHIR SHIFT) ========== */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-emerald-600" /> 7. SOP Tutup & Pembersihan Dapur
            </span>
            <span className="text-[10px] text-slate-400 font-bold">Wajib sebelum pulang</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold text-slate-700">
            {[
              { label: "Cuci semua loyang & alat", checked: closingCuciAlat, set: setClosingCuciAlat },
              { label: "Sapu & pel lantai dapur", checked: closingPelLantai, set: setClosingPelLantai },
              { label: "Matikan kompor & gas", checked: closingMatikanKompor, set: setClosingMatikanKompor },
              { label: "Matikan lampu & AC", checked: closingMatikanLampu, set: setClosingMatikanLampu },
              { label: "Rapatkan pintu freezer", checked: closingKunciFreezer, set: setClosingKunciFreezer },
              { label: "Kunci pintu & jendela", checked: closingKunciPintu, set: setClosingKunciPintu },
            ].map((sop, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <input
                  type="checkbox"
                  checked={sop.checked}
                  onChange={(e) => sop.set(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0"
                />
                <span className="text-[11px]">{sop.label}</span>
              </label>
            ))}
          </div>

          {/* Deep Cleaning / Extra Task Checklist */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer bg-amber-50 p-2.5 rounded-2xl border border-amber-200/80">
              <input
                type="checkbox"
                checked={hasExtraTask}
                onChange={(e) => {
                  setHasExtraTask(e.target.checked);
                  setIsDeepCleaning(e.target.checked);
                }}
                className="rounded text-amber-600 focus:ring-0"
              />
              <span className="text-xs font-black text-amber-900">
                Ada Tugas Tambahan / Deep Cleaning Khusus Hari Ini
              </span>
            </label>

            {hasExtraTask && (
              <div className="space-y-2 p-3 bg-white rounded-2xl border border-amber-200">
                <input
                  type="text"
                  value={extraTaskDesc}
                  onChange={(e) => setExtraTaskDesc(e.target.value)}
                  placeholder="Misal: Kuras freezer, cuci blower, bongkar rak..."
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-medium"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">Durasi Tugas Ekstra:</span>
                  <div className="flex gap-1">
                    {[30, 60, 90, 120].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setExtraTaskDuration(String(d))}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                          extraTaskDuration === String(d)
                            ? "bg-amber-600 text-white border-amber-700"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========== SUB-FORM 8: FOTO BUKTI & CATATAN ========== */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Camera size={16} className="text-slate-600" /> 8. Foto Bukti Fisik Freezer & Area
            </span>
            <span className="text-[10px] text-slate-400 font-bold">Otomatis kompresi</span>
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
              <span className="text-xs font-black text-slate-700">Jepret Foto Freezer / Meja Dapur</span>
              <span className="text-[10px] text-slate-400">Bukti visual kondisi loyang freezer dan kebersihan</span>
            </button>
          )}

          <div>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan untuk manajer / owner (opsional)..."
              className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Sticky Floating Submit Bar on Mobile */}
        <div className="fixed bottom-0 left-0 right-0 p-3.5 bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="max-w-xl mx-auto flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
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
