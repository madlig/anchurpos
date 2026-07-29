"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  Loader2, ClipboardList, Ban, Clock, CheckCircle2, RotateCw, FileText, 
  Store, MessageCircle, Smartphone, ShoppingBag, Search, Filter, Download,
  Printer, CreditCard, ChevronRight, CheckCircle, RefreshCw, X, ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { AdaptivePanel } from "@/components/shared/AdaptivePanel";
import { OrderDetailView } from "./components/OrderDetailView";

interface OrderSummary {
  id: string; 
  orderNumber: string; 
  customerName: string; 
  customerType: string | null;
  status: string; 
  paymentStatus: string; 
  source: string; 
  orderChannel: string; 
  createdAt: string;
  totalOrderValue?: number;
  voidReason: string | null; 
  voidedAt: string | null;
}

const TABS = [
  { key: "semua", label: "Semua Pesanan" },
  { key: "pending", label: "Pending" },
  { key: "proses", label: "Diproses" },
  { key: "selesai", label: "Selesai" },
  { key: "void", label: "Dibatalkan" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function getChannelBadge(channel: string) {
  switch (channel) {
    case "walkin":
      return { icon: Store, label: "Walk-in", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    case "whatsapp":
      return { icon: MessageCircle, label: "WhatsApp", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    case "tiktok":
      return { icon: Smartphone, label: "TikTok", color: "text-rose-700 bg-rose-50 border-rose-200" };
    case "shopee":
      return { icon: ShoppingBag, label: "Shopee", color: "text-orange-700 bg-orange-50 border-orange-200" };
    default:
      return { icon: Store, label: channel, color: "text-slate-700 bg-slate-100 border-slate-200" };
  }
}

function getStatusStyle(status: string) {
  if (status === "selesai") return { icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50 border-emerald-200", label: "Selesai" };
  if (status === "proses") return { icon: RotateCw, color: "text-amber-700 bg-amber-50 border-amber-200", label: "Diproses" };
  if (status === "void") return { icon: Ban, color: "text-red-700 bg-red-50 border-red-200", label: "Dibatalkan" };
  return { icon: Clock, color: "text-slate-700 bg-slate-100 border-slate-200", label: "Pending" };
}

export default function OrdersListPage() {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Status Tab
  const [tab, setTab] = useState("semua");
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Selection
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== "semua") params.set("status", tab);
      const res = await fetchWithAuth(`/api/orders${params.toString() ? `?${params}` : ""}`);
      if (res.ok) {
        setOrders(await res.json());
      }
    } finally { 
      setLoading(false); 
    }
  }, [fetchWithAuth, tab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side filtering
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const search = searchQuery.toLowerCase().trim();
      const cName = order.customerName?.toLowerCase() || "";
      const oNum = order.orderNumber?.toLowerCase() || "";
      if (search && !cName.includes(search) && !oNum.includes(search)) {
        return false;
      }
      // Channel
      if (channelFilter !== "all" && order.orderChannel !== channelFilter) {
        return false;
      }
      // Payment
      if (paymentFilter !== "all" && order.paymentStatus !== paymentFilter) {
        return false;
      }
      // Date Range
      if (dateFilter !== "all") {
        const orderDate = new Date(order.createdAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (dateFilter === "today") {
          if (orderDate < today) return false;
        } else if (dateFilter === "yesterday") {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          if (orderDate >= today || orderDate < yesterday) return false;
        } else if (dateFilter === "7days") {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (orderDate < sevenDaysAgo) return false;
        } else if (dateFilter === "30days") {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          if (orderDate < thirtyDaysAgo) return false;
        }
      }
      return true;
    });
  }, [orders, searchQuery, channelFilter, paymentFilter, dateFilter]);

  // Calculations for Summary Bar
  const totalGrossValue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.totalOrderValue ?? 0), 0);
  }, [filteredOrders]);

  const pendingCount = useMemo(() => {
    return orders.filter(o => o.status === "pending" || o.paymentStatus === "belum_bayar").length;
  }, [orders]);

  async function handleQuickMarkAsPaid(orderId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setUpdatingOrderId(orderId);
    try {
      const res = await fetchWithAuth(`/api/orders/${orderId}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: "sudah_bayar" }),
      });
      if (res.ok) {
        await loadData();
      }
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const handleExport = () => {
    const headers = ["Order ID", "Tanggal", "Pelanggan", "Tipe", "Channel", "Status", "Pembayaran", "Total Value"];
    const rows = filteredOrders.map(o => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleString("id-ID"),
      o.customerName,
      o.customerType || "-",
      o.orderChannel,
      o.status,
      o.paymentStatus,
      o.totalOrderValue ?? 0
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Data_Pesanan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

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
                  Daftar Pesanan
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  {filteredOrders.length} Pesanan Terfilter • Outlet Utama
                </p>
              </div>
            </div>

            <button
              onClick={handleExport}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 text-emerald-700 font-bold text-xs transition-colors flex items-center gap-1.5"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          {/* ── KPI Summary Cards Bar ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Terfilter</span>
              <p className="text-sm md:text-base font-black text-slate-800 tabular-nums mt-0.5">{fmt(totalGrossValue)}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Butuh Tindakan</span>
              <p className="text-sm md:text-base font-black text-amber-600 tabular-nums mt-0.5">{pendingCount} Pesanan</p>
            </div>

            <div className="hidden md:block p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Transaksi</span>
              <p className="text-sm md:text-base font-black text-slate-800 tabular-nums mt-0.5">{orders.length} Pesanan</p>
            </div>
          </div>

          {/* ── Search & Quick Filter Bar ── */}
          <div className="flex flex-col md:flex-row gap-2 pt-1">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari Nomor Pesanan / Nama Pelanggan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl bg-slate-100/80 border border-slate-200 text-xs font-medium focus:outline-none focus:border-primary focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Semua Channel</option>
                <option value="walkin">Walk-in</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="tiktok">TikTok</option>
                <option value="shopee">Shopee</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Semua Status Bayar</option>
                <option value="sudah_bayar">Lunas</option>
                <option value="belum_bayar">Belum Lunas</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Semua Waktu</option>
                <option value="today">Hari Ini</option>
                <option value="yesterday">Kemarin</option>
                <option value="7days">7 Hari Terakhir</option>
                <option value="30days">30 Hari Terakhir</option>
              </select>
            </div>
          </div>

          {/* ── Status Pills Filter Tabs ── */}
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pt-1">
            {TABS.map((t) => {
              const isActive = tab === t.key;
              const count = orders.filter(o => t.key === "semua" ? true : o.status === t.key).length;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                    isActive 
                      ? 'bg-primary text-white border-primary shadow-sm' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-3 pt-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ClipboardList size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700">Tidak ada pesanan yang sesuai filter.</p>
            <button 
              onClick={() => {
                setSearchQuery(""); setChannelFilter("all"); setPaymentFilter("all"); setDateFilter("all"); setTab("semua");
              }}
              className="px-4 py-2 text-xs font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors"
            >
              Reset Semua Filter
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const status = getStatusStyle(order.status);
              const channelBadge = getChannelBadge(order.orderChannel);
              const ChannelIcon = channelBadge.icon;
              const StatusIcon = status.icon;
              const isPaid = order.paymentStatus === "sudah_bayar";
              const isVoidCard = order.status === "void";
              const isUpdating = updatingOrderId === order.id;

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group ${
                    isVoidCard ? 'opacity-70 bg-slate-50/80' : ''
                  }`}
                >
                  {/* Card Top Row */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800">
                        #{order.orderNumber}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${channelBadge.color}`}>
                        <ChannelIcon size={11} /> {channelBadge.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border flex items-center gap-1 ${status.color}`}>
                        <StatusIcon size={11} /> {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800 group-hover:text-primary transition-colors">
                        {order.customerName || "Walk-in Customer"}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {formatDate(order.createdAt)} • {formatTime(order.createdAt)}
                        {order.customerType ? ` • ${order.customerType.toUpperCase()}` : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-slate-800 tabular-nums">
                        {fmt(order.totalOrderValue ?? 0)}
                      </div>
                      <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md mt-0.5 ${
                        isPaid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>
                        {isPaid ? "LUNAS" : "BELUM BAYAR"}
                      </span>
                    </div>
                  </div>

                  {/* Card 1-Tap Action Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/manager/orders/${order.id}/invoice`}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors flex items-center gap-1"
                      >
                        <FileText size={12} /> Invoice
                      </Link>

                      <Link
                        href={`/manager/orders/${order.id}/shipping-label`}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors flex items-center gap-1"
                      >
                        <Printer size={12} /> Resi
                      </Link>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isPaid && !isVoidCard && (
                        <button
                          onClick={(e) => handleQuickMarkAsPaid(order.id, e)}
                          disabled={isUpdating}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors flex items-center gap-1 shadow-sm"
                        >
                          {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
                          Tandai Lunas
                        </button>
                      )}

                      <span className="text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                        <ChevronRight size={16} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Adaptive Panel for Order Details */}
      <AdaptivePanel
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        title={selectedOrderId ? `Detail Pesanan` : ""}
        icon={<FileText />}
      >
        {selectedOrderId && (
          <OrderDetailView 
            orderId={selectedOrderId} 
            onClose={() => setSelectedOrderId(null)}
            onOrderUpdated={() => loadData()}
          />
        )}
      </AdaptivePanel>
    </div>
  );
}
