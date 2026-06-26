"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Check, PackageOpen, ClipboardList, RefreshCw, AlertTriangle } from "lucide-react";
import type { Ingredient, Order, OrderItem } from "@/types";

// Extended interface for Order with Items
interface FullOrder extends Order {
  items: OrderItem[];
}

export default function CrewPackingPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"pack_order" | "repack_glaze" | "repack_cinnamon" | "manual_usage">("pack_order");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(true);

  // 1. Pack Order State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<FullOrder | null>(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const [glazeSelections, setGlazeSelections] = useState<Record<string, string>>({}); // string to easily handle raw input

  // 2. Repack Glaze State
  const [glazeFlavor, setGlazeFlavor] = useState("coklat");
  const [glazeBulkQty, setGlazeBulkQty] = useState("");
  const [glazeCupQty, setGlazeCupQty] = useState("");

  // 3. Repack Cinnamon State
  const [cinnamonSugarQty, setCinnamonSugarQty] = useState("");
  const [cinnamonPowderQty, setCinnamonPowderQty] = useState("");
  const [cinnamonFinalQty, setCinnamonFinalQty] = useState("");

  // 4. Manual Usage State (Original functionality)
  const [manualEntries, setManualEntries] = useState<Map<string, string>>(new Map());
  const [manualNotes, setManualNotes] = useState("");

  // Status state
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

  // Load Ingredients
  const loadIngredients = useCallback(async () => {
    setLoadingIngredients(true);
    try {
      const res = await fetchWithAuth("/api/ingredients");
      if (res.ok) {
        const data: Ingredient[] = await res.json();
        setIngredients(data);
      }
    } catch (err) {
      console.error("Gagal memuat bahan:", err);
    } finally {
      setLoadingIngredients(false);
    }
  }, [fetchWithAuth]);

  // Load Orders
  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetchWithAuth("/api/orders?status=belum_selesai");
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
        // Reset selections
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

  // Initial Load
  useEffect(() => {
    loadIngredients();
    loadOrders();
  }, [loadIngredients, loadOrders]);

  // Reload order detail when select changes
  useEffect(() => {
    if (selectedOrderId) {
      loadOrderDetail(selectedOrderId);
    } else {
      setSelectedOrder(null);
    }
  }, [selectedOrderId, loadOrderDetail]);

  // Clear notifications on tab switch
  useEffect(() => {
    setError("");
    setSuccess("");
  }, [activeTab]);

  // Calculate glaze cups and cinnamon sugar required for the selected order
  const { requiredGlazeCups, requiredCinnamonSugarGrams, hasPendingRainbow } = useMemo(() => {
    if (!selectedOrder) return { requiredGlazeCups: 0, requiredCinnamonSugarGrams: 0, hasPendingRainbow: false };

    let glazeCount = 0;
    let frozenPacks = 0;
    let pendingRainbow = false;

    selectedOrder.items.forEach((item) => {
      // Check Rainbow Assembly status
      const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";
      if (isRainbow && item.assemblyStatus === "pending_approval") {
        pendingRainbow = true;
      }

      // Glaze & cinnamon sugar rules: regular, tiktok, and full packs
      const isFrozen =
        item.productId === "churros-frozen-regular" ||
        item.productId === "churros-frozen-full" ||
        item.productId === "churros-frozen-tiktok";

      if (isFrozen) {
        glazeCount += item.qty * 2;
        frozenPacks += item.qty;
      }
    });

    return {
      requiredGlazeCups: glazeCount,
      requiredCinnamonSugarGrams: frozenPacks * 10, // 10 grams per sachet
      hasPendingRainbow: pendingRainbow,
    };
  }, [selectedOrder]);

  const selectedGlazeTotal = useMemo(() => {
    return Object.values(glazeSelections).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  }, [glazeSelections]);

  const ingredientsMap = useMemo(() => {
    return new Map(ingredients.map((i) => [i.id, i]));
  }, [ingredients]);

  // Glaze flavors list in DB
  const glazeFlavors = useMemo(() => {
    return [
      { id: "saus-coklat", name: "Glaze Coklat" },
      { id: "saus-greentea", name: "Glaze Green Tea" },
      { id: "saus-keju", name: "Glaze Keju" },
      { id: "saus-vanilla", name: "Glaze Vanilla" },
      { id: "saus-tiramisu", name: "Glaze Tiramisu" },
    ];
  }, []);

  // Update glaze selection quantity
  function handleGlazeSelect(ingId: string, val: string) {
    setGlazeSelections((prev) => ({
      ...prev,
      [ingId]: val,
    }));
  }

  // --- Submit Actions ---

  // 1. Pack Order Submission
  async function handlePackOrder() {
    if (!selectedOrderId || !selectedOrder) return;
    setError("");
    setSuccess("");

    if (requiredGlazeCups > 0 && selectedGlazeTotal !== requiredGlazeCups) {
      setError(`Jumlah cup glaze tidak sesuai. Dibutuhkan: ${requiredGlazeCups} pcs, terpilih: ${selectedGlazeTotal} pcs.`);
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
        await Promise.all([loadOrders(), loadIngredients()]);
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
    const bulkQty = parseFloat(glazeBulkQty) || 0;
    const cupQty = parseInt(glazeCupQty) || 0;

    if (bulkQty <= 0 || cupQty <= 0) {
      setError("Jumlah pemakaian curah dan cup diproduksi harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/packing", {
        method: "POST",
        body: JSON.stringify({
          action: "repack_glaze",
          flavorId: glazeFlavor,
          bulkQty,
          cupQty,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal memproses repack glaze");
      } else {
        setSuccess(`Berhasil merepack glaze flavor ${glazeFlavor}: ${bulkQty}g bulk menjadi ${cupQty} cup!`);
        setGlazeBulkQty("");
        setGlazeCupQty("");
        await loadIngredients();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  // 3. Repack Cinnamon Submission
  async function handleRepackCinnamon() {
    setError("");
    setSuccess("");
    const sugar = parseFloat(cinnamonSugarQty) || 0;
    const powder = parseFloat(cinnamonPowderQty) || 0;
    const produced = parseFloat(cinnamonFinalQty) || 0;

    if (sugar <= 0 || powder <= 0 || produced <= 0) {
      setError("Semua input jumlah bahan harus diisi angka lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/packing", {
        method: "POST",
        body: JSON.stringify({
          action: "repack_cinnamon",
          sugarQty: sugar,
          cinnamonQty: powder,
          producedQty: produced,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal memproses repack cinnamon sugar");
      } else {
        setSuccess(`Berhasil merepack cinnamon sugar: mencampur ${sugar}g gula & ${powder}g kayu manis bubuk menjadi ${produced}g Gula Halus Cinnamon!`);
        setCinnamonSugarQty("");
        setCinnamonPowderQty("");
        setCinnamonFinalQty("");
        await loadIngredients();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  // 4. Manual Usage Submission
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
        await loadIngredients();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  // Helper to update manual usage state
  function updateManualEntry(id: string, val: string) {
    const next = new Map(manualEntries);
    next.set(id, val);
    setManualEntries(next);
  }

  // Filter ingredients for manual usage: category operasional and add_on
  const manualIngredientsList = useMemo(() => {
    return ingredients.filter((i) => i.category === "operasional" || i.category === "add_on");
  }, [ingredients]);

  if (loadingIngredients && ingredients.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "#FCABB4" }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-5 bg-white shadow-sm rounded-b-[24px]">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "#FEF1F5" }}>
            <ClipboardList size={16} style={{ color: "#E85D8C" }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Modul Packing</h1>
        </div>
        <p className="text-xs text-slate-400 ml-10">
          Kelola packing pesanan, repack glaze bulk, repack gula cinnamon, dan input operasional.
        </p>
      </div>

      <div className="px-4 pt-4 md:px-8 max-w-4xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap bg-slate-100 bg-opacity-70 backdrop-blur rounded-2xl p-1 gap-1 mb-5" style={{ border: "1px solid rgba(255,255,255,0.3)" }}>
          {[
            { key: "pack_order", label: "Pack Pesanan" },
            { key: "repack_glaze", label: "Repack Saos" },
            { key: "repack_cinnamon", label: "Repack Gula Cinnamon" },
            { key: "manual_usage", label: "Pemakaian Manual" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className="flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all tap-target min-w-[80px]"
              style={
                activeTab === tab.key
                  ? { background: "#fff", color: "#E85D8C", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }
                  : { color: "#475569" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* --- Tab Content: 1. Pack Order --- */}
        {activeTab === "pack_order" && (
          <div className="space-y-4">
            {/* Orders selection list */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-pink-100 border-opacity-40">
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
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                  <PackageOpen className="mx-auto text-slate-300 mb-2" size={32} />
                  <p className="text-xs text-slate-500 font-medium">Semua pesanan sudah di-pack!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between hover:bg-pink-50"
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
                        className="font-bold px-2 py-0.5 rounded-full text-[10px]"
                        style={{ background: "#F1F5F9", color: "#64748B" }}
                      >
                        {order.channel.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected order detail */}
            {selectedOrderId && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-pink-100 border-opacity-40 space-y-4">
                {loadingOrderDetail ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#E85D8C" }} />
                  </div>
                ) : !selectedOrder ? (
                  <p className="text-xs text-center text-red-500">Detail pesanan gagal dimuat.</p>
                ) : (
                  <>
                    {/* Order summary info */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-wrap gap-4 text-xs">
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
                          <p className="text-slate-400 font-bold">Catatan Pesanan:</p>
                          <p className="italic text-slate-600">"{selectedOrder.orderNotes}"</p>
                        </div>
                      )}
                    </div>

                    {/* Rainbow pending check warning */}
                    {hasPendingRainbow && (
                      <div className="rounded-2xl px-4 py-3 bg-amber-50 border border-amber-200 text-slate-700 flex items-start gap-2.5">
                        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-800">Rainbow Assembly Pending</p>
                          <p className="text-xxs text-amber-700">
                            Pesanan ini berisi Churros Rainbow yang belum di-assembly oleh Manager. Minta Manager untuk menyetujui assembly di menu admin terlebih dahulu sebelum Anda menyelesaikan packing.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Items checklist */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Item Pesanan</h3>
                      <div className="space-y-2">
                        {selectedOrder.items.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-slate-100 bg-slate-50 bg-opacity-40 flex justify-between items-center text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-800">{item.productName}</p>
                              <p className="text-slate-400">Varian: {item.variantName}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-slate-700 text-sm">{item.qty} pack</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Glaze & Cinnamon Packing Requirements */}
                    {(requiredGlazeCups > 0 || requiredCinnamonSugarGrams > 0) && (
                      <div className="border-t border-slate-100 pt-4 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bahan Pelengkap Wajib</h3>

                        {/* Cinnamon Sugar info */}
                        {requiredCinnamonSugarGrams > 0 && (
                          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-slate-800">Gula Halus Cinnamon</p>
                              <p className="text-slate-400 text-xxs">1 sachet (10g) per pack</p>
                            </div>
                            <span className="font-bold text-slate-700">{requiredCinnamonSugarGrams / 10} sachet ({requiredCinnamonSugarGrams}g)</span>
                          </div>
                        )}

                        {/* Glaze selector form */}
                        {requiredGlazeCups > 0 && (
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <p className="font-bold text-slate-800">Saus Glaze (Pilih Rasa)</p>
                                <span
                                  className="font-bold px-2 py-0.5 rounded-lg text-xxs"
                                  style={
                                    selectedGlazeTotal === requiredGlazeCups
                                      ? { background: "#DCFCE7", color: "#16A34A" }
                                      : { background: "#FEE2E2", color: "#DC2626" }
                                  }
                                >
                                  {selectedGlazeTotal} / {requiredGlazeCups} cup
                                </span>
                              </div>
                              <p className="text-xxs text-slate-400">
                                Pilih rasa cup saos glaze yang dimasukkan ke dalam paket pesanan.
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {glazeFlavors.map((flavor) => {
                                const dbIng = ingredientsMap.get(flavor.id);
                                const currentFlavorStock = dbIng?.currentStock ?? 0;

                                return (
                                  <div
                                    key={flavor.id}
                                    className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2"
                                  >
                                    <div>
                                      <p className="text-xs font-bold text-slate-800">{flavor.name}</p>
                                      <p className="text-xxs text-slate-400">Stok: {currentFlavorStock} pcs</p>
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
                    )}

                    {/* Submit Order Packing */}
                    <button
                      onClick={handlePackOrder}
                      disabled={submitting || hasPendingRainbow || (requiredGlazeCups > 0 && selectedGlazeTotal !== requiredGlazeCups)}
                      className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 tap-target"
                      style={{
                        background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
                        boxShadow: "0 8px 20px rgba(232,93,140,0.3)",
                      }}
                    >
                      {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                      Selesai Packing & Selesaikan Order
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- Tab Content: 2. Repack Glaze --- */}
        {activeTab === "repack_glaze" && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-pink-100 border-opacity-40 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-800 mb-2">Packing Saos Glaze dari Supplier</h2>
            <p className="text-xs text-slate-400">
              Konversikan saos glaze curah dari kemasan plastik supplier menjadi cup saos kecil 25ml siap saji.
            </p>

            <div className="space-y-3">
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

              {/* Display Stock Comparison */}
              {(() => {
                const bulkIng = ingredientsMap.get(`glaze-${glazeFlavor}-bulk`);
                const cupIng = ingredientsMap.get(`saus-${glazeFlavor}`);
                return (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xxs text-slate-500">
                    <div>
                      <p className="font-bold text-slate-400">Sisa Stok Curah:</p>
                      <p className="text-xs font-bold text-slate-700">{bulkIng?.currentStock ?? 0} {bulkIng?.baseUnit}</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-400">Sisa Stok Cup:</p>
                      <p className="text-xs font-bold text-slate-700">{cupIng?.currentStock ?? 0} {cupIng?.baseUnit}</p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Curah Terpakai (gram)</label>
                  <Input
                    type="number"
                    placeholder="Contoh: 1000"
                    value={glazeBulkQty}
                    onChange={(e) => setGlazeBulkQty(e.target.value)}
                    className="h-12 rounded-xl text-sm border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Cup Dihasilkan (pcs)</label>
                  <Input
                    type="number"
                    placeholder="Contoh: 50"
                    value={glazeCupQty}
                    onChange={(e) => setGlazeCupQty(e.target.value)}
                    className="h-12 rounded-xl text-sm border-slate-200"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleRepackGlaze}
              disabled={submitting}
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
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-pink-100 border-opacity-40 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-800 mb-2">Blender Gula Cinnamon</h2>
            <p className="text-xs text-slate-400">
              Catat pencampuran Gula Pasir biasa dan Kayu Manis Bubuk menjadi Gula Halus Cinnamon.
            </p>

            <div className="space-y-3">
              {/* Display Stock Info */}
              {(() => {
                const sugarIng = ingredientsMap.get("gula-pasir");
                const powderIng = ingredientsMap.get("bubuk-kayu-manis");
                const finalIng = ingredientsMap.get("gula-halus-cinnamon");
                return (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xxs text-slate-500">
                    <div>
                      <p className="font-bold text-slate-400">Gula Pasir:</p>
                      <p className="text-xs font-bold text-slate-700">{sugarIng?.currentStock ?? 0}g</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-400">Bubuk Kayu Manis:</p>
                      <p className="text-xs font-bold text-slate-700">{powderIng?.currentStock ?? 0}g</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-400">Gula Cinnamon:</p>
                      <p className="text-xs font-bold text-slate-700">{finalIng?.currentStock ?? 0}g</p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Gula (gram)</label>
                  <Input
                    type="number"
                    placeholder="Gula pasir"
                    value={cinnamonSugarQty}
                    onChange={(e) => setCinnamonSugarQty(e.target.value)}
                    className="h-12 rounded-xl text-sm border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Kayu Manis (g)</label>
                  <Input
                    type="number"
                    placeholder="Bubuk"
                    value={cinnamonPowderQty}
                    onChange={(e) => setCinnamonPowderQty(e.target.value)}
                    className="h-12 rounded-xl text-sm border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Hasil Blend (g)</label>
                  <Input
                    type="number"
                    placeholder="Gula cinnamon"
                    value={cinnamonFinalQty}
                    onChange={(e) => setCinnamonFinalQty(e.target.value)}
                    className="h-12 rounded-xl text-sm border-slate-200"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleRepackCinnamon}
              disabled={submitting}
              className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70 tap-target"
              style={{
                background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
                boxShadow: "0 8px 20px rgba(232,93,140,0.3)",
              }}
            >
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              Simpan Blend Cinnamon Sugar
            </button>
          </div>
        )}

        {/* --- Tab Content: 4. Manual Material Usage --- */}
        {activeTab === "manual_usage" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-pink-100 border-opacity-40">
              <h2 className="text-sm font-extrabold text-slate-800 mb-2">Pemakaian Bahan Operasional & Add-On</h2>
              <p className="text-xs text-slate-400 mb-4">
                Catat pemakaian plastik kemasan, box, stiker label, cup glaze, dan pelengkap secara manual jika ada selisih/pemakaian di luar order.
              </p>

              {manualIngredientsList.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 border border-slate-100 rounded-2xl">
                  <PackageOpen className="mx-auto text-slate-300 mb-3" size={40} />
                  <p className="text-sm text-slate-500 font-medium">Belum ada bahan operasional/add-on</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {manualIngredientsList.map((ing) => (
                    <div
                      key={ing.id}
                      className="p-3.5 rounded-xl border border-slate-100 flex items-center justify-between gap-3 bg-slate-50 bg-opacity-40"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800">{ing.name}</p>
                        <p className="text-[10px] text-slate-400">
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
                        <span className="text-[10px] font-semibold text-slate-400 min-w-[30px]">
                          {ing.baseUnit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {manualIngredientsList.length > 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-pink-100 border-opacity-40 space-y-4">
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
