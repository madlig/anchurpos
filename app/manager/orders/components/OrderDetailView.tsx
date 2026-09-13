"use client";

import { useEffect, useState, useCallback } from "react";
import { formatRupiah } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatters";
import { useAuth } from "@/lib/auth-context";
import { X, Copy, Tag, Clock, CalendarDays, ReceiptText, ChefHat, PackageCheck, Truck, MapPin, Edit3, Printer, Trash2, ShieldAlert, CheckCircle2, Package, Ban, CreditCard, Box, Loader2, StickyNote } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

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
  sauceDistribution?: Record<string, number> | null;
  cashReceived?: number | null; changeAmount?: number | null;
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
    
    // Receipt format tailored for 58mm / 80mm POS printer (Modern Cafe & Bakery Receipt Standard)
    const cashierName = user?.displayName || user?.email?.split('@')[0] || "Kasir";
    const subtotal = order.items.reduce((s, i) => s + i.totalPrice, 0);
    const ongkir = order.shippingCostConfirmed ? (order.shippingCost ?? 0) : 0;
    const grandTotal = subtotal + ongkir;

    // Urutkan item: Produk Churros di atas, disusul Jasa / Packing
    const sortedItems = [...order.items].sort((a, b) => {
      const aIsChurros = a.productName.toLowerCase().includes("churros");
      const bIsChurros = b.productName.toLowerCase().includes("churros");
      if (aIsChurros && !bIsChurros) return -1;
      if (!aIsChurros && bIsChurros) return 1;

      const aIsService = ["jasa", "packing", "kemasan"].some(k => a.productName.toLowerCase().includes(k));
      const bIsService = ["jasa", "packing", "kemasan"].some(k => b.productName.toLowerCase().includes(k));
      if (!aIsService && bIsService) return -1;
      if (aIsService && !bIsService) return 1;

      return a.productName.localeCompare(b.productName);
    });

    const isGenericVariant = (name?: string | null) => {
      if (!name) return true;
      const lower = name.toLowerCase().trim();
      return ["none", "tanpa varian", "jasa", "default", "-", ""].includes(lower);
    };

    const hasSauces = order.sauceDistribution && Object.values(order.sauceDistribution).some(q => q > 0);

    const html = `
      <html>
        <head>
          <title>Struk_${order.orderNumber}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace; 
              font-size: 11px; 
              line-height: 1.3;
              margin: 0 auto; 
              padding: 10px 8px; 
              width: 58mm; 
              color: #111; 
              background: #fff;
            }
            .center { text-align: center; }
            .left { text-align: left; }
            .right { text-align: right; }
            .bold { font-weight: 700; }
            .divider { border-bottom: 1px dashed #475569; margin: 6px 0; }
            .header-brand { font-size: 15px; font-weight: 900; letter-spacing: 0.05em; margin-bottom: 2px; }
            .header-sub { font-size: 10px; color: #475569; margin-bottom: 2px; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; font-size: 10px; }
            .info-table td { padding: 1px 0; vertical-align: top; }
            .info-label { width: 38px; color: #475569; }
            .info-value { width: calc(100% - 38px); font-weight: 600; }
            
            .item-table { width: 100%; border-collapse: collapse; }
            .item-table td { padding: 2px 0; vertical-align: top; }
            .item-name { font-size: 11px; font-weight: 700; }
            .item-qty { width: 22%; font-size: 10px; color: #334155; }
            .item-price { width: 38%; text-align: right; font-size: 10px; color: #475569; }
            .item-total { width: 40%; text-align: right; font-size: 11px; font-weight: 700; }

            .sauce-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 6px; margin: 4px 0; }
            .sauce-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #475569; margin-bottom: 2px; }
            .sauce-item { font-size: 10px; display: flex; justify-content: space-between; margin-bottom: 1px; }
            
            .summary-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 11px; }
            .summary-table td { padding: 2px 0; }
            .summary-label { text-align: left; color: #475569; }
            .summary-value { text-align: right; font-weight: 600; }
            .grand-total { font-size: 13px; font-weight: 900; border-top: 1px dashed #111; border-bottom: 1px dashed #111; padding: 5px 0 !important; color: #000; }
            
            .badge-status { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; background: #e2e8f0; }
            .notes-box { font-size: 10px; background: #f8fafc; border-left: 2px solid #e85d8c; padding: 3px 6px; margin: 4px 0; }
            .footer { margin-top: 10px; font-size: 9px; text-align: center; color: #64748B; line-height: 1.4; }
            
            @media print {
              body { width: 100%; margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="center header-brand">ANCHUR BANDUNG</div>
          <div class="center header-sub">Spesialis Churros & Dipping Sauces</div>
          <div class="center header-sub">IG: @anchur.id</div>
          
          <div class="divider"></div>
          
          <table class="info-table">
            <tr>
              <td class="info-label">No.</td>
              <td class="info-value">: ${order.orderNumber}</td>
            </tr>
            <tr>
              <td class="info-label">Tgl.</td>
              <td class="info-value">: ${new Date(order.createdAt).toLocaleString('id-ID', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'})}</td>
            </tr>
            <tr>
              <td class="info-label">Plg.</td>
              <td class="info-value">: ${order.customerName || "Walk-in"} ${order.customerPhone ? `(${order.customerPhone})` : ""}</td>
            </tr>
            ${order.deliveryMethod === 'delivery' && order.shippingAddress ? `
            <tr>
              <td class="info-label">Almt.</td>
              <td class="info-value" style="word-break: break-word; font-size: 9px; line-height: 1.2;">: ${order.shippingAddress}</td>
            </tr>
            ` : ""}
            <tr>
              <td class="info-label">Ksr.</td>
              <td class="info-value">: ${cashierName} · ${order.channel.toUpperCase()}</td>
            </tr>
          </table>
          
          <div class="divider"></div>
          
          <table class="item-table">
            ${sortedItems.map(item => `
              <tr>
                <td colspan="3" class="item-name">${item.productName} ${!isGenericVariant(item.variantName) ? `<span style="font-weight: normal; color: #475569;">(${item.variantName})</span>` : ""}</td>
              </tr>
              <tr>
                <td class="item-qty">${item.qty}x</td>
                <td class="item-price">@${item.basePrice.toLocaleString('id-ID')}</td>
                <td class="item-total">${item.totalPrice.toLocaleString('id-ID')}</td>
              </tr>
            `).join("")}
          </table>

          ${hasSauces ? `
            <div class="sauce-box">
              <div class="sauce-title">Saus (Include):</div>
              ${Object.entries(order.sauceDistribution!).filter(([_, q]) => q > 0).map(([sId, qty]) => `
                <div class="sauce-item">
                  <span>• ${sId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                  <span class="bold">${qty}x</span>
                </div>
              `).join('')}
            </div>
          ` : ""}
          
          <div class="divider"></div>
          
          <table class="summary-table">
            <tr>
              <td class="summary-label">Subtotal</td>
              <td class="summary-value">${fmt(subtotal)}</td>
            </tr>
            ${order.shippingCostConfirmed && ongkir > 0 ? `
            <tr>
              <td class="summary-label">Ongkos Kirim</td>
              <td class="summary-value">${fmt(ongkir)}</td>
            </tr>
            ` : ""}
            <tr>
              <td class="summary-label grand-total">TOTAL</td>
              <td class="summary-value grand-total">${fmt(grandTotal)}</td>
            </tr>
            <tr>
              <td class="summary-label">Status Bayar</td>
              <td class="summary-value">
                <span class="badge-status" style="background: ${order.paymentStatus === 'sudah_bayar' ? '#DCFCE7' : '#FEE2E2'}; color: ${order.paymentStatus === 'sudah_bayar' ? '#16A34A' : '#DC2626'};">
                  ${order.paymentStatus === "sudah_bayar" ? "LUNAS" : "BELUM BAYAR"}
                </span>
              </td>
            </tr>
            ${order.paymentMethod ? `
            <tr>
              <td class="summary-label">Metode Bayar</td>
              <td class="summary-value" style="font-weight: 700;">${order.paymentMethod.toUpperCase()}</td>
            </tr>
            ` : ""}
            ${order.cashReceived ? `
            <tr>
              <td class="summary-label">Tunai</td>
              <td class="summary-value">${fmt(order.cashReceived)}</td>
            </tr>
            <tr>
              <td class="summary-label">Kembali</td>
              <td class="summary-value" style="font-weight: 700;">${fmt(order.changeAmount ?? 0)}</td>
            </tr>
            ` : ""}
          </table>

          ${order.orderNotes ? `
            <div class="notes-box">
              <strong>Catatan:</strong> ${order.orderNotes}
            </div>
          ` : ""}
          
          <div class="divider"></div>
          
          <div class="footer">
            <div class="bold" style="font-size: 10px; color: #1e293b;">Terima Kasih atas Kunjungan Anda!</div>
            <div>Simpan struk ini sebagai bukti transaksi.</div>
            <div style="margin-top: 3px; font-weight: 600;">@anchur.id</div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=420,height=650');
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-3xl" />
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
                  {item.variantName && !["none", "Tanpa Varian", "Jasa"].includes(item.variantName) && (
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
