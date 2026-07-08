"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ClipboardList, Ban, Clock, CheckCircle2, RotateCw } from "lucide-react";
import Link from "next/link";

interface OrderSummary {
  id: string; orderNumber: string; customerName: string; customerType: string | null;
  status: string; paymentStatus: string; source: string; orderChannel: string; createdAt: string;
  voidReason: string | null; voidedAt: string | null;
}

const TABS = [
  { key: "semua", label: "Semua" },
  { key: "pending", label: "Pending" },
  { key: "proses", label: "Proses" },
  { key: "selesai", label: "Selesai" },
  { key: "void", label: "Batal" },
];

function getStatusStyle(status: string) {
  if (status === "selesai") return { icon: <CheckCircle2 size={12} />, color: "#16A34A", bg: "#DCFCE7", text: "Selesai" };
  if (status === "proses") return { icon: <RotateCw size={12} className="animate-spin-slow" />, color: "#D97706", bg: "#FEF3C7", text: "Proses" };
  if (status === "void") return { icon: <Ban size={12} />, color: "#DC2626", bg: "#FEE2E2", text: "Batal" };
  return { icon: <Clock size={12} />, color: "#64748B", bg: "#F1F5F9", text: "Pending" };
}

const CHANNEL_LABELS: Record<string, string> = {
  walkin: "Walk-in",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  shopee: "Shopee",
};

export default function OrdersListPage() {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("semua");

  const fetchWithAuth = useCallback(async (url: string) => {
    const token = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [getToken]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (tab !== "semua") params.set("status", tab);
        const res = await fetchWithAuth(`/api/orders${params.toString() ? `?${params}` : ""}`);
        const data = await res.json();
        if (res.ok) setOrders(data);
      } finally { setLoading(false); }
    })();
  }, [fetchWithAuth, tab]);

  const todayCount = orders.length;

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  const isVoidTab = tab === "void";

  return (
    <div className="page-enter min-h-screen pb-24" style={{ background: "#FCABB4" }}>
      
      {/* Floating Header */}
      <div className="sticky top-0 z-30 pt-4 px-4 pb-2 bg-white/90 backdrop-blur-xl border-b border-pink-200 shadow-sm">
        <div className="flex items-center justify-between mb-4 mt-2">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Pesanan</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              {isVoidTab ? `${todayCount} Dibatalkan` : `${todayCount} Transaksi Hari Ini`}
            </p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">
            <ClipboardList size={22} className="text-pink-500" />
          </div>
        </div>

        {/* Dynamic Animated Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                data-testid={`tab-${t.key}`}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 tap-target ${
                  active 
                    ? t.key === "void" ? "bg-red-500 text-white shadow-md shadow-red-500/20" : "bg-pink-500 text-white shadow-md shadow-pink-500/20"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Order Cards */}
      <div className="px-4 pt-4 flex flex-col gap-3 md:px-8 md:max-w-5xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center p-10 bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              {isVoidTab
                ? <Ban className="text-slate-300" size={32} />
                : <ClipboardList className="text-slate-300" size={32} />
              }
            </div>
            <p className="text-sm font-bold text-slate-500">
              {isVoidTab ? "Tidak ada pesanan yang dibatalkan" : "Belum ada pesanan masuk"}
            </p>
            <p className="text-xs font-medium text-slate-400 mt-1">Coba cek beberapa saat lagi</p>
          </div>
        ) : (
          orders.map((order) => {
            const isVoidCard = order.status === "void";
            const statusStyle = getStatusStyle(order.status);
            
            return (
              <Link key={order.id} href={`/manager/orders/${order.id}`} data-testid={`order-item-${order.id}`}>
                <div
                  className="group relative bg-white rounded-3xl p-5 border border-slate-100 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 active:scale-95 overflow-hidden tap-target"
                  style={{
                    opacity: isVoidCard ? 0.75 : 1,
                  }}
                >
                  {/* Decorative corner accent */}
                  <div 
                    className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-10 transition-all duration-500 group-hover:opacity-30 group-hover:scale-150"
                    style={{ background: statusStyle.color }}
                  ></div>

                  {/* Void Banner */}
                  {isVoidCard && (
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dashed border-red-200">
                      <div className="bg-red-100 p-1.5 rounded-lg">
                        <Ban size={14} className="text-red-600" />
                      </div>
                      <span className="text-[11px] font-black text-red-600 uppercase tracking-widest">
                        Dibatalkan {order.voidReason && <span className="text-red-400 font-bold ml-1">({order.voidReason})</span>}
                      </span>
                    </div>
                  )}

                  {/* Row 1: avatar + name + orderId + status */}
                  <div className="flex items-start justify-between mb-5 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm border border-slate-50"
                        style={{
                          background: isVoidCard ? "#F1F5F9" : "#FEF1F5",
                          color: isVoidCard ? "#94A3B8" : "#E85D8C"
                        }}>
                        {(order.customerName || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className={`text-base font-black tracking-tight ${isVoidCard ? "text-slate-400 line-through decoration-slate-300" : "text-slate-800"}`}>
                          {order.customerName}
                        </p>
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">#{order.orderNumber.split("-").pop()}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <span 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm"
                        style={{ color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.color}20` }}
                      >
                        {statusStyle.icon}
                        {statusStyle.text}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        {formatTime(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: channel + payment status */}
                  <div className="flex items-center gap-2 relative z-10 pt-4 border-t border-dashed border-slate-100">
                    <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 border border-slate-200/60">
                      {CHANNEL_LABELS[order.orderChannel] ?? order.source?.replace(/_/g, " ") ?? "-"}
                    </span>
                    
                    {order.paymentStatus === "belum_bayar" && !isVoidCard && (
                      <span className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-100 text-[10px] font-black uppercase tracking-widest text-red-600 animate-pulse shadow-sm">
                        Belum Bayar
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
