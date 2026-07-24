"use client";

import { useEffect, useState, useCallback } from "react";
import { formatRupiah } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatters";
import { useAuth } from "@/lib/auth-context";
import { Loader2, CheckCircle2, Ban, Package, Printer, MapPin, Truck, CreditCard } from "lucide-react";

interface OrderItem {
  id: string; productName: string; variantName: string;
  qty: number; basePrice: number; discountPerUnit: number; totalPrice: number;
  assemblyStatus: string | null;
}

interface OrderDetail {
  id: string; orderNumber: string; source: string;
  customerId: string | null; customerName: string; customerType: string | null; customerPhone: string | null;
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
  return formatDateTime(iso);
}

interface OrderDetailViewProps {
  orderId: string;
  onOrderUpdated?: () => void;
  onClose?: () => void;
}

export function OrderDetailView({ orderId, onOrderUpdated, onClose }: OrderDetailViewProps) {
  const { getToken, user } = useAuth();
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
    setLoading(true);
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
      if (onOrderUpdated) onOrderUpdated();
    } finally { setActionLoading(""); }
  }

  async function markAsPaid() {
    setActionLoading("payment"); setError("");
    try {
      const res = await fetchWithAuth(`/api/orders/${orderId}/payment`, { method: "PATCH", body: JSON.stringify({ paymentStatus: "sudah_bayar" }) });
      if (!res.ok) { setError((await res.json()).error ?? "Gagal update pembayaran"); return; }
      await loadOrder();
      if (onOrderUpdated) onOrderUpdated();
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
      if (onOrderUpdated) onOrderUpdated();
    } finally { setActionLoading(""); }
  }

  function printReceipt() {
    if (!order) return;
    
    // Receipt format tailored for 58mm POS printer (Best Practice Professional Format)
    const cashierName = user?.displayName || user?.email?.split('@')[0] || "Kasir";
    const subtotal = order.items.reduce((s, i) => s + i.totalPrice, 0);
    const ongkir = order.shippingCostConfirmed ? (order.shippingCost ?? 0) : 0;
    const grandTotal = subtotal + ongkir;

    const html = `
      <html>
        <head>
          <title>Receipt ${order.orderNumber}</title>
          <style>
            body { 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 11px; 
              line-height: 1.2;
              margin: 0; 
              padding: 0; 
              width: 58mm; 
              color: #000; 
            }
            .center { text-align: center; }
            .left { text-align: left; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
            .header-title { font-size: 16px; font-weight: 900; margin-bottom: 3px; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
            .info-table td { padding: 1px 0; vertical-align: top; }
            .info-label { width: 40px; }
            .info-value { width: calc(100% - 40px); }
            
            .item-table { width: 100%; border-collapse: collapse; }
            .item-table td { padding: 1px 0; vertical-align: top; }
            .item-name { padding-bottom: 2px; }
            .item-qty { width: 20%; padding-left: 5px; }
            .item-price { width: 40%; text-align: right; }
            .item-total { width: 40%; text-align: right; font-weight: bold; }
            
            .summary-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            .summary-table td { padding: 2px 0; }
            .summary-label { text-align: left; }
            .summary-value { text-align: right; }
            .grand-total { font-size: 14px; font-weight: bold; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0 !important; }
            
            .footer { margin-top: 10px; font-size: 10px; text-align: center; }
            
            @media print {
              body { width: 100%; margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="center header-title">ANCHUR BANDUNG</div>
          <div class="center">Jl. Buah Batu No. 123</div>
          <div class="center">IG: @anchur.id</div>
          
          <div class="divider"></div>
          
          <table class="info-table">
            <tr>
              <td class="info-label">No</td>
              <td class="info-value">: ${order.orderNumber}</td>
            </tr>
            <tr>
              <td class="info-label">Tgl</td>
              <td class="info-value">: ${new Date(order.createdAt).toLocaleString('id-ID', {day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit'})}</td>
            </tr>
            <tr>
              <td class="info-label">Plg</td>
              <td class="info-value">: ${order.customerName || "Walk-in"}</td>
            </tr>
            <tr>
              <td class="info-label">Ksr</td>
              <td class="info-value">: ${cashierName}</td>
            </tr>
            <tr>
              <td class="info-label">Tipe</td>
              <td class="info-value">: ${order.channel.toUpperCase()}</td>
            </tr>
          </table>
          
          <div class="divider"></div>
          
          <table class="item-table">
            ${order.items.map(item => `
              <tr>
                <td colspan="3" class="item-name bold">${item.productName} ${item.variantName ? `- ${item.variantName}` : ""}</td>
              </tr>
              <tr>
                <td class="item-qty">${item.qty}x</td>
                <td class="item-price">@${item.basePrice.toLocaleString('id-ID')}</td>
                <td class="item-total">${item.totalPrice.toLocaleString('id-ID')}</td>
              </tr>
            `).join("")}
          </table>
          
          <div class="divider"></div>
          
          <table class="summary-table">
            <tr>
              <td class="summary-label">Subtotal</td>
              <td class="summary-value">${fmt(subtotal)}</td>
            </tr>
            ${order.shippingCostConfirmed ? `
            <tr>
              <td class="summary-label">Ongkir</td>
              <td class="summary-value">${fmt(ongkir)}</td>
            </tr>
            ` : ""}
            <tr>
              <td class="summary-label grand-total">TOTAL</td>
              <td class="summary-value grand-total">${fmt(grandTotal)}</td>
            </tr>
            <tr>
              <td class="summary-label">Status</td>
              <td class="summary-value bold">${order.paymentStatus === "sudah_bayar" ? "LUNAS" : "BELUM BAYAR"}</td>
            </tr>
            ${order.paymentMethod ? `
            <tr>
              <td class="summary-label">Metode</td>
              <td class="summary-value">${order.paymentMethod.toUpperCase()}</td>
            </tr>
            ` : ""}
          </table>
          
          <div class="divider"></div>
          
          <div class="footer">
            <div class="bold">Terima Kasih!</div>
            <div>Silakan datang kembali</div>
            <div style="margin-top: 5px;">anchurpos.vercel.app</div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!order) return (
    <div className="flex flex-col items-center justify-center h-full py-20">
      <div className="bg-white p-8 rounded-3xl flex flex-col items-center">
        <Package size={48} className="text-slate-300 mb-4" />
        <p className="text-base font-bold text-slate-500">Order tidak ditemukan</p>
      </div>
    </div>
  );

  const itemsTotal = order.items.reduce((s, i) => s + i.totalPrice, 0);
  const grandTotal = itemsTotal + (order.shippingCostConfirmed ? (order.shippingCost ?? 0) : 0);
  const isPaid = order.paymentStatus === "sudah_bayar";
  const isDone = order.status === "selesai";
  const isVoid = order.status === "void";

  return (
    <div className="flex flex-col gap-5">
      {/* ── Banners ── */}
      {isVoid && (
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100 flex items-start gap-3 shadow-sm shadow-red-100/50 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Ban size={20} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm font-black text-red-700 uppercase tracking-widest mb-0.5">Pesanan Dibatalkan</p>
            <p className="text-xs font-semibold text-red-500">Alasan: {order.voidReason || "Tidak ada alasan"}</p>
          </div>
        </div>
      )}

      {isDone && (
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100 flex items-start gap-3 shadow-sm shadow-green-100/50 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-black text-green-700 uppercase tracking-widest mb-0.5">Order Selesai</p>
            <p className="text-xs font-semibold text-green-600/70">Terkonfirmasi pada {order.completedAt ? fmtDate(order.completedAt) : "-"}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-medium border border-red-100 animate-fade-in">
          {error}
        </div>
      )}

      {/* ── Section: Detail Pelanggan & Pengiriman ── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Truck size={100} />
        </div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
            <Truck size={16} className="text-blue-500" />
          </div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Detail Pelanggan</h2>
        </div>
        <div className="grid gap-3 relative z-10">
          <div className="flex items-start justify-between bg-slate-50 rounded-2xl p-3 border border-slate-100">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-slate-400">
                {(order.customerName || "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">{order.customerName}</p>
                <p className="text-xs font-medium text-slate-500">{order.customerPhone || "Tanpa No. HP"}</p>
              </div>
            </div>
            {order.customerType && (
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 uppercase">
                {order.customerType}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="bg-white border border-slate-100 rounded-2xl p-3 flex items-start gap-2">
              <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Alamat / Tipe</p>
                <p className="text-xs font-medium text-slate-700">{order.shippingAddress || (order.deliveryMethod === 'delivery' ? 'Delivery (Menunggu Alamat)' : (order.deliveryMethod === 'pickup' ? 'Ambil Sendiri (Pickup)' : (order.channel === 'walkin' ? 'Walk-in' : 'Ambil Sendiri')))}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-3 flex items-start gap-2">
              <CreditCard size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Metode Bayar</p>
                <p className="text-xs font-medium text-slate-700">{order.paymentMethod ? order.paymentMethod.toUpperCase() : "-"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section: Daftar Item ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
          <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center">
            <Package size={16} className="text-primary" />
          </div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Daftar Pesanan</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {order.items.map((item, idx) => (
            <div key={idx} className="p-5 hover:bg-slate-50/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.productName}</p>
                  {item.variantName && (
                    <p className="text-xs font-semibold text-primary mt-0.5 bg-brand-50 inline-block px-2 py-0.5 rounded-md">
                      Varian: {item.variantName}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{fmt(item.totalPrice)}</p>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">
                    {item.qty} x {fmt(item.basePrice - item.discountPerUnit)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Ringkasan Harga ── */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-3">
          <div className="flex justify-between text-sm font-medium text-slate-500">
            <span>Subtotal ({order.items.length} item)</span>
            <span>{fmt(itemsTotal)}</span>
          </div>
          {order.shippingCostConfirmed && (
            <div className="flex justify-between text-sm font-medium text-slate-500">
              <span>Ongkos Kirim</span>
              <span>{fmt(order.shippingCost ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-3 border-t border-dashed border-slate-200">
            <span className="text-base font-black text-slate-800 uppercase tracking-widest">Total</span>
            <span className="text-2xl font-black text-primary">{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Actions Bawah ── */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <button
          onClick={printReceipt}
          className="col-span-1 p-3.5 rounded-2xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-all flex items-center justify-center gap-2 tap-target shadow-lg shadow-slate-800/20"
        >
          <Printer size={18} /> Thermal
        </button>
        <button
          onClick={() => window.open(`/manager/orders/${order.id}/invoice`, '_blank')}
          className="col-span-1 p-3.5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 tap-target shadow-lg shadow-indigo-600/20"
        >
          <Printer size={18} /> Invoice A4
        </button>

        {!isVoid && !isDone && (
          <>
            <button
              onClick={() => setShowVoidModal(true)}
              disabled={!!actionLoading}
              className="p-3.5 rounded-2xl bg-white text-red-500 border border-red-200 font-bold hover:bg-red-50 transition-all tap-target flex items-center justify-center gap-2"
            >
              <Ban size={18} /> Batalkan
            </button>
            <button
              onClick={isPaid ? markComplete : markAsPaid}
              disabled={!!actionLoading}
              className="p-3.5 rounded-2xl bg-primary text-white font-bold hover:bg-primary/90 transition-all tap-target shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
            >
              {actionLoading === (isPaid ? "status" : "payment") ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              {isPaid ? "Selesaikan" : "Terima Bayaran"}
            </button>
          </>
        )}
      </div>

      {/* Modal Void */}
      {showVoidModal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm rounded-l-3xl">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in">
            <h3 className="text-lg font-black text-slate-800 mb-2">Batalkan Pesanan?</h3>
            <p className="text-sm text-slate-500 mb-4">Aksi ini tidak dapat dibatalkan. Stok akan dikembalikan.</p>
            <input
              type="text"
              placeholder="Alasan batal (mis: Stok habis, dsb)"
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm mb-2"
            />
            {voidReasonError && <p className="text-xs text-red-500 mb-4">{voidReasonError}</p>}
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setShowVoidModal(false)}
                className="flex-1 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
              >Batal</button>
              <button 
                onClick={voidOrder}
                disabled={actionLoading === "void"}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 flex items-center justify-center"
              >
                {actionLoading === "void" ? <Loader2 size={18} className="animate-spin" /> : "Ya, Batalkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
