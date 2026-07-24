"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ClipboardList, Ban, Clock, CheckCircle2, RotateCw, FileText } from "lucide-react";
import { AdaptivePanel } from "@/components/shared/AdaptivePanel";
import { OrderDetailView } from "./components/OrderDetailView";
import { OrderFilters } from "./components/OrderFilters";

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
  if (status === "selesai") return { icon: <CheckCircle2 size={14} />, color: "#16A34A", bg: "#DCFCE7", text: "Selesai" };
  if (status === "proses") return { icon: <RotateCw size={14} className="animate-spin-slow" />, color: "#D97706", bg: "#FEF3C7", text: "Proses" };
  if (status === "void") return { icon: <Ban size={14} />, color: "#DC2626", bg: "#FEE2E2", text: "Batal" };
  return { icon: <Clock size={14} />, color: "#64748B", bg: "#F1F5F9", text: "Pending" };
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

  // Selection
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchWithAuth = useCallback(async (url: string) => {
    const token = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
      const search = searchQuery.toLowerCase();
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

  const handleExport = () => {
    const headers = ["Order ID", "Tanggal", "Pelanggan", "Tipe", "Channel", "Status", "Pembayaran"];
    const rows = filteredOrders.map(o => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleString("id-ID"),
      o.customerName,
      o.customerType || "-",
      o.orderChannel,
      o.status,
      o.paymentStatus
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Data_Transaksi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }

  const isVoidTab = tab === "void";

  return (
    <div className="page-enter min-h-screen pb-24" style={{ background: "#FCABB4" }}>
      
      {/* Floating Header */}
      <div className="sticky top-0 z-30 pt-4 px-4 pb-2 bg-white/90 backdrop-blur-xl border-b border-pink-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 mt-2 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">
              <ClipboardList size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">Pesanan</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                {filteredOrders.length} Transaksi Ditemukan
              </p>
            </div>
          </div>
          
          <div className="flex-1 max-w-2xl">
            <OrderFilters 
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              channel={channelFilter} setChannel={setChannelFilter}
              paymentStatus={paymentFilter} setPaymentStatus={setPaymentFilter}
              dateFilter={dateFilter} setDateFilter={setDateFilter}
              onExport={handleExport}
            />
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
                className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 tap-target ${
                  active 
                    ? t.key === "void" ? "bg-red-500 text-white shadow-md shadow-red-500/20" : "bg-primary text-white shadow-md shadow-primary/20"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-brand-50"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pt-4 md:px-8 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center p-10 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-white/60">
            <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center mb-4">
              {isVoidTab
                ? <Ban className="text-slate-300" size={32} />
                : <ClipboardList className="text-slate-300" size={32} />
              }
            </div>
            <p className="text-sm font-bold text-slate-600">Tidak ada pesanan yang sesuai filter</p>
            <button 
              onClick={() => {
                setSearchQuery(""); setChannelFilter("all"); setPaymentFilter("all"); setDateFilter("all");
              }}
              className="mt-4 px-4 py-2 text-xs font-bold text-primary bg-white rounded-xl shadow-sm"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">ID / Waktu</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Pelanggan</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Channel</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Pembayaran</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredOrders.map((order) => {
                    const statusStyle = getStatusStyle(order.status);
                    const isVoidCard = order.status === "void";
                    const isPaid = order.paymentStatus === "sudah_bayar";

                    return (
                      <tr 
                        key={order.id} 
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`group cursor-pointer transition-colors hover:bg-slate-50 ${isVoidCard ? 'opacity-60' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-700">#{(order.orderNumber || "??").split("-").pop()}</p>
                          <p className="text-xs font-semibold text-slate-400 mt-1">{formatDate(order.createdAt)} • {formatTime(order.createdAt)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center font-black text-primary text-xs">
                              {(order.customerName || "?")[0].toUpperCase()}
                            </div>
                            <p className="text-sm font-bold text-slate-700">{order.customerName}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-500 uppercase">{order.orderChannel}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isPaid ? "Lunas" : "Belum Bayar"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm"
                            style={{ color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.color}20` }}
                          >
                            {statusStyle.icon}
                            {statusStyle.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="flex flex-col gap-3 md:hidden">
              {filteredOrders.map((order) => {
                const isVoidCard = order.status === "void";
                const statusStyle = getStatusStyle(order.status);
                
                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className="group relative bg-white rounded-3xl p-5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-xl active:scale-95 tap-target"
                    style={{ opacity: isVoidCard ? 0.75 : 1 }}
                  >
                    {isVoidCard && (
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dashed border-red-200">
                        <div className="bg-red-100 p-1.5 rounded-lg">
                          <Ban size={14} className="text-red-600" />
                        </div>
                        <span className="text-xs font-black text-red-600 uppercase tracking-widest">
                          Dibatalkan {order.voidReason && <span className="text-red-400 font-bold ml-1">({order.voidReason})</span>}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 bg-brand-50 text-primary">
                          {(order.customerName || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-800 tracking-tight">
                            {order.customerName}
                          </p>
                          <p className="text-xs font-bold text-slate-400 mt-0.5">#{(order.orderNumber || "??").split("-").pop()}</p>
                        </div>
                      </div>
                      
                      <span 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm"
                        style={{ color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.color}20` }}
                      >
                        {statusStyle.icon}
                        {statusStyle.text}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Clock size={14} className="text-slate-400" />
                        <span>{formatTime(order.createdAt)}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        order.paymentStatus === "sudah_bayar" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                      }`}>
                        {order.paymentStatus === "sudah_bayar" ? "Lunas" : "Belum Bayar"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
