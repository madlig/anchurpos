"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, PackageOpen, AlertTriangle, Check } from "lucide-react";
import type { Order, OrderItem, Ingredient } from "@/types";

interface FullOrder extends Order {
  items: OrderItem[];
}

interface Props {
  ingredients: Ingredient[];
  onSuccess: () => void;
}

export function OrderFulfillmentTab({ ingredients, onSuccess }: Props) {
  const { getToken } = useAuth();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<FullOrder | null>(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const [glazeSelections, setGlazeSelections] = useState<Record<string, string>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/orders?status=proses", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: Order[] = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error("Gagal memuat pesanan:", err);
    } finally {
      setLoadingOrders(false);
    }
  }, [getToken]);

  const loadOrderDetail = useCallback(async (orderId: string) => {
    setLoadingOrderDetail(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
  }, [getToken]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (selectedOrderId) {
      loadOrderDetail(selectedOrderId);
    } else {
      setSelectedOrder(null);
    }
  }, [selectedOrderId, loadOrderDetail]);

  const orderRequirements = useMemo(() => {
    if (!selectedOrder) return { reqGlazeStandard: 0, reqGlazeTikTok: 0, reqCinnamonClips: 0, hasPendingRainbow: false };
    
    let standardGlazes = 0;
    let tiktokGlazes = 0;
    let frozenPacks = 0;
    let pendingRainbow = false;

    selectedOrder.items.forEach((item) => {
      const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";
      if (isRainbow && item.assemblyStatus === "pending_approval") pendingRainbow = true;
      if (item.productId === "churros-frozen-regular" || item.productId === "churros-frozen-full") {
        standardGlazes += item.qty * 2;
        frozenPacks += item.qty;
      } else if (item.productId === "churros-frozen-tiktok") {
        tiktokGlazes += item.qty * 2;
        frozenPacks += item.qty;
      }
    });

    return { reqGlazeStandard: standardGlazes, reqGlazeTikTok: tiktokGlazes, reqCinnamonClips: frozenPacks, hasPendingRainbow: pendingRainbow };
  }, [selectedOrder]);

  const glazeSelectionsTotals = useMemo(() => {
    let standardTotal = 0;
    let tiktokTotal = 0;
    Object.entries(glazeSelections).forEach(([id, val]) => {
      const q = parseInt(val) || 0;
      if (id.endsWith("-tiktok")) tiktokTotal += q;
      else standardTotal += q;
    });
    return { selectedStandardTotal: standardTotal, selectedTikTokTotal: tiktokTotal };
  }, [glazeSelections]);

  const ingredientsMap = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const glazeStandardOptions = useMemo(() => [
    { id: "saus-coklat", name: "Glaze Coklat" },
    { id: "saus-greentea", name: "Glaze Green Tea" },
    { id: "saus-keju", name: "Glaze Keju" },
    { id: "saus-vanilla", name: "Glaze Vanilla" },
    { id: "saus-tiramisu", name: "Glaze Tiramisu" },
  ], []);

  const glazeTikTokOptions = useMemo(() => [
    { id: "saus-coklat-tiktok", name: "Glaze Coklat TikTok" },
    { id: "saus-greentea-tiktok", name: "Glaze Green Tea TikTok" },
    { id: "saus-keju-tiktok", name: "Glaze Keju TikTok" },
    { id: "saus-vanilla-tiktok", name: "Glaze Vanilla TikTok" },
    { id: "saus-tiramisu-tiktok", name: "Glaze Tiramisu TikTok" },
  ], []);

  const handleGlazeSelect = (flavorId: string, val: string) => {
    setGlazeSelections((prev) => ({ ...prev, [flavorId]: val }));
  };

  async function handlePackOrder() {
    if (!selectedOrderId || !selectedOrder) return;
    setError("");
    setSuccessMsg("");

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
      const token = await getToken();
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "pack_order", orderId: selectedOrderId, glazeSelections: selections }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal menyelesaikan packing");
      } else {
        setSuccessMsg(`Berhasil memproses packing untuk order ${selectedOrder.orderNumber}!`);
        setSelectedOrderId(null);
        setSelectedOrder(null);
        await loadOrders();
        onSuccess();
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-600 text-xs p-3.5 rounded-xl border border-red-100">{error}</div>}
      {successMsg && <div className="bg-green-50 text-green-700 text-xs p-3.5 rounded-xl border border-green-100">{successMsg}</div>}

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-extrabold text-slate-800">Pilih Pesanan Pending</h2>
          <button onClick={loadOrders} disabled={loadingOrders} className="flex items-center gap-1 text-xs font-bold tap-target transition-all active:scale-95 text-primary">
            <RefreshCw size={12} className={loadingOrders ? "animate-spin" : ""} /> Segarkan
          </button>
        </div>

        {loadingOrders && orders.length === 0 ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
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
                style={selectedOrderId === order.id ? { border: "2px solid #E85D8C", background: "#FEF1F5" } : { border: "1px solid #F1F5F9", background: "#fff" }}
              >
                <div>
                  <p className="font-extrabold text-slate-800 text-sm mb-0.5">{order.orderNumber}</p>
                  <p className="text-slate-400 text-xxs">Customer: {order.customerName}</p>
                </div>
                <span className="font-bold px-2 py-0.5 rounded-full text-xs" style={{ background: "#F1F5F9", color: "#64748B" }}>{order.channel.toUpperCase()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedOrderId && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-4">
          {loadingOrderDetail ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !selectedOrder ? (
            <p className="text-xs text-center text-red-500">Detail pesanan gagal dimuat.</p>
          ) : (
            <>
              <div className="p-4 rounded-2xl bg-brand-50 border border-slate-100 flex flex-wrap gap-4 text-xs">
                <div><p className="text-slate-400">Order No:</p><p className="font-bold text-slate-800">{selectedOrder.orderNumber}</p></div>
                <div><p className="text-slate-400">Customer:</p><p className="font-bold text-slate-800">{selectedOrder.customerName}</p></div>
                {selectedOrder.customerPhone && (
                  <div><p className="text-slate-400">No HP:</p><p className="font-bold text-slate-800">{selectedOrder.customerPhone}</p></div>
                )}
                {selectedOrder.orderNotes && (
                  <div className="w-full border-t border-slate-100 pt-2"><p className="text-slate-400 font-bold">Catatan:</p><p className="italic text-slate-600">"{selectedOrder.orderNotes}"</p></div>
                )}
              </div>

              {orderRequirements.hasPendingRainbow && (
                <div className="rounded-2xl px-4 py-3 bg-amber-50 border border-amber-200 text-slate-700 flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-800">Rainbow Assembly Pending</p>
                    <p className="text-xxs text-amber-700">Pesanan ini berisi Churros Rainbow yang belum di-assembly. Harap hubungi Manager.</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Item Pesanan</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="p-3 rounded-xl border border-slate-100 bg-brand-50 bg-opacity-40 flex justify-between items-center text-xs">
                      <div><p className="font-bold text-slate-800">{item.productName}</p><p className="text-slate-400">Varian: {item.variantName}</p></div>
                      <span className="font-extrabold text-slate-700 text-sm">{item.qty} pack</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bahan Pelengkap</h3>
                {orderRequirements.reqCinnamonClips > 0 && (
                  <div className="p-3.5 rounded-xl border border-slate-100 bg-brand-50 flex items-center justify-between text-xs">
                    <div><p className="font-bold text-slate-800">Gula Halus Cinnamon</p><p className="text-slate-400 text-xxs">1 sachet per pack frozen</p></div>
                    <span className="font-extrabold text-slate-700">{orderRequirements.reqCinnamonClips} sachet</span>
                  </div>
                )}

                {orderRequirements.reqGlazeStandard > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div><p className="font-bold text-slate-800">Cup Glaze Standard</p><p className="text-xxs text-slate-400">Pilih rasa (2 cup per pack)</p></div>
                      <span className="font-bold px-2 py-0.5 rounded-lg text-xxs" style={glazeSelectionsTotals.selectedStandardTotal === orderRequirements.reqGlazeStandard ? { background: "#DCFCE7", color: "#16A34A" } : { background: "#FEE2E2", color: "#DC2626" }}>
                        {glazeSelectionsTotals.selectedStandardTotal} / {orderRequirements.reqGlazeStandard} pcs
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {glazeStandardOptions.map((flavor) => (
                        <div key={flavor.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                          <div><p className="text-xs font-bold text-slate-800">{flavor.name}</p><p className="text-xxs text-slate-400">Stok: {ingredientsMap.get(flavor.id)?.currentStock ?? 0} pcs</p></div>
                          <Input type="number" placeholder="0" value={glazeSelections[flavor.id] || ""} onChange={(e) => handleGlazeSelect(flavor.id, e.target.value)} className="w-16 h-8 text-center text-xs font-bold rounded-lg border-slate-200" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {orderRequirements.reqGlazeTikTok > 0 && (
                  <div className="space-y-3 border-t border-slate-100 border-dashed pt-4">
                    <div className="flex items-center justify-between text-xs">
                      <div><p className="font-bold text-slate-800">Plastik Glaze TikTok</p><p className="text-xxs text-slate-400">Pilih rasa (2 plastik per pack)</p></div>
                      <span className="font-bold px-2 py-0.5 rounded-lg text-xxs" style={glazeSelectionsTotals.selectedTikTokTotal === orderRequirements.reqGlazeTikTok ? { background: "#DCFCE7", color: "#16A34A" } : { background: "#FEE2E2", color: "#DC2626" }}>
                        {glazeSelectionsTotals.selectedTikTokTotal} / {orderRequirements.reqGlazeTikTok} pcs
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {glazeTikTokOptions.map((flavor) => (
                        <div key={flavor.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                          <div><p className="text-xs font-bold text-slate-800">{flavor.name}</p><p className="text-xxs text-slate-400">Stok: {ingredientsMap.get(flavor.id)?.currentStock ?? 0} pcs</p></div>
                          <Input type="number" placeholder="0" value={glazeSelections[flavor.id] || ""} onChange={(e) => handleGlazeSelect(flavor.id, e.target.value)} className="w-16 h-8 text-center text-xs font-bold rounded-lg border-slate-200" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handlePackOrder}
                disabled={submitting || orderRequirements.hasPendingRainbow || (orderRequirements.reqGlazeStandard > 0 && glazeSelectionsTotals.selectedStandardTotal !== orderRequirements.reqGlazeStandard) || (orderRequirements.reqGlazeTikTok > 0 && glazeSelectionsTotals.selectedTikTokTotal !== orderRequirements.reqGlazeTikTok)}
                className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 tap-target"
                style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)", boxShadow: "0 8px 20px rgba(232,93,140,0.3)" }}
              >
                {submitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                Selesai Packing & Tandai Order Selesai
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
