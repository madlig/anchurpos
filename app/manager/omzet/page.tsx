"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  Loader2, TrendingUp, ShoppingCart, Store, MessageCircle, Smartphone, ShoppingBag, 
  Wallet, Building2, CreditCard, Target, Award, Calendar, ArrowLeft, RefreshCw, BarChart3
} from "lucide-react";
import Link from "next/link";

interface OrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  channel: string;
  orderChannel: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  totalOrderValue?: number;
  platformFee?: number;
  createdAt: string;
}

const DAILY_TARGET = 2_000_000;

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function OmzetAnalyticsPage() {
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
      if (res.ok) {
        setOrders(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter orders by selected time range
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return orders.filter(order => {
      if (order.status === "void") return false;
      const orderDate = new Date(order.createdAt);

      if (timeRange === "today") {
        return orderDate >= todayStart;
      } else if (timeRange === "yesterday") {
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        return orderDate >= yesterdayStart && orderDate < todayStart;
      } else if (timeRange === "7days") {
        const sevenDaysAgo = new Date(todayStart);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return orderDate >= sevenDaysAgo;
      } else if (timeRange === "month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return orderDate >= monthStart;
      }
      return true;
    });
  }, [orders, timeRange]);

  // Calculations
  const grossSales = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.totalOrderValue ?? 0), 0);
  }, [filteredOrders]);

  const totalPlatformFees = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.platformFee ?? 0), 0);
  }, [filteredOrders]);

  const netSales = grossSales - totalPlatformFees;

  const orderCount = filteredOrders.length;
  const avgBasketSize = orderCount > 0 ? Math.round(grossSales / orderCount) : 0;

  const target = timeRange === "today" ? DAILY_TARGET : timeRange === "yesterday" ? DAILY_TARGET : DAILY_TARGET * 30;
  const targetPct = Math.min(100, Math.round((grossSales / target) * 100));

  // Channel Breakdown
  const channelBreakdown = useMemo(() => {
    const channels: Record<string, { count: number; omzet: number }> = {
      walkin: { count: 0, omzet: 0 },
      whatsapp: { count: 0, omzet: 0 },
      tiktok: { count: 0, omzet: 0 },
      shopee: { count: 0, omzet: 0 },
    };

    filteredOrders.forEach(o => {
      const ch = o.orderChannel || "walkin";
      if (!channels[ch]) channels[ch] = { count: 0, omzet: 0 };
      channels[ch].count += 1;
      channels[ch].omzet += (o.totalOrderValue ?? 0);
    });

    return [
      { id: "walkin", label: "Walk-in Outlet", icon: Store, color: "text-emerald-600 bg-emerald-50 border-emerald-100", ...channels.walkin },
      { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600 bg-emerald-50 border-emerald-100", ...channels.whatsapp },
      { id: "tiktok", label: "TikTok Shop", icon: Smartphone, color: "text-rose-600 bg-rose-50 border-rose-100", ...channels.tiktok },
      { id: "shopee", label: "Shopee", icon: ShoppingBag, color: "text-orange-600 bg-orange-50 border-orange-100", ...channels.shopee },
    ];
  }, [filteredOrders]);

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    let cash = 0;
    let bank = 0;
    let qris = 0;

    filteredOrders.forEach(o => {
      if (o.paymentStatus !== "sudah_bayar") return;
      const method = (o.paymentMethod || "cash").toLowerCase();
      const val = o.totalOrderValue ?? 0;

      if (method.includes("bank") || method.includes("transfer")) {
        bank += val;
      } else if (method.includes("qris")) {
        qris += val;
      } else {
        cash += val;
      }
    });

    return { cash, bank, qris, totalPaid: cash + bank + qris };
  }, [filteredOrders]);

  const dateLabel = useMemo(() => {
    if (timeRange === "today") return "Hari Ini (" + new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + ")";
    if (timeRange === "yesterday") return "Kemarin";
    if (timeRange === "7days") return "7 Hari Terakhir";
    return "Bulan Ini (" + new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }) + ")";
  }, [timeRange]);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      {/* ── Native App Sticky Header ── */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/manager/dashboard" className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 text-slate-600 transition-colors">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">
                  Analisis Omzet Penjualan
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  {dateLabel} • Outlet Utama
                </p>
              </div>
            </div>

            <button
              onClick={loadData}
              className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-primary" : ""} />
            </button>
          </div>

          {/* ── Time Range Filter Tabs ── */}
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl gap-1 overflow-x-auto hide-scrollbar">
            {[
              { id: "today", label: "Hari Ini" },
              { id: "yesterday", label: "Kemarin" },
              { id: "7days", label: "7 Hari" },
              { id: "month", label: "Bulan Ini" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id as any)}
                className={`flex-1 min-w-[85px] py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  timeRange === t.id ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-5 pt-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ── Hero Sales Card ── */}
            <div className="rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 md:p-6 text-white shadow-xl shadow-slate-900/10 border border-slate-800 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl" />
              
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-4">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-emerald-400" /> Total Omzet Penjualan (Kotor)
                  </span>
                  <div className="text-2xl md:text-3xl font-black text-white mt-1 tabular-nums">
                    {fmt(grossSales)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Omzet Bersih</span>
                  <span className="text-base md:text-lg font-extrabold text-emerald-400 tabular-nums">
                    {fmt(netSales)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[11px] font-semibold text-slate-400 block">Total Transaksi</span>
                  <span className="text-sm font-extrabold text-white mt-0.5 block">{orderCount} Pesanan</span>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[11px] font-semibold text-slate-400 block">Rata-rata Order</span>
                  <span className="text-sm font-extrabold text-white mt-0.5 block">{fmt(avgBasketSize)}</span>
                </div>

                <div className="col-span-2 md:col-span-1 p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block">Platform Fees</span>
                    <span className="text-sm font-extrabold text-rose-400 mt-0.5 block">-{fmt(totalPlatformFees)}</span>
                  </div>
                  <BarChart3 size={20} className="text-slate-500" />
                </div>
              </div>
            </div>

            {/* ── Target Omzet Progress Bar ── */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] md:text-xs font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Target size={13} className="text-primary" /> Target Penjualan ({timeRange === "month" ? "Bulanan" : "Harian"})
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-lg md:text-xl font-black text-slate-800 tabular-nums">{fmt(grossSales)}</span>
                    <span className="text-xs font-bold text-slate-400">/ {fmt(target)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs md:text-sm font-black px-2.5 py-1 rounded-full ${targetPct >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'}`}>
                    {targetPct}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-primary via-rose-500 to-emerald-500 transition-all duration-700"
                  style={{ width: `${targetPct}%` }}
                />
              </div>
            </div>

            {/* ── Breakdown Per Channel Penjualan ── */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShoppingCart size={14} className="text-primary" /> Omzet Per Channel Penjualan
                </h2>
                <span className="text-xs font-bold text-slate-400">{filteredOrders.length} Order</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {channelBreakdown.map((ch) => {
                  const Icon = ch.icon;
                  const pct = grossSales > 0 ? Math.round((ch.omzet / grossSales) * 100) : 0;

                  return (
                    <div key={ch.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${ch.color}`}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <h3 className="text-xs font-extrabold text-slate-800">{ch.label}</h3>
                          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{ch.count} Transaksi ({pct}%)</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-slate-800 tabular-nums block">{fmt(ch.omzet)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Breakdown Per Metode Pembayaran ── */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Wallet size={14} className="text-amber-500" /> Omzet Per Metode Pembayaran
                </h2>
                <span className="text-xs font-bold text-slate-400">Total Terbayar: {fmt(paymentBreakdown.totalPaid)}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100/80">
                  <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
                    <Wallet size={14} /> Tunai / Laci Cash
                  </div>
                  <p className="text-base font-black text-slate-800 mt-1 tabular-nums">{fmt(paymentBreakdown.cash)}</p>
                  <p className="text-[10px] font-semibold text-amber-600 mt-1">Uang Masuk Laci Kasir</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100/80">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                    <Building2 size={14} /> Bank Transfer
                  </div>
                  <p className="text-base font-black text-slate-800 mt-1 tabular-nums">{fmt(paymentBreakdown.bank)}</p>
                  <p className="text-[10px] font-semibold text-emerald-600 mt-1">Masuk Rekening Bank</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-cyan-50/70 border border-cyan-100/80">
                  <div className="flex items-center gap-2 text-cyan-700 font-bold text-xs">
                    <CreditCard size={14} /> QRIS / Digital
                  </div>
                  <p className="text-base font-black text-slate-800 mt-1 tabular-nums">{fmt(paymentBreakdown.qris)}</p>
                  <p className="text-[10px] font-semibold text-cyan-600 mt-1">Settlement QRIS / E-Wallet</p>
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}
