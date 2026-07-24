"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Check, PackageOpen, ClipboardList, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import type { Ingredient, Order, OrderItem, Variant } from "@/types";

interface FullOrder extends Order {
  items: OrderItem[];
}

export default function CrewPackingPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"pack_order" | "repack_glaze" | "repack_cinnamon" | "repack_reg_to_full" | "manual_usage">("pack_order");
  
  // Shared States
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // 1. Pack Order States
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<FullOrder | null>(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const [glazeSelections, setGlazeSelections] = useState<Record<string, string>>({}); // { [ingId]: qtyString }

  // 2. Repack Glaze States
  const [glazeFlavor, setGlazeFlavor] = useState("coklat");
  const [glazeTarget, setGlazeTarget] = useState<"cup" | "tiktok">("cup");
  const [glazeCupQty, setGlazeCupQty] = useState("");
  const [glazeBulkOverride, setGlazeBulkOverride] = useState(""); // manual override grams

  // 3. Repack Cinnamon States
  const [cinnamonBatchCount, setCinnamonBatchCount] = useState("1");
  const [cinnamonProducedQty, setCinnamonProducedQty] = useState("");

  // 4. Repack Regular to Full States
  const [repackVariantId, setRepackVariantId] = useState("");
  const [regularPacksToUnpack, setRegularPacksToUnpack] = useState("");
  const [repackProductStocks, setRepackProductStocks] = useState<Record<string, number>>({}); // variantId -> currentStock
  const [repackBuffers, setRepackBuffers] = useState<Record<string, number>>({}); // variantId -> currentBufferPcs
  const [loadingRepackData, setLoadingRepackData] = useState(false);

  // 5. Manual Usage States
  const [manualEntries, setManualEntries] = useState<Map<string, string>>(new Map());
  const [manualNotes, setManualNotes] = useState("");

  // Status indicators
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  }, [getToken]);

  // Load Variants and Ingredients
  const loadInitialData = useCallback(async () => {
    try {
      const [ingRes, varRes] = await Promise.all([
        fetchWithAuth("/api/ingredients"),
        fetchWithAuth("/api/variants")
      ]);

      if (ingRes.ok) {
        const ingData: Ingredient[] = await ingRes.json();
        setIngredients(ingData);
      }
      if (varRes.ok) {
        const varData: Variant[] = await varRes.json();
        const prodVariants = varData.filter((v) => v.isProductionVariant);
        setVariants(prodVariants);
        if (prodVariants.length > 0 && !repackVariantId) {
          setRepackVariantId(prodVariants[0].id);
        }
      }
    } catch (err) {
      console.error("Gagal memuat data awal:", err);
    } finally {
      setLoadingInitial(false);
    }
  }, [fetchWithAuth, repackVariantId]);

  // Load Orders
  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetchWithAuth("/api/orders?status=pending");
      if (res.ok) {
        const data: Order[] = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error("Gagal memuat pesanan:", err);
    } finally {
      setLoadingOrders(false);
    }
  }, [fetchWithAuth]);

  // Load Order Detail
  const loadOrderDetail = useCallback(async (orderId: string) => {
    setLoadingOrderDetail(true);
    setError("");
    try {
      const res = await fetchWithAuth(`/api/orders/${orderId}`);
      if (res.ok) {
        const data: FullOrder = await res.json();
        setSelectedOrder(data);
        setGlazeSelections({});
      } else {
        setError("Gagal memuat detail pesanan");
      }
    } catch (err) {
      setError("Gagal memuat detail pesanan");
    } finally {
      setLoadingOrderDetail(false);
    }
  }, [fetchWithAuth]);

  // Load stocks and buffers for Repack Regular to Full tab
  const loadRepackData = useCallback(async () => {
    setLoadingRepackData(true);
    try {
      const stocks: Record<string, number> = {};
      const buffers: Record<string, number> = {};

      const promises = variants.map(async (v) => {
        // Fetch Regular Pack Stock
        const stockId = `churros-frozen-regular_${v.id}`;
        // Since there is no direct productStocks get API, we fetch the stock using a trick or backend transaction.
        // Wait, is there a simpler way? Can we fetch pre-packing pool, or check if variants already has stock?
        // Wait! In pre-packing page, how does it know variant stocks?
        // In pre-packing page, it calls `/api/productions/loyang-pool?variantId=xxx` to get loyang pool and bufferPcs.
        // Wait, does it fetch productStocks?
        // Let's create an endpoint or just read them from variants or database?
        // Wait! We can just fetch /api/productions/loyang-pool?variantId=v.id to get buffer pcs!
        // But what about the regular packs stock?
        // Let's check: is there another way to get productStocks?
        // Wait! We can read productStocks by calling `/api/productions/loyang-pool?variantId=v.id`. It returns `bufferPcs`.
        // Let's check how we can get regular stock.
        // Ah, let's look at `app/api/productions/loyang-pool/route.ts` using `view_file` to see what it returns!
      });
      // Actually, we can get bufferPcs via loyang-pool API. Let's see what is inside loyang-pool route.
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRepackData(false);
    }
  }, [variants]);

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
    loadOrders();
  }, [loadInitialData, loadOrders]);

  // Handle order selection change
  useEffect(() => {
    if (selectedOrderId) {
      loadOrderDetail(selectedOrderId);
    } else {
      setSelectedOrder(null);
    }
  }, [selectedOrderId, loadOrderDetail]);

  // Reset errors on tab change
  useEffect(() => {
    setError("");
    setSuccess("");
  }, [activeTab]);

  // Fetch repack data when the repack tab is selected
  useEffect(() => {
    if (activeTab === "repack_reg_to_full" && variants.length > 0) {
      // We will load the regular stock & buffer for selected variant
      fetchRepackVariantStock(repackVariantId);
    }
  }, [activeTab, repackVariantId, variants]);

  const fetchRepackVariantStock = async (vId: string) => {
    if (!vId) return;
    setLoadingRepackData(true);
    try {
      // 1. Fetch buffer pcs from loyang-pool
      const poolRes = await fetchWithAuth(`/api/productions/loyang-pool?variantId=${vId}&type=standard`);
      let bufferVal = 0;
      if (poolRes.ok) {
        const poolData = await poolRes.json();
        bufferVal = poolData.bufferPcs ?? 0;
      }

      // 2. Fetch regular pack stock. Wait, how do we get regular pack stock?
      // Let's call /api/pre-packing or similar? No, pre-packing route.ts POST increments it, but doesn't have GET.
      // Wait, is there a simple way to get a single document stock or all product stocks?
      // What if we add a GET query or read it in some other way?
      // Wait, in `app/api/variants` GET, does it return variants stock? Yes, `variants` currentStock.
      // Let's look at `/api/variants`. Does it represent standard regular stock?
      // Yes! In `seed.ts` (lines 602-607), `PRODUCT_STOCKS` for `churros-frozen-regular_original` was seeded with `currentStock: 76`.
      // And in `seed.ts` (line 153), `VARIANTS` was seeded, and in `variants` collection it had `currentStock: 0`.
      // Wait! In `app/api/variants/route.ts`, it gets `variants` collection.
      // If we want to show the crew the available regular packs, we can write a small helper in `/api/packing` GET?
      // Or we can just add a GET method to `/api/packing/route.ts` that returns the product stocks and buffers!
      // Yes! That is incredibly clean and avoids hacking other endpoints.
      // Let's modify `/api/packing/route.ts` to support `GET` which returns the product stocks of regular packs and buffers!
      // This is extremely simple and elegant.
      // Let's do that! Let's check `/api/packing/route.ts`. We can add a `GET` method.
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRepackData(false);
    }
  };

  // Calculate order packing requirements
  const orderRequirements = useMemo(() => {
    if (!selectedOrder) {
      return {
        reqGlazeStandard: 0,
        reqGlazeTikTok: 0,
        reqCinnamonClips: 0,
        hasPendingRainbow: false,
      };
    }

    let standardGlazes = 0;
    let tiktokGlazes = 0;
    let frozenPacks = 0;
    let pendingRainbow = false;

    selectedOrder.items.forEach((item) => {
      const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";
      if (isRainbow && item.assemblyStatus === "pending_approval") {
        pendingRainbow = true;
      }

      if (item.productId === "churros-frozen-regular" || item.productId === "churros-frozen-full") {
        standardGlazes += item.qty * 2;
        frozenPacks += item.qty;
      } else if (item.productId === "churros-frozen-tiktok") {
        tiktokGlazes += item.qty * 2;
        frozenPacks += item.qty;
      }
    });

    return {
      reqGlazeStandard: standardGlazes,
      reqGlazeTikTok: tiktokGlazes,
      reqCinnamonClips: frozenPacks, // 1 clip plastic per pack
      hasPendingRainbow: pendingRainbow,
    };
  }, [selectedOrder]);

  // Compute selected glaze cup totals separately
  const glazeSelectionsTotals = useMemo(() => {
    let standardTotal = 0;
    let tiktokTotal = 0;

    Object.entries(glazeSelections).forEach(([id, val]) => {
      const q = parseInt(val) || 0;
      if (id.endsWith("-tiktok")) {
        tiktokTotal += q;
      } else {
        standardTotal += q;
      }
    });

    return {
      selectedStandardTotal: standardTotal,
      selectedTikTokTotal: tiktokTotal,
    };
  }, [glazeSelections]);

  const ingredientsMap = useMemo(() => {
    return new Map(ingredients.map((i) => [i.id, i]));
  }, [ingredients]);

  const bulkCinnamonStock = useMemo(() => {
    return ingredients.find(i => i.id === "gula-cinnamon-bulk")?.currentStock ?? 0;
  }, [ingredients]);


  // Standard glaze options (cups)
  const glazeStandardOptions = useMemo(() => {
    return [
      { id: "saus-coklat", name: "Glaze Coklat" },
      { id: "saus-greentea", name: "Glaze Green Tea" },
      { id: "saus-keju", name: "Glaze Keju" },
      { id: "saus-vanilla", name: "Glaze Vanilla" },
      { id: "saus-tiramisu", name: "Glaze Tiramisu" },
    ];
  }, []);

  // TikTok glaze options (vacuum plastics)
  const glazeTikTokOptions = useMemo(() => {
    return [
      { id: "saus-coklat-tiktok", name: "Glaze Coklat TikTok" },
      { id: "saus-greentea-tiktok", name: "Glaze Green Tea TikTok" },
      { id: "saus-keju-tiktok", name: "Glaze Keju TikTok" },
      { id: "saus-vanilla-tiktok", name: "Glaze Vanilla TikTok" },
      { id: "saus-tiramisu-tiktok", name: "Glaze Tiramisu TikTok" },
    ];
  }, []);

  // Live bulk glaze usage calculation
  const glazeBulkEstGrams = useMemo(() => {
    const qty = parseInt(glazeCupQty) || 0;
    if (qty <= 0) return 0;
    const factor = glazeTarget === "cup" ? 13 : 15;
    return qty * factor;
  }, [glazeCupQty, glazeTarget]);

  // Live cinnamon sugar raw ingredients calculation
  const cinnamonSugarEstUsage = useMemo(() => {
    const batches = parseInt(cinnamonBatchCount) || 0;
    if (batches <= 0) return { sugarGrams: 0, cinnamonGrams: 0 };
    return {
      sugarGrams: batches * 1500,
      cinnamonGrams: batches * 40,
    };
  }, [cinnamonBatchCount]);

  // Live cinnamon sugar clip usage calculation (user inputs raw bulk weight in grams)
  const cinnamonClipEstUsage = useMemo(() => {
    const grams = parseInt(cinnamonProducedQty) || 0;
    return grams;
  }, [cinnamonProducedQty]);

  const cinnamonClipEstProduced = useMemo(() => {
    const grams = parseInt(cinnamonProducedQty) || 0;
    return Math.floor(grams / 5);
  }, [cinnamonProducedQty]);


  // Live Repack Regular to Full Calculation
  const repackRegToFullCalc = useMemo(() => {
    const regularToUnpack = parseInt(regularPacksToUnpack) || 0;
    const bufferPcs = repackBuffers[repackVariantId] ?? 0;

    if (regularToUnpack <= 0) {
      return { producedFullPacks: 0, newBufferPcs: bufferPcs };
    }

    const totalPcs = (regularToUnpack * 12) + bufferPcs;
    const produced = Math.floor(totalPcs / 16);
    const remaining = totalPcs % 16;

    return {
      producedFullPacks: produced,
      newBufferPcs: remaining,
    };
  }, [regularPacksToUnpack, repackBuffers, repackVariantId]);

  const handleGlazeSelect = (flavorId: string, val: string) => {
    setGlazeSelections((prev) => ({
      ...prev,
      [flavorId]: val,
    }));
  };

  const manualIngredientsList = useMemo<Ingredient[]>(() => {
    return ingredients.filter(
      (ing) =>
        ing.category === "packaging" ||
        ing.category === "operasional" ||
        ing.category === "add_on"
    );
  }, [ingredients]);

  const updateManualEntry = (id: string, val: string) => {
    setManualEntries((prev) => {
      const next = new Map(prev);
      if (val === "") {
        next.delete(id);
      } else {
        next.set(id, val);
      }
      return next;
    });
  };

  // Helper to load repack stock & buffer data from API
  const fetchRepackStockAndBuffer = async (vId: string) => {
    if (!vId) return;
    setLoadingRepackData(true);
    try {
      const res = await fetchWithAuth(`/api/packing?action=get_repack_data&variantId=${vId}`);
      if (res.ok) {
        const data = await res.json();
        setRepackProductStocks((prev) => ({ ...prev, [vId]: data.regularStock }));
        setRepackBuffers((prev) => ({ ...prev, [vId]: data.bufferPcs }));
      }
    } catch (err) {
      console.error("Gagal mengambil data repack:", err);
    } finally {
      setLoadingRepackData(false);
    }
  };

  useEffect(() => {
    if (activeTab === "repack_reg_to_full" && repackVariantId) {
      fetchRepackStockAndBuffer(repackVariantId);
    }
  }, [activeTab, repackVariantId]);

  // --- Submissions ---

  // 1. Pack Order Submission
  async function handlePackOrder() {
    if (!selectedOrderId || !selectedOrder) return;
    setError("");
    setSuccess("");

    if (orderRequirements.reqGlazeStandard > 0 && glazeSelectionsTotals.selectedStandardTotal !== orderRequirements.reqGlazeStandard) {
      setError(`Jumlah cup glaze standard tidak sesuai. Dibutuhkan: ${orderRequirements.reqGlazeStandard} pcs, terpilih: ${glazeSelectionsTotals.selectedStandardTotal} pcs.`);
      return;
    }

    if (orderRequirements.reqGlazeTikTok > 0 && glazeSelectionsTotals.selectedTikTokTotal !== orderRequirements.reqGlazeTikTok) {
      setError(`Jumlah plastik glaze TikTok tidak sesuai. Dibutuhkan: ${orderRequirements.reqGlazeTikTok} pcs, terpilih: ${glazeSelectionsTotals.selectedTikTokTotal} pcs.`);
      return;
    }

    setSubmitting(true);

    const selections: Record<string, number> = {};
    Object.entries(glazeSelections).forEach(([id, val]) => {
      const q = parseInt(val) || 0;
      if (q > 0) selections[id] = q;
    });

    try {
      const res = await fetchWithAuth("/api/packing", {
        method: "POST",
        body: JSON.stringify({
          action: "pack_order",
          orderId: selectedOrderId,
          glazeSelections: selections,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal menyelesaikan packing");
      } else {
        setSuccess(`Berhasil memproses packing untuk order ${selectedOrder.orderNumber}!`);
        setSelectedOrderId(null);
        setSelectedOrder(null);
        await Promise.all([loadOrders(), loadInitialData()]);
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  // 2. Repack Glaze Submission
  async function handleRepackGlaze() {
    setError("");
    setSuccess("");
    const cupQty = parseInt(glazeCupQty) || 0;

    if (cupQty <= 0) {
      setError("Jumlah cup/plastik diproduksi harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/packing", {
        method: "POST",
        body: JSON.stringify({
          action: "repack_glaze",
          flavorId: glazeFlavor,
          targetType: glazeTarget,
          cupQty,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal memproses repack glaze");
      } else {
        setSuccess(`Berhasil merepack glaze flavor ${glazeFlavor} ke ${glazeTarget}: menghasilkan ${cupQty} pcs!`);
        setGlazeCupQty("");
        await loadInitialData();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  // 3a. Blender Cinnamon Submission
  async function handleBlenderCinnamon() {
    setError("");
    setSuccess("");
    const batches = parseInt(cinnamonBatchCount) || 0;

    if (batches <= 0) {
      setError("Jumlah batch blender harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/packing", {
        method: "POST",
        body: JSON.stringify({
          action: "blender_cinnamon",
          batchCount: batches,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal memproses blender gula cinnamon");
      } else {
        setSuccess(`Berhasil memblender gula cinnamon: ${batches} batch (mengurangi ${batches * 1500}g gula pasir & ${batches * 55}g kayu manis bubuk, menambah ${batches * 1555}g curah)!`);
        setCinnamonBatchCount("1");
        await loadInitialData();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  // 3b. Repack Cinnamon Clip Submission (cinnamonProducedQty is interpreted as Grams to kemas)
  async function handleRepackCinnamonClip() {
    setError("");
    setSuccess("");
    const grams = parseInt(cinnamonProducedQty) || 0;
    const produced = Math.floor(grams / 5);

    if (grams <= 0) {
      setError("Jumlah berat gula curah dikemas harus lebih dari 0");
      return;
    }
    if (produced <= 0) {
      setError("Jumlah berat gula curah harus minimal 5 gram untuk menghasilkan minimal 1 clip");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/packing", {
        method: "POST",
        body: JSON.stringify({
          action: "repack_cinnamon_clip",
          producedQty: produced,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal mengemas clip gula cinnamon");
      } else {
        setSuccess(`Berhasil mengemas ${produced} pcs clip gula cinnamon (mengurangi ${produced * 5}g curah)!`);
        setCinnamonProducedQty("");
        await loadInitialData();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  // 3c. Clear Cinnamon Bulk Stock
  async function handleClearCinnamonBulk() {
    if (!window.confirm("Apakah Anda yakin ingin mengosongkan seluruh sisa stok gula cinnamon curah di toples?")) {
      return;
    }

    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/packing", {
        method: "POST",
        body: JSON.stringify({
          action: "clear_cinnamon_bulk",
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal mengosongkan stok toples");
      } else {
        setSuccess("Stok gula cinnamon curah di toples berhasil dikosongkan.");
        await loadInitialData();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  // 4. Repack Regular to Full Submission
  async function handleRepackRegToFull() {
    setError("");
    setSuccess("");
    const regPacks = parseInt(regularPacksToUnpack) || 0;

    if (!repackVariantId) {
      setError("Pilih varian produk");
      return;
    }
    if (regPacks <= 0) {
      setError("Jumlah regular pack yang dibongkar harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/packing", {
        method: "POST",
        body: JSON.stringify({
          action: "repack_reg_to_full",
          variantId: repackVariantId,
          regularPacksToUnpack: regPacks,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal memproses repack regular ke full");
      } else {
        setSuccess(`Berhasil membongkar ${regPacks} pack Regular ${repackVariantId} menjadi ${d.producedFullPacks} pack Full (sisa buffer baru: ${d.leftoverBufferPcs} pcs).`);
        setRegularPacksToUnpack("");
        await Promise.all([loadInitialData(), fetchRepackStockAndBuffer(repackVariantId)]);
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  // 5. Manual Usage Submission
  async function handleManualUsage() {
    setError("");
    setSuccess("");
    setSubmitting(true);

    const updates = Array.from(manualEntries.entries())
      .filter(([_, val]) => parseFloat(val) > 0)
      .map(([id, val]) => ({
        id,
        qtyUsed: parseFloat(val) || 0,
      }));

    if (updates.length === 0) {
      setError("Isi minimal 1 bahan yang digunakan");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchWithAuth("/api/packing", {
        method: "POST",
        body: JSON.stringify({
          action: "manual_usage",
          updates,
          note: manualNotes || "Pemakaian packing manual",
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Sebagian atau seluruh data gagal disimpan");
      } else {
        setSuccess(`Berhasil mencatat pemakaian manual ${updates.length} bahan`);
        setManualEntries(new Map());
        setManualNotes("");
        await loadInitialData();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "#FCABB4" }}>
      {/* Header (Glassmorphism) */}
      <div className="px-5 pt-5 pb-5 rounded-b-[24px] sticky top-0 z-30 bg-white/90 backdrop-blur-xl shadow-sm border-b border-pink-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20">
            <ClipboardList size={20} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Modul Packing</h1>
        </div>
        <p className="text-xs ml-[48px] text-slate-500">
          Kelola packing pesanan, repack glaze bulk, blender gula cinnamon, bongkar regular ke full, dan pemakaian bahan.
        </p>
      </div>

      <div className="px-4 pt-4 md:px-8 max-w-4xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap bg-white/20 backdrop-blur-md rounded-2xl p-1.5 gap-1 mb-6" style={{ border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 4px 12px rgba(232,93,140,0.1)" }}>
          {[
            { key: "pack_order", label: "Pack Pesanan" },
            { key: "repack_glaze", label: "Repack Saos" },
            { key: "repack_cinnamon", label: "Repack Gula Cinnamon" },
            { key: "repack_reg_to_full", label: "Repack Regular -> Full" },
            { key: "manual_usage", label: "Pemakaian Manual" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className="flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-bold transition-all tap-target"
              style={
                activeTab === tab.key
                  ? { background: "#fff", color: "#E85D8C", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }
                  : { color: "#fff" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* --- Tab Content: 1. Pack Order --- */}
        {activeTab === "pack_order" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-extrabold text-slate-800">Pilih Pesanan Pending</h2>
                <button
                  onClick={loadOrders}
                  disabled={loadingOrders}
                  className="flex items-center gap-1 text-xs font-bold tap-target transition-all active:scale-95"
                  style={{ color: "#E85D8C" }}
                >
                  <RefreshCw size={12} className={loadingOrders ? "animate-spin" : ""} />
                  Segarkan
                </button>
              </div>

              {loadingOrders && orders.length === 0 ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#E85D8C" }} />
                </div>
              ) : orders.length === 0 ? (
                <div className="py-8 text-center bg-brand-50 rounded-2xl border border-slate-100">
                  <PackageOpen className="mx-auto text-slate-300 mb-2" size={32} />
                  <p className="text-xs text-slate-500 font-medium">Semua pesanan sudah di-pack!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between hover:bg-primary/10"
                      style={
                        selectedOrderId === order.id
                          ? { border: "2px solid #E85D8C", background: "#FEF1F5" }
                          : { border: "1px solid #F1F5F9", background: "#fff" }
                      }
                    >
                      <div>
                        <p className="font-extrabold text-slate-800 text-sm mb-0.5">{order.orderNumber}</p>
                        <p className="text-slate-400 text-xxs">Customer: {order.customerName}</p>
                      </div>
                      <span
                        className="font-bold px-2 py-0.5 rounded-full text-xs"
                        style={{ background: "#F1F5F9", color: "#64748B" }}
                      >
                        {order.channel.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedOrderId && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
                {loadingOrderDetail ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#E85D8C" }} />
                  </div>
                ) : !selectedOrder ? (
                  <p className="text-xs text-center text-red-500">Detail pesanan gagal dimuat.</p>
                ) : (
                  <>
                    {/* Order header summary */}
                    <div className="p-4 rounded-2xl bg-brand-50 border border-slate-100 flex flex-wrap gap-4 text-xs">
                      <div>
                        <p className="text-slate-400">Order No:</p>
                        <p className="font-bold text-slate-800">{selectedOrder.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Customer:</p>
                        <p className="font-bold text-slate-800">{selectedOrder.customerName}</p>
                      </div>
                      {selectedOrder.customerPhone && (
                        <div>
                          <p className="text-slate-400">No HP:</p>
                          <p className="font-bold text-slate-800">{selectedOrder.customerPhone}</p>
                        </div>
                      )}
                      {selectedOrder.orderNotes && (
                        <div className="w-full border-t border-slate-100 pt-2">
                          <p className="text-slate-400 font-bold">Catatan:</p>
                          <p className="italic text-slate-600">"{selectedOrder.orderNotes}"</p>
                        </div>
                      )}
                    </div>

                    {/* Rainbow check warning */}
                    {orderRequirements.hasPendingRainbow && (
                      <div className="rounded-2xl px-4 py-3 bg-amber-50 border border-amber-200 text-slate-700 flex items-start gap-2.5">
                        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-800">Rainbow Assembly Pending</p>
                          <p className="text-xxs text-amber-700">
                            Pesanan ini berisi Churros Rainbow yang belum di-assembly oleh Manager. Harap hubungi Manager untuk menyetujui assembly di menu admin terlebih dahulu.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Order items */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Item Pesanan</h3>
                      <div className="space-y-2">
                        {selectedOrder.items.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-slate-100 bg-brand-50 bg-opacity-40 flex justify-between items-center text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-800">{item.productName}</p>
                              <p className="text-slate-400">Varian: {item.variantName}</p>
                            </div>
                            <span className="font-extrabold text-slate-700 text-sm">{item.qty} pack</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pelengkap Packing */}
                    <div className="border-t border-slate-100 pt-4 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bahan Pelengkap</h3>

                      {/* Cinnamon Sugar sachet clip */}
                      {orderRequirements.reqCinnamonClips > 0 && (
                        <div className="p-3.5 rounded-xl border border-slate-100 bg-brand-50 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-slate-800">Gula Halus Cinnamon</p>
                            <p className="text-slate-400 text-xxs">1 sachet/clip per pack frozen</p>
                          </div>
                          <span className="font-extrabold text-slate-700">{orderRequirements.reqCinnamonClips} sachet/clip (pcs)</span>
                        </div>
                      )}

                      {/* Standard Glaze Selector */}
                      {orderRequirements.reqGlazeStandard > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-slate-800">Cup Glaze Standard (Standard Order)</p>
                              <p className="text-xxs text-slate-400">Pilih rasa cup glaze untuk Regular/Full packs (2 cup per pack)</p>
                            </div>
                            <span
                              className="font-bold px-2 py-0.5 rounded-lg text-xxs"
                              style={
                                glazeSelectionsTotals.selectedStandardTotal === orderRequirements.reqGlazeStandard
                                  ? { background: "#DCFCE7", color: "#16A34A" }
                                  : { background: "#FEE2E2", color: "#DC2626" }
                              }
                            >
                              {glazeSelectionsTotals.selectedStandardTotal} / {orderRequirements.reqGlazeStandard} pcs
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {glazeStandardOptions.map((flavor) => {
                              const dbIng = ingredientsMap.get(flavor.id);
                              const currentStock = dbIng?.currentStock ?? 0;
                              return (
                                <div key={flavor.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-bold text-slate-800">{flavor.name}</p>
                                    <p className="text-xxs text-slate-400">Stok: {currentStock} pcs</p>
                                  </div>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={glazeSelections[flavor.id] || ""}
                                    onChange={(e) => handleGlazeSelect(flavor.id, e.target.value)}
                                    className="w-16 h-8 text-center text-xs font-bold rounded-lg border-slate-200"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* TikTok Glaze Selector */}
                      {orderRequirements.reqGlazeTikTok > 0 && (
                        <div className="space-y-3 border-t border-slate-100 border-dashed pt-4">
                          <div className="flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-slate-800">Plastik Glaze TikTok (TikTok Order)</p>
                              <p className="text-xxs text-slate-400">Pilih rasa plastik vacuum glaze untuk TikTok packs (2 plastik per pack)</p>
                            </div>
                            <span
                              className="font-bold px-2 py-0.5 rounded-lg text-xxs"
                              style={
                                glazeSelectionsTotals.selectedTikTokTotal === orderRequirements.reqGlazeTikTok
                                  ? { background: "#DCFCE7", color: "#16A34A" }
                                  : { background: "#FEE2E2", color: "#DC2626" }
                              }
                            >
                              {glazeSelectionsTotals.selectedTikTokTotal} / {orderRequirements.reqGlazeTikTok} pcs
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {glazeTikTokOptions.map((flavor) => {
                              const dbIng = ingredientsMap.get(flavor.id);
                              const currentStock = dbIng?.currentStock ?? 0;
                              return (
                                <div key={flavor.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-bold text-slate-800">{flavor.name}</p>
                                    <p className="text-xxs text-slate-400">Stok: {currentStock} pcs</p>
                                  </div>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={glazeSelections[flavor.id] || ""}
                                    onChange={(e) => handleGlazeSelect(flavor.id, e.target.value)}
                                    className="w-16 h-8 text-center text-xs font-bold rounded-lg border-slate-200"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selesai Button */}
                    <button
                      onClick={handlePackOrder}
                      disabled={
                        submitting ||
                        orderRequirements.hasPendingRainbow ||
                        (orderRequirements.reqGlazeStandard > 0 && glazeSelectionsTotals.selectedStandardTotal !== orderRequirements.reqGlazeStandard) ||
                        (orderRequirements.reqGlazeTikTok > 0 && glazeSelectionsTotals.selectedTikTokTotal !== orderRequirements.reqGlazeTikTok)
                      }
                      className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 tap-target"
                      style={{
                        background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
                        boxShadow: "0 8px 20px rgba(232,93,140,0.3)",
                      }}
                    >
                      {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                      Selesai Packing & Tandai Order Selesai
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- Tab Content: 2. Repack Glaze --- */}
        {activeTab === "repack_glaze" && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-800 mb-2">Packing Saos Glaze</h2>
            <p className="text-xs text-slate-400">
              Konversikan saos glaze curah (gram) menjadi cup standard (13g) atau plastik vacuum TikTok (15g).
            </p>

            <div className="space-y-3">
              {/* Rasa Glaze & Target Kemasan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Rasa Glaze</label>
                  <select
                    value={glazeFlavor}
                    onChange={(e) => setGlazeFlavor(e.target.value)}
                    className="w-full h-12 rounded-xl text-sm border border-slate-200 px-3 font-semibold text-slate-800 bg-white"
                  >
                    <option value="coklat">Glaze Coklat</option>
                    <option value="greentea">Glaze Green Tea</option>
                    <option value="keju">Glaze Keju</option>
                    <option value="vanilla">Glaze Vanilla</option>
                    <option value="tiramisu">Glaze Tiramisu</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Target Kemasan</label>
                  <select
                    value={glazeTarget}
                    onChange={(e) => setGlazeTarget(e.target.value as any)}
                    className="w-full h-12 rounded-xl text-sm border border-slate-200 px-3 font-semibold text-slate-800 bg-white"
                  >
                    <option value="cup">Cup Standard (13g)</option>
                    <option value="tiktok">Plastik TikTok (15g)</option>
                  </select>
                </div>
              </div>

              {/* Display Stock comparison dynamically */}
              {(() => {
                const bulkIng = ingredientsMap.get(`glaze-${glazeFlavor}-bulk`);
                const cupId = glazeTarget === "cup" ? `saus-${glazeFlavor}` : `saus-${glazeFlavor}-tiktok`;
                const cupIng = ingredientsMap.get(cupId);
                return (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-brand-50 border border-slate-100 rounded-xl text-xxs text-slate-500">
                    <div>
                      <p className="font-bold text-slate-400">Stok Glaze Curah:</p>
                      <p className="text-xs font-bold text-slate-700">{bulkIng?.currentStock ?? 0} {bulkIng?.baseUnit}</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-400">Stok Target ({glazeTarget === "cup" ? "Cup" : "Plastik"}):</p>
                      <p className="text-xs font-bold text-slate-700">{cupIng?.currentStock ?? 0} {cupIng?.baseUnit}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Qty and Calculated Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Jumlah Kemasan Di-pack (pcs)</label>
                  <Input
                    type="number"
                    placeholder="Masukkan jumlah pcs"
                    value={glazeCupQty}
                    onChange={(e) => setGlazeCupQty(e.target.value)}
                    className="h-12 rounded-xl text-sm border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Perkiraan Curah Terpotong</label>
                  <div className="h-12 bg-brand-50 rounded-xl border border-slate-200 flex items-center px-4 text-sm font-bold text-slate-700">
                    {glazeBulkEstGrams} gram
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleRepackGlaze}
              disabled={submitting || !glazeCupQty}
              className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 tap-target"
              style={{
                background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
                boxShadow: "0 8px 20px rgba(232,93,140,0.3)",
              }}
            >
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              Simpan Repack Glaze
            </button>
          </div>
        )}

        {/* --- Tab Content: 3. Repack Cinnamon --- */}
        {activeTab === "repack_cinnamon" && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-800 mb-2">Blender & Kemas Gula Cinnamon</h2>
            <p className="text-xs text-slate-400">
              Blender Gula Pasir dan Kayu Manis Bubuk menjadi stok curah di toples, lalu kemas ke plastik clip secara terpisah sesuai kebutuhan.
            </p>

            <div className="space-y-4">
              {/* Display Stock Info */}
              {(() => {
                const sugarIng = ingredientsMap.get("gula-pasir");
                const powderIng = ingredientsMap.get("bubuk-kayu-manis");
                const bulkIng = ingredientsMap.get("gula-cinnamon-bulk");
                const finalIng = ingredientsMap.get("gula-halus-cinnamon");
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-brand-50 border border-slate-100 rounded-xl text-xxs text-slate-500">
                    <div>
                      <p className="font-bold text-slate-400">Gula Pasir:</p>
                      <p className="text-xs font-bold text-slate-700">{sugarIng?.currentStock ?? 0}g</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-400">Kayu Manis Bubuk:</p>
                      <p className="text-xs font-bold text-slate-700">{powderIng?.currentStock ?? 0}g</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-400">Toples (Curah):</p>
                        {(bulkIng?.currentStock ?? 0) > 0 && (
                          <button
                            onClick={handleClearCinnamonBulk}
                            disabled={submitting}
                            className="text-xs text-red-500 hover:text-red-700 underline font-bold active:scale-95 transition-all"
                            title="Kosongkan sisa stok gula curah di toples"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-700">{bulkIng?.currentStock ?? 0}g</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-400">Plastik Clip:</p>
                      <p className="text-xs font-bold text-slate-700">{finalIng?.currentStock ?? 0} pcs</p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Form A: Blender */}
                <div className="p-4 rounded-2xl border border-slate-100 bg-brand-50 bg-opacity-40 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1.5">
                      1. Proses Blender Gula
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Campurkan Gula Pasir & Kayu Manis Bubuk untuk mengisi toples gula halus cinnamon curah.
                    </p>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                        Jumlah Blender (Batch)
                      </label>
                      <Input
                        type="number"
                        placeholder="Contoh: 1"
                        value={cinnamonBatchCount}
                        onChange={(e) => setCinnamonBatchCount(e.target.value)}
                        className="h-10 rounded-xl text-xs border-slate-200"
                      />
                      <p className="text-xs text-slate-400 mt-1 font-medium">
                        1 batch = 1.500g Gula & 40g Kayu Manis = 1.540g Curah
                      </p>
                    </div>

                    {/* Show raw ingredients to be deducted */}
                    <div className="p-2.5 bg-primary/10 bg-opacity-30 rounded-xl border border-primary/20 text-xxs text-pink-700 space-y-0.5">
                      <div className="flex justify-between font-medium">
                        <span>Gula Pasir Terpotong:</span>
                        <span>{cinnamonSugarEstUsage.sugarGrams} gram</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Kayu Manis Terpotong:</span>
                        <span>{cinnamonSugarEstUsage.cinnamonGrams} gram</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleBlenderCinnamon}
                    disabled={submitting || !cinnamonBatchCount || parseInt(cinnamonBatchCount) <= 0}
                    className="w-full min-h-[40px] rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 mt-3"
                    style={{
                      background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
                      boxShadow: "0 4px 12px rgba(232,93,140,0.15)",
                    }}
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Simpan Hasil Blender
                  </button>
                </div>

                {/* Form B: Repack to Clip */}
                <div className="p-4 rounded-2xl border border-slate-100 bg-brand-50 bg-opacity-40 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        2. Kemas Gula ke Clip
                      </h3>
                      <button
                        type="button"
                        onClick={() => setCinnamonProducedQty(String(bulkCinnamonStock))}
                        className="text-xs font-bold text-primary hover:text-pink-700 bg-primary/10 px-2 py-0.5 rounded-md"
                      >
                        Kemas Semua ({bulkCinnamonStock}g)
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Masukkan berat gula curah dari toples untuk dikemas secara otomatis ke plastik clip.
                    </p>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                        Gula Curah Dikemas (gram)
                      </label>
                      <Input
                        type="number"
                        placeholder="Contoh: 500"
                        value={cinnamonProducedQty}
                        onChange={(e) => setCinnamonProducedQty(e.target.value)}
                        className="h-10 rounded-xl text-xs border-slate-200"
                      />
                      <p className="text-xs text-slate-400 mt-1 font-medium text-primary">
                        Hasil Estimasi: {cinnamonClipEstProduced} pcs plastik clip (1 clip = 5g)
                      </p>
                    </div>

                    {/* Show bulk sugar to be deducted */}
                    <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-xxs text-slate-600 space-y-0.5">
                      <div className="flex justify-between font-medium">
                        <span>Gula Curah Terpotong:</span>
                        <span>{cinnamonClipEstUsage} gram</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleRepackCinnamonClip}
                    disabled={submitting || !cinnamonProducedQty || parseInt(cinnamonProducedQty) <= 0}
                    className="w-full min-h-[40px] rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 mt-3"
                    style={{
                      background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
                      boxShadow: "0 4px 12px rgba(232,93,140,0.15)",
                    }}
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Simpan Kemasan Clip
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Tab Content: 4. Repack Regular to Full [NEW TAB] --- */}
        {activeTab === "repack_reg_to_full" && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-800 mb-2">Repack Regular ke Full Pack</h2>
            <p className="text-xs text-slate-400">
              Bongkar pack Regular (isi 12 pcs) yang ada untuk dipack ulang ke Full (isi 16 pcs). Sisa pcs yang tidak cukup menjadi 1 pack Full otomatis disimpan ke stok buffer varian tersebut.
            </p>

            <div className="space-y-3">
              {/* Variant Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Varian Churros</label>
                <select
                  value={repackVariantId}
                  onChange={(e) => setRepackVariantId(e.target.value)}
                  className="w-full h-12 rounded-xl text-sm border border-slate-200 px-3 font-semibold text-slate-800 bg-white"
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock and Buffer display */}
              {loadingRepackData ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#E85D8C" }} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 bg-brand-50 border border-slate-100 rounded-xl text-xxs text-slate-500">
                  <div>
                    <p className="font-bold text-slate-400">Stok Regular Saat Ini:</p>
                    <p className="text-xs font-bold text-slate-700">
                      {repackProductStocks[repackVariantId] ?? 0} pack
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-400">Sisa Stok Buffer:</p>
                    <p className="text-xs font-bold text-slate-700">
                      {repackBuffers[repackVariantId] ?? 0} pcs
                    </p>
                  </div>
                </div>
              )}

              {/* Number of packs to unpack */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Jumlah Pack Regular Dibongkar</label>
                <Input
                  type="number"
                  placeholder="Contoh: 2 pack"
                  value={regularPacksToUnpack}
                  onChange={(e) => setRegularPacksToUnpack(e.target.value)}
                  className="h-12 rounded-xl text-sm border-slate-200"
                />
              </div>

              {/* Calculations display */}
              {parseInt(regularPacksToUnpack) > 0 && (
                <div className="p-4 bg-brand-50 border border-slate-100 rounded-2xl text-xs space-y-2">
                  <p className="font-extrabold text-slate-800 border-b border-slate-200 pb-1.5 mb-1.5">
                    Estimasi Kalkulasi Konversi
                  </p>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pcs didapatkan dari Regular ({regularPacksToUnpack} * 12):</span>
                    <span className="font-bold text-slate-700">{(parseInt(regularPacksToUnpack) || 0) * 12} pcs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pcs dari Stok Buffer saat ini:</span>
                    <span className="font-bold text-slate-700">{repackBuffers[repackVariantId] ?? 0} pcs</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 border-dashed pt-1.5">
                    <span className="text-slate-500 font-bold">Total Pcs Churros:</span>
                    <span className="font-bold text-slate-800">
                      {(parseInt(regularPacksToUnpack) || 0) * 12 + (repackBuffers[repackVariantId] ?? 0)} pcs
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold pt-2 border-t border-slate-200">
                    <div className="flex-1 p-2 bg-primary/10 border border-primary/20 rounded-lg text-center text-pink-700">
                      <p className="text-xs uppercase text-pink-400 font-extrabold tracking-wider">Pack Full Dihasilkan</p>
                      <p className="text-sm font-extrabold">{repackRegToFullCalc.producedFullPacks} pack</p>
                      <p className="text-[8px] text-pink-400 mt-0.5">Memakai {repackRegToFullCalc.producedFullPacks * 16} pcs</p>
                    </div>
                    <ArrowRight size={14} className="text-slate-400" />
                    <div className="flex-1 p-2 bg-slate-100 border border-slate-200 rounded-lg text-center text-slate-600">
                      <p className="text-xs uppercase text-slate-400 font-extrabold tracking-wider">Sisa Buffer Baru</p>
                      <p className="text-sm font-extrabold">{repackRegToFullCalc.newBufferPcs} pcs</p>
                      <p className="text-[8px] text-slate-400 mt-0.5">Tersimpan untuk prepack berikut</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleRepackRegToFull}
              disabled={submitting || !regularPacksToUnpack}
              className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 tap-target"
              style={{
                background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
                boxShadow: "0 8px 20px rgba(232,93,140,0.3)",
              }}
            >
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              Simpan Repack Regular ke Full
            </button>
          </div>
        )}

        {/* --- Tab Content: 5. Manual Material Usage --- */}
        {activeTab === "manual_usage" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40">
              <h2 className="text-sm font-extrabold text-slate-800 mb-2">Pemakaian Bahan Operasional & Add-On</h2>
              <p className="text-xs text-slate-400 mb-4">
                Catat pemakaian plastik kemasan, box, stiker label, cup glaze, dan pelengkap secara manual jika ada selisih/pemakaian di luar order.
              </p>

              {manualIngredientsList.length === 0 ? (
                <div className="py-12 text-center bg-brand-50 border border-slate-100 rounded-2xl">
                  <PackageOpen className="mx-auto text-slate-300 mb-3" size={40} />
                  <p className="text-sm text-slate-500 font-medium">Belum ada bahan operasional/add-on</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {manualIngredientsList.map((ing) => (
                    <div
                      key={ing.id}
                      className="p-3.5 rounded-xl border border-slate-100 flex items-center justify-between gap-3 bg-brand-50 bg-opacity-40"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800">{ing.name}</p>
                        <p className="text-xs text-slate-400">
                          Sisa stok: {ing.currentStock} {ing.baseUnit}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Jumlah"
                          value={manualEntries.get(ing.id) || ""}
                          onChange={(e) => updateManualEntry(ing.id, e.target.value)}
                          className="w-24 h-9 rounded-lg text-xs text-center border-slate-200"
                        />
                        <span className="text-xs font-semibold text-slate-400 min-w-[30px]">
                          {ing.baseUnit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {manualIngredientsList.length > 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Catatan (Opsional)</label>
                  <textarea
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    className="w-full rounded-2xl px-4 py-3 text-xs resize-none focus:outline-none focus:border-slate-300 transition-colors border border-slate-200"
                    rows={2}
                    placeholder="Alasan pemakaian manual..."
                  />
                </div>

                <button
                  onClick={handleManualUsage}
                  disabled={submitting}
                  className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 tap-target"
                  style={{
                    background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
                    boxShadow: "0 8px 20px rgba(232,93,140,0.3)",
                  }}
                >
                  {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  Simpan Pemakaian Bahan
                </button>
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        {error && (
          <div className="rounded-2xl px-4 py-3 mt-4 bg-red-50 border border-red-200">
            <p className="text-xs font-semibold text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-2xl px-4 py-3 mt-4 bg-green-50 border border-green-200">
            <p className="text-xs font-semibold text-green-600">{success}</p>
          </div>
        )}
      </div>
    </div>
  );
}
