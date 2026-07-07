"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CheckCircle2, Clock, CreditCard, Ban, Package, User, Printer } from "lucide-react";

interface OrderItem {
  id: string; productName: string; variantName: string;
  qty: number; basePrice: number; discountPerUnit: number; totalPrice: number;
  assemblyStatus: string | null;
}
interface OrderDetail {
  id: string; orderNumber: string; source: string;
  customerId: string | null; customerName: string; customerPhone: string | null;
  channel: string; status: string; paymentStatus: string; paymentMethod: string | null;
  shippingAddress: string | null; shippingCost: number | null; shippingCostConfirmed: boolean;
  shippingBorneBy: string | null; deliveryMethod: string | null;
  requestedDeliveryDate: string | null; orderNotes: string | null;
  voidReason: string | null; voidedAt: string | null;
  createdAt: string; completedAt: string | null; items: OrderItem[];
}



function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function OrderDetailPage() {
  const { getToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidReasonError, setVoidReasonError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const loadOrder = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/orders/${orderId}`);
      if (res.ok) setOrder(await res.json());
    } finally { setLoading(false); }
  }, [fetchWithAuth, orderId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  async function markComplete() {
    setActionLoading("status"); setError("");
    try {
      const res = await fetchWithAuth(`/api/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status: "selesai" }) });
      if (!res.ok) { setError((await res.json()).error ?? "Gagal update status"); return; }
      await loadOrder();
    } finally { setActionLoading(""); }
  }

  async function voidOrder() {
    if (!voidReason.trim()) {
      setVoidReasonError("Alasan pembatalan wajib diisi.");
      return;
    }
    setVoidReasonError("");
    setActionLoading("void"); setError("");
    try {
      const res = await fetchWithAuth(`/api/orders/${orderId}/void`, { method: "POST", body: JSON.stringify({ voidReason: voidReason.trim() }) });
      if (!res.ok) { setError((await res.json()).error ?? "Gagal void order"); return; }
      await loadOrder();
      setShowVoidModal(false);
      setVoidReason("");
    } finally { setActionLoading(""); }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
    </div>
  );

  if (!order) return (
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: "#FCABB4" }}>
      <p style={{ fontSize: "14px", color: "#64748B" }}>Order tidak ditemukan</p>
      <button onClick={() => router.back()} style={{ marginTop: "12px", padding: "10px 20px", borderRadius: "12px", background: "#E85D8C", color: "#fff", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
        Kembali
      </button>
    </div>
  );

  const itemsTotal = order.items.reduce((s, i) => s + i.totalPrice, 0);
  const grandTotal = itemsTotal + (order.shippingCostConfirmed ? (order.shippingCost ?? 0) : 0);
  const isPaid = order.paymentStatus === "sudah_bayar";
  const isDone = order.status === "selesai";
  const isVoid = order.status === "void";

  return (
    <div className="min-h-screen" style={{ background: "#FCABB4" }}>

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20" style={{ background: "#fff", borderBottom: "1px solid #F1F5F9" }}>
        <div className="flex items-center gap-3 px-5 py-4">
          <button onClick={() => router.back()} data-testid="back-button"
            style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#F8FAFC", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ArrowLeft size={16} style={{ color: "#64748B" }} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 style={{ fontSize: "16px", fontWeight: "700", color: "#1C1C1E", lineHeight: 1.2 }}>{order.orderNumber}</h1>
            <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>{fmtDate(order.createdAt)}</p>
          </div>
          {/* Status badge */}
          <span style={{
            padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600",
            color: isVoid ? "#DC2626" : isDone ? "#16A34A" : "#D97706",
            background: isVoid ? "#FEE2E2" : isDone ? "#DCFCE7" : "#FEF3C7",
          }}>
            {isVoid ? "Void" : isDone ? "Selesai" : "Pending"}
          </span>
        </div>
      </div>

      <div className="px-4 pt-3 pb-24 flex flex-col gap-3">

        {/* ── Success Banner (setelah checkout baru) ── */}
        {isDone && (
          <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #DCFCE7", display: "flex", alignItems: "center", gap: "10px" }} data-testid="success-banner">
            <div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CheckCircle2 size={18} style={{ color: "#16A34A" }} />
            </div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: "700", color: "#16A34A" }}>Order Selesai</p>
              <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Pesanan sudah dikonfirmasi selesai</p>
            </div>
          </div>
        )}

        {/* ── Customer Card ── */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }} data-testid="customer-card">
          <div className="flex items-center gap-2" style={{ marginBottom: "10px" }}>
            <User size={13} style={{ color: "#E85D8C" }} />
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pelanggan</span>
          </div>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>{order.customerName}</p>
          {order.customerPhone && <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{order.customerPhone}</p>}
          {order.orderNotes && (
            <p style={{ fontSize: "12px", color: "#64748B", marginTop: "6px", fontStyle: "italic" }}>"{order.orderNotes}"</p>
          )}
        </div>

        {/* ── Items Card ── */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }} data-testid="items-card">
          <div className="flex items-center gap-2" style={{ marginBottom: "10px" }}>
            <Package size={13} style={{ color: "#E85D8C" }} />
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Item Pesanan</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#E85D8C" }}>{item.qty}x</span>
                  </div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{item.productName}</p>
                    <p style={{ fontSize: "11px", color: "#94A3B8" }}>{item.variantName} · {fmt(item.basePrice)}/pack</p>
                  </div>
                </div>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>{fmt(item.totalPrice)}</span>
              </div>
            ))}
          </div>

          {/* Divider + Total */}
          <div style={{ borderTop: "1px solid #F1F5F9", marginTop: "12px", paddingTop: "10px" }}>
            <div className="flex justify-between" style={{ marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "#94A3B8" }}>Subtotal</span>
              <span style={{ fontSize: "12px", color: "#64748B" }}>{fmt(itemsTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>Total</span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#E85D8C" }}>{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* ── Payment Status ── */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }} data-testid="payment-card">
          <div className="flex items-center gap-2" style={{ marginBottom: "10px" }}>
            <CreditCard size={13} style={{ color: "#E85D8C" }} />
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pembayaran</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span style={{
                padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600",
                color: isPaid ? "#16A34A" : "#DC2626",
                background: isPaid ? "#DCFCE7" : "#FEE2E2",
              }}>
                {isPaid ? "Lunas" : "Belum Bayar"}
              </span>
              {order.paymentMethod && (
                <span style={{ fontSize: "11px", color: "#94A3B8", marginLeft: "8px", textTransform: "capitalize" }}>
                  via {order.paymentMethod === "cash" ? "Tunai" : order.paymentMethod === "transfer" ? "Transfer" : order.paymentMethod.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        {!isVoid && (
          <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }} data-testid="action-card">
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "10px" }}>Aksi</span>

            {/* Print Invoice — tampil hanya untuk pelanggan B2B */}
            {order.channel === "b2b" && (
              <button
                onClick={() => window.open(`/manager/orders/${order.id}/invoice`, "_blank")}
                data-testid="print-invoice-btn"
                className="w-full flex items-center justify-center gap-2 mb-2"
                style={{ padding: "11px", borderRadius: "12px", background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                <Printer size={14} />
                Cetak Invoice B2B
              </button>
            )}

            {!isDone && (
              <>
                <button
                  onClick={() => router.push(`/manager/orders/${order.id}/edit`)}
                  data-testid="edit-order-btn"
                  className="w-full flex items-center justify-center gap-2 mb-2"
                  style={{ padding: "11px", borderRadius: "12px", background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                  Edit Order
                </button>
                <button
                  onClick={markComplete}
                  disabled={actionLoading === "status"}
                  data-testid="mark-complete-btn"
                  className="w-full flex items-center justify-center gap-2"
                  style={{ padding: "12px", borderRadius: "12px", background: "#E85D8C", color: "#fff", border: "none", cursor: actionLoading ? "default" : "pointer", fontSize: "13px", fontWeight: "700", opacity: actionLoading === "status" ? 0.7 : 1 }}>
                  {actionLoading === "status" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Tandai Selesai
                </button>
              </>
            )}

            {!isVoid && (
              <button
                onClick={() => setShowVoidModal(true)}
                data-testid="void-btn"
                className="w-full flex items-center justify-center gap-2 mt-2"
                style={{ padding: "11px", borderRadius: "12px", background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                <Ban size={14} />
                Batalkan Order (Void)
              </button>
            )}
          </div>
        )}

        {/* ── Void Banner ─── */}
        {isVoid && (
          <div style={{ background: "#FEF2F2", borderRadius: "14px", padding: "14px", border: "1px solid #FECACA" }} data-testid="void-banner">
            <div className="flex items-center gap-2 mb-1.5">
              <Ban size={14} style={{ color: "#DC2626", flexShrink: 0 }} />
              <p style={{ fontSize: "13px", fontWeight: "700", color: "#DC2626" }}>Order Telah Dibatalkan</p>
            </div>
            {(order as any).voidReason && (
              <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "4px", fontStyle: "italic" }}>Alasan: {(order as any).voidReason}</p>
            )}
          </div>
        )}

        {/* ── Void Modal ─── */}
        {showVoidModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={(e) => { if (e.target === e.currentTarget) { setShowVoidModal(false); setVoidReason(""); setVoidReasonError(""); } }}>
            <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px", width: "100%", maxWidth: "480px", paddingBottom: "32px" }}>
              <div className="flex items-center gap-2 mb-4">
                <Ban size={16} style={{ color: "#DC2626" }} />
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1C1C1E" }}>Batalkan Order</h3>
              </div>
              <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "12px", lineHeight: "1.5" }}>
                Pesanan akan dibatalkan dan stok akan dikembalikan ke inventaris. Tindakan ini tidak dapat diurungkan.
              </p>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Alasan Pembatalan *</label>
              <textarea
                value={voidReason}
                onChange={(e) => { setVoidReason(e.target.value); if (voidReasonError) setVoidReasonError(""); }}
                placeholder="Contoh: Salah input pesanan, pelanggan membatalkan, dll."
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: `1px solid ${voidReasonError ? "#DC2626" : "#E2E8F0"}`, fontSize: "12px", outline: "none", resize: "none", color: "#1C1C1E", boxSizing: "border-box" }}
              />
              {voidReasonError && <p style={{ fontSize: "11px", color: "#DC2626", marginTop: "4px" }}>{voidReasonError}</p>}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={voidOrder}
                  disabled={actionLoading === "void"}
                  data-testid="confirm-void-btn"
                  style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "#DC2626", color: "#fff", border: "none", cursor: actionLoading === "void" ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: actionLoading === "void" ? 0.7 : 1 }}>
                  {actionLoading === "void" ? <Loader2 size={14} className="animate-spin" /> : <><Ban size={14} /> Batalkan Order</>}
                </button>
                <button
                  onClick={() => { setShowVoidModal(false); setVoidReason(""); setVoidReasonError(""); }}
                  style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <p style={{ fontSize: "12px", color: "#DC2626", textAlign: "center" }}>{error}</p>}

        {/* ── Order Info ── */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "11px", color: "#94A3B8" }}>Metode</span>
            <span style={{ fontSize: "12px", fontWeight: "500", color: "#64748B", textTransform: "capitalize" }}>
              {order.source === "walk_in" ? "Walk-in / Kasir" : order.source}
            </span>
          </div>
          <div className="flex items-center justify-between" style={{ marginTop: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94A3B8" }}>No. Order</span>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#1C1C1E", fontFamily: "monospace" }}>{order.orderNumber}</span>
          </div>
          {order.deliveryMethod && (
            <div className="flex items-center justify-between" style={{ marginTop: "6px" }}>
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>Pengiriman</span>
              <span style={{ fontSize: "12px", fontWeight: "500", color: "#64748B" }}>
                {order.deliveryMethod === "pickup" ? "Ambil Sendiri (Pickup)"
                  : order.deliveryMethod === "self_delivery" ? "Diantar oleh Toko"
                  : "Kurir Online"}
              </span>
            </div>
          )}
          {order.deliveryMethod !== "pickup" && (order.shippingCost ?? 0) > 0 && (
            <div className="flex items-center justify-between" style={{ marginTop: "6px" }}>
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>Ongkir</span>
              <span style={{ fontSize: "12px", fontWeight: "500", color: "#64748B" }}>
                {fmt(order.shippingCost ?? 0)}
                {order.shippingBorneBy && (
                  <span style={{ fontSize: "10px", color: "#94A3B8", marginLeft: "4px" }}>
                    ({order.shippingBorneBy === "customer" ? "Ditanggung Pembeli" : "Ditanggung Toko"})
                  </span>
                )}
              </span>
            </div>
          )}
          {order.completedAt && (
            <div className="flex items-center justify-between" style={{ marginTop: "6px" }}>
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>Selesai</span>
              <span style={{ fontSize: "12px", color: "#64748B" }}>{fmtDate(order.completedAt)}</span>
            </div>
          )}
        </div>


      </div>
    </div>
  );
}
