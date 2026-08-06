"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ArrowLeft, RefreshCw, TrendingUp, Store, MessageCircle, Smartphone, ShoppingBag, Wallet, Building2, CreditCard, Target, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";

interface OrderItem {
  id: string;
  orderNumber?: string;
  customerName?: string;
  channel?: string;
  orderChannel?: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  totalOrderValue?: number;
  platformFee?: number;
  createdAt: string;
}

const DAILY_TARGET = 2_000_000;

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function OwnerOmzetPage() {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "yesterday" | "7days" | "month">("today");

  const fetchWithAuth = useCallback(async (url: string) => {
    const token = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/orders");
      if (res.ok) setOrders(await res.json());
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return orders.filter((o) => {
      if (o.status === "void") return false;
      const d = new Date(o.createdAt);
      if (timeRange === "today") return d >= todayStart;
      if (timeRange === "yesterday") {
        const y = new Date(todayStart); y.setDate(y.getDate() - 1);
        return d >= y && d < todayStart;
      }
      if (timeRange === "7days") {
        const s = new Date(todayStart); s.setDate(s.getDate() - 7);
        return d >= s;
      }
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= m;
    });
  }, [orders, timeRange]);

  const grossSales = filteredOrders.reduce((s, o) => s + (o.totalOrderValue ?? 0), 0);
  const totalPlatformFees = filteredOrders.reduce((s, o) => s + (o.platformFee ?? 0), 0);
  const netSales = grossSales - totalPlatformFees;
  const orderCount = filteredOrders.length;
  const avgBasket = orderCount > 0 ? Math.round(grossSales / orderCount) : 0;
  const target = timeRange === "month" ? DAILY_TARGET * 30 : DAILY_TARGET;
  const targetPct = Math.min(100, Math.round((grossSales / target) * 100));

  const channelBreakdown = useMemo(() => {
    const ch: Record<string, { count: number; omzet: number }> = {};
    filteredOrders.forEach((o) => {
      const c = o.orderChannel || o.channel || "walkin";
      if (!ch[c]) ch[c] = { count: 0, omzet: 0 };
      ch[c].count++; ch[c].omzet += o.totalOrderValue ?? 0;
    });
    return [
      { id: "walkin", label: "Walk-in", Icon: Store, color: "text-emerald-600 bg-emerald-50 border-emerald-100", ...ch.walkin },
      { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle, color: "text-emerald-600 bg-emerald-50 border-emerald-100", ...ch.whatsapp },
      { id: "tiktok", label: "TikTok", Icon: Smartphone, color: "text-rose-600 bg-rose-50 border-rose-100", ...ch.tiktok },
      { id: "shopee", label: "Shopee", Icon: ShoppingBag, color: "text-orange-600 bg-orange-50 border-orange-100", ...ch.shopee },
    ].map((c) => ({ ...c, count: c.count || 0, omzet: c.omzet || 0 }));
  }, [filteredOrders]);

  const paymentBreakdown = useMemo(() => {
    let cash = 0, bank = 0, qris = 0;
    filteredOrders.forEach((o) => {
      if (o.paymentStatus !== "sudah_bayar") return;
      const v = o.totalOrderValue ?? 0;
      const m = (o.paymentMethod || "cash").toLowerCase();
      if (m.includes("bank") || m.includes("transfer")) bank += v;
      else if (m.includes("qris")) qris += v;
      else cash += v;
    });
    return { cash, bank, qris };
  }, [filteredOrders]);

  const dateLabel = timeRange === "today"
    ? "Hari Ini (" + new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + ")"
    : timeRange === "yesterday" ? "Kemarin"
    : timeRange === "7days" ? "7 Hari Terakhir"
    : "Bulan Ini (" + new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }) + ")";

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/owner/dashboard" className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 text-slate-600 transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">Analisis Omzet</h1>
                <p className="text-xs font-semibold text-slate-400">{dateLabel}</p>
              </div>
            </div>
            <button onClick={loadData} className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">
              <RefreshCw size={16} className={loading ? "animate-spin text-primary" : ""} />
            </button>
          </div>
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl gap-1">
            {(["today", "yesterday", "7days", "month"] as const).map((t) => (
              <button key={t} onClick={() => setTimeRange(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${timeRange === t ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}
              >
                {{ today: "Hari Ini", yesterday: "Kemarin", "7days": "7 Hari", month: "Bulan" }[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-5 pt-5">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-32 w-full rounded-3xl" />
          </div>
        ) : (
          <>
            {/* Hero Sales */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-xl border border-slate-800 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl" />
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-3">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><TrendingUp size={14} className="text-emerald-400" /> Omzet Kotor</span>
                  <div className="text-2xl font-black mt-1 tabular-nums">{fmt(grossSales)}</div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Bersih</span>
                  <div className="text-lg font-extrabold text-emerald-400 tabular-nums">{fmt(netSales)}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10"><span className="text-[10px] text-slate-400 block">Pesanan</span><span className="text-sm font-extrabold block">{orderCount}</span></div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10"><span className="text-[10px] text-slate-400 block">Rata-rata</span><span className="text-sm font-extrabold block">{fmt(avgBasket)}</span></div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10"><span className="text-[10px] text-slate-400 block">Target</span><span className="text-sm font-extrabold block">{targetPct}%</span></div>
              </div>
            </div>

            {/* Channel Breakdown */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Omzet Per Channel</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {channelBreakdown.map((ch) => {
                  const pct = grossSales > 0 ? Math.round((ch.omzet / grossSales) * 100) : 0;
                  return (
                    <div key={ch.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${ch.color}`}><ch.Icon size={18} /></div><div><h3 className="text-xs font-extrabold text-slate-800">{ch.label}</h3><p className="text-[11px] text-slate-400">{ch.count} transaksi ({pct}%)</p></div></div>
                      <span className="text-sm font-black text-slate-800 tabular-nums">{fmt(ch.omzet)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Metode Pembayaran</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100/80"><div className="flex items-center gap-2 text-amber-700 font-bold text-xs"><Wallet size={14} /> Tunai / Cash</div><p className="text-base font-black text-slate-800 mt-1 tabular-nums">{fmt(paymentBreakdown.cash)}</p></div>
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100/80"><div className="flex items-center gap-2 text-emerald-700 font-bold text-xs"><Building2 size={14} /> Bank Transfer</div><p className="text-base font-black text-slate-800 mt-1 tabular-nums">{fmt(paymentBreakdown.bank)}</p></div>
                <div className="p-3.5 rounded-2xl bg-cyan-50/70 border border-cyan-100/80"><div className="flex items-center gap-2 text-cyan-700 font-bold text-xs"><CreditCard size={14} /> QRIS</div><p className="text-base font-black text-slate-800 mt-1 tabular-nums">{fmt(paymentBreakdown.qris)}</p></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
