"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface OrderItem { productName: string; variantName: string; qty: number; basePrice: number; totalPrice: number; }
interface OrderDetail {
  id: string; orderNumber: string; customerName: string; customerPhone: string | null;
  channel: string; orderChannel: string; customerType: string | null;
  createdAt: string; completedAt: string | null;
  paymentStatus: string; paymentMethod: string | null; shippingCost: number | null;
  platformFee: number; netRevenue: number | null;
  orderNotes: string | null; items: OrderItem[];
}


function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function InvoicePage() {
  const { getToken } = useAuth();
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(async (url: string) => {
    const token = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [getToken]);

  useEffect(() => {
    fetchWithAuth(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(d => setOrder(d))
      .finally(() => setLoading(false));
  }, [fetchWithAuth, orderId]);

  useEffect(() => {
    if (!loading && order) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, order]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <Loader2 className="animate-spin" size={28} />
    </div>
  );

  if (!order) return <div style={{ textAlign: "center", padding: "40px" }}>Invoice tidak ditemukan</div>;

  const subtotal = order.items.reduce((s, i) => s + i.totalPrice, 0);
  const shipping = order.shippingCost ?? 0;
  const total = subtotal + shipping;
  const isPaid = order.paymentStatus === "sudah_bayar";
  const isB2B = order.customerType === "b2b" || order.customerType === "reseller";
  const docTitle = isB2B ? "INVOICE" : "NOTA";

  return (
    <>
      {/* Print button — tersembunyi saat print */}
      <div className="no-print" style={{ padding: "16px", display: "flex", justifyContent: "flex-end", gap: "8px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
        <button onClick={() => window.print()}
          style={{ padding: "8px 20px", borderRadius: "10px", background: "#E85D8C", color: "#fff", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
          Cetak Invoice
        </button>
        <button onClick={() => window.close()}
          style={{ padding: "8px 20px", borderRadius: "10px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "13px" }}>
          Tutup
        </button>
      </div>

      {/* Invoice document */}
      <div id="invoice" style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 32px", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#1C1C1E" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", borderBottom: "2px solid #E85D8C", paddingBottom: "24px" }}>
          <div>
            <img src="/logo.png" alt="Anchur Logo" style={{ width: "auto", height: "64px", objectFit: "contain", marginBottom: "12px", borderRadius: "12px" }} />
            <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#E85D8C", margin: 0 }}>AnchurPOS</h1>
            <p style={{ fontSize: "12px", color: "#94A3B8", margin: "2px 0 0" }}>Sistem Manajemen Produksi</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#1C1C1E", margin: "0 0 6px" }}>{docTitle}</h2>
            <p style={{ fontSize: "13px", fontFamily: "monospace", color: "#64748B", margin: "0 0 4px" }}>{order.orderNumber}</p>
            <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>Tanggal: {fmtDate(order.createdAt)}</p>
            <div style={{ marginTop: "8px", display: "inline-block", padding: "4px 12px", borderRadius: "100px",
              background: isPaid ? "#DCFCE7" : "#FEE2E2",
              color: isPaid ? "#16A34A" : "#DC2626", fontSize: "11px", fontWeight: "700" }}>
              {isPaid ? "SUDAH BAYAR" : "BELUM BAYAR"}
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "28px" }}>
          <div>
            <p style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Kepada</p>
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#1C1C1E", margin: "0 0 3px" }}>{order.customerName}</p>
            {order.customerPhone && <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>{order.customerPhone}</p>}
          </div>
          <div>
            <p style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Detail Pembayaran</p>
            {order.paymentMethod && <p style={{ fontSize: "12px", color: "#64748B", margin: "0 0 2px" }}>Metode: {order.paymentMethod === "cash" ? "Tunai" : order.paymentMethod === "transfer" ? "Transfer Bank" : "QRIS"}</p>}
            {order.completedAt && <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>Selesai: {fmtDate(order.completedAt)}</p>}
          </div>
        </div>

        {/* Items table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Produk</th>
              <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", width: "60px" }}>Qty</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Harga</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "12px", fontSize: "13px" }}>
                  <p style={{ fontWeight: "600", color: "#1C1C1E", margin: "0 0 2px" }}>{item.productName}</p>
                  <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>{item.variantName}</p>
                </td>
                <td style={{ padding: "12px", textAlign: "center", fontSize: "13px", color: "#64748B" }}>{item.qty}</td>
                <td style={{ padding: "12px", textAlign: "right", fontSize: "13px", color: "#64748B" }}>{fmt(item.basePrice)}</td>
                <td style={{ padding: "12px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{fmt(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
          <div style={{ minWidth: "240px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
              <span style={{ fontSize: "13px", color: "#64748B" }}>Subtotal</span>
              <span style={{ fontSize: "13px", color: "#64748B" }}>{fmt(subtotal)}</span>
            </div>
            {shipping > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ fontSize: "13px", color: "#64748B" }}>Ongkos Kirim</span>
                <span style={{ fontSize: "13px", color: "#64748B" }}>{fmt(shipping)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "2px solid #E85D8C", marginTop: "6px" }}>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#1C1C1E" }}>Total</span>
              <span style={{ fontSize: "18px", fontWeight: "800", color: "#E85D8C" }}>{fmt(total)}</span>
            </div>
            {!isPaid && (
              <div style={{ marginTop: "12px", padding: "10px 12px", borderRadius: "8px", background: "#FEE2E2", border: "1px solid #FECACA" }}>
                <p style={{ fontSize: "12px", fontWeight: "600", color: "#DC2626", margin: 0 }}>⚠ Mohon segera melakukan pembayaran.</p>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {order.orderNotes && (
          <div style={{ padding: "12px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid #E2E8F0", marginBottom: "24px" }}>
            <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", margin: "0 0 4px" }}>Catatan</p>
            <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>{order.orderNotes}</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "20px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 4px" }}>Terima kasih atas kepercayaan Anda.</p>
          <p style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>Dokumen ini dibuat secara otomatis oleh AnchurPOS</p>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          #invoice { max-width: 100%; padding: 20px; }
        }
      `}</style>
    </>
  );
}
