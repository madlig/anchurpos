"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CheckCircle2, Clock, CreditCard, Ban, Package, User, Printer, Calendar, MapPin, Truck } from "lucide-react";

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
      <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
    </div>
  );

  if (!order) return (
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: "#FCABB4" }}>
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
        <Package size={48} className="text-slate-300 mb-4" />
        <p className="text-base font-bold text-slate-500">Order tidak ditemukan</p>
        <button 
          onClick={() => router.back()} 
          className="mt-6 px-6 py-2.5 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 transition-colors tap-target shadow-md shadow-pink-500/20"
        >
          Kembali
        </button>
      </div>
    </div>
  );

  const itemsTotal = order.items.reduce((s, i) => s + i.totalPrice, 0);
  const grandTotal = itemsTotal + (order.shippingCostConfirmed ? (order.shippingCost ?? 0) : 0);
  const isPaid = order.paymentStatus === "sudah_bayar";
  const isDone = order.status === "selesai";
  const isVoid = order.status === "void";

  return (
    <div className="min-h-screen pb-24" style={{ background: "#FCABB4" }}>

      {/* ── Sticky Header (Glassmorphism) ── */}
      <div className="sticky top-0 z-30 pt-4 px-4 pb-4 bg-white/90 backdrop-blur-xl border-b border-pink-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            data-testid="back-button"
            className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center tap-target hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">#{order.orderNumber.split("-").pop()}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{order.channel === "walkin" ? "Walk-in" : order.channel}</p>
          </div>
        </div>
        
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
          isVoid ? "bg-red-500 text-white shadow-red-500/20" : 
          isDone ? "bg-green-500 text-white shadow-green-500/20" : 
          "bg-amber-400 text-amber-900 shadow-amber-400/20"
        }`}>
          {isVoid ? "Batal" : isDone ? "Selesai" : "Pending"}
        </span>
      </div>

      <div className="px-4 pt-6 md:max-w-3xl md:mx-auto space-y-4">

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
          <div className="bg-green-50 rounded-2xl p-4 border border-green-100 flex items-start gap-3 shadow-sm shadow-green-100/50 animate-fade-in" data-testid="success-banner">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-black text-green-700 uppercase tracking-widest mb-0.5">Order Selesai</p>
              <p className="text-xs font-semibold text-green-600/70">Terkonfirmasi pada {order.completedAt ? fmtDate(order.completedAt) : "-"}</p>
            </div>
          </div>
        )}

        {/* ── Bento Grid Layout ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Customer Info */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:shadow-slate-200/50 transition-shadow group">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dashed border-slate-100">
              <div className="bg-pink-50 p-1.5 rounded-lg">
                <User size={16} className="text-pink-500" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pelanggan</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl font-black text-slate-300 shrink-0 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-pink-50 group-hover:text-pink-400 group-hover:border-pink-100 transition-all duration-300">
                {order.customerName[0].toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-black text-slate-800 tracking-tight">{order.customerName}</p>
                {order.customerPhone && <p className="text-xs font-bold text-slate-400 mt-1">{order.customerPhone}</p>}
              </div>
            </div>
            {order.orderNotes && (
              <div className="mt-5 bg-amber-50 p-3 rounded-2xl border border-amber-100/50">
                <p className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest mb-1">Catatan</p>
                <p className="text-sm font-bold text-amber-800">"{order.orderNotes}"</p>
              </div>
            )}
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:shadow-slate-200/50 transition-shadow">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dashed border-slate-100">
              <div className="bg-blue-50 p-1.5 rounded-lg">
                <CreditCard size={16} className="text-blue-500" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pembayaran</span>
            </div>
            
            <div className="flex items-center justify-between mb-5">
              <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${
                isPaid ? "bg-green-100 text-green-700 border border-green-200/50" : "bg-red-50 text-red-600 border border-red-200/50 animate-pulse"
              }`}>
                {isPaid ? "Lunas" : "Belum Bayar"}
              </span>
              
              {order.paymentMethod && (
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span className="text-[10px] font-black uppercase tracking-widest">VIA</span>
                  <span className="px-3 py-1 rounded-xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 border border-slate-200/50">
                    {order.paymentMethod === "cash" ? "Tunai" : order.paymentMethod}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100/50">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Tagihan</p>
                <p className="text-xl font-black text-pink-600 tracking-tight">{fmt(grandTotal)}</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                <CreditCard size={18} className="text-slate-300" />
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm md:col-span-2">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dashed border-slate-100">
              <div className="bg-purple-50 p-1.5 rounded-lg">
                <Package size={16} className="text-purple-500" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rincian Item</span>
            </div>

            <div className="space-y-2 mb-6">
              {order.items.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/50 flex items-center justify-center text-sm font-black text-slate-600 shrink-0 group-hover:bg-purple-50 group-hover:text-purple-600 group-hover:border-purple-100 transition-colors">
                      {item.qty}x
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{item.productName}</p>
                      <p className="text-xs font-bold text-slate-400 mt-0.5">{item.variantName} • {fmt(item.basePrice)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-800 tracking-tight">{fmt(item.totalPrice)}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100/50">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Subtotal Item</span>
                <span className="text-sm font-black text-slate-700">{fmt(itemsTotal)}</span>
              </div>
              {order.shippingCostConfirmed && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Biaya Pengiriman</span>
                  <span className="text-sm font-black text-slate-700">{fmt(order.shippingCost ?? 0)}</span>
                </div>
              )}
              <div className="pt-3 mt-1 border-t border-dashed border-slate-200 flex justify-between items-center">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Keseluruhan</span>
                <span className="text-2xl font-black text-pink-600 tracking-tight">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        {!isVoid && (
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm mt-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Tindakan</span>

            <div className="flex flex-col gap-3">
              {/* Print Invoice — B2B and Reseller */}
              {(order.customerType === "b2b" || order.customerType === "reseller" || order.channel === "b2b") && (
                <button
                  onClick={() => window.open(`/manager/orders/${order.id}/invoice`, "_blank")}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-blue-50 text-blue-600 font-black hover:bg-blue-100 transition-colors tap-target shadow-sm"
                >
                  <Printer size={18} />
                  Cetak Invoice
                </button>
              )}

              {!isDone && (
                <>
                  <button
                    onClick={() => router.push(`/manager/orders/${order.id}/edit`)}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-amber-50 text-amber-600 font-black hover:bg-amber-100 transition-colors tap-target shadow-sm"
                  >
                    Edit Pesanan
                  </button>
                  <button
                    onClick={markComplete}
                    disabled={actionLoading === "status"}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-black hover:shadow-lg hover:shadow-green-500/30 transition-all tap-target active:scale-[0.98] disabled:opacity-70"
                  >
                    {actionLoading === "status" ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} strokeWidth={3} />}
                    Tandai Selesai
                  </button>
                  <button
                    onClick={() => setShowVoidModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white border-2 border-red-100 text-red-500 font-black hover:bg-red-50 transition-colors tap-target mt-2"
                  >
                    <Ban size={18} strokeWidth={3} />
                    Batalkan (Void)
                  </button>
                </>
              )}
            </div>
            {error && (
              <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-100 text-center animate-shake">
                <p className="text-xs font-bold text-red-600">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Void Modal ── */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl animate-slide-up border border-slate-100">
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-5 mx-auto">
              <Ban size={28} className="text-red-500" strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-slate-800 text-center tracking-tight mb-2">Batalkan Pesanan?</h3>
            <p className="text-xs font-bold text-slate-500 text-center mb-6 leading-relaxed px-4">
              Tindakan ini tidak dapat diurungkan. Stok yang digunakan akan dikembalikan.
            </p>
            
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Tulis alasan pembatalan..."
              className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm font-bold resize-none mb-2"
              rows={3}
            />
            {voidReasonError && <p className="text-[10px] font-black text-red-500 mb-4 px-2 uppercase tracking-widest">{voidReasonError}</p>}
            
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => setShowVoidModal(false)}
                className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-black hover:bg-slate-200 transition-colors tap-target"
              >
                Kembali
              </button>
              <button 
                onClick={voidOrder}
                disabled={actionLoading === "void"}
                className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-black hover:bg-red-600 transition-colors shadow-md shadow-red-500/20 tap-target disabled:opacity-70 flex justify-center items-center"
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
