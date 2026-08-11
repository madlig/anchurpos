"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ArrowLeft, RefreshCw, Search, Filter } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";

interface Order {
  id: string;
  orderNumber?: string;
  customerName?: string;
  orderChannel?: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  totalOrderValue?: number;
  platformFee?: number;
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-50 text-amber-700 border-amber-200" },
  proses: { label: "Proses", color: "bg-blue-50 text-blue-700 border-blue-200" },
  selesai: { label: "Selesai", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  void: { label: "Void", color: "bg-slate-100 text-slate-500 border-slate-200" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function OwnerOrdersPage() {
  const { fetchWithAuth } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/orders");
      if (res.ok) setOrders(await res.json());
    } finally { setLoading(false); }
  }, [fetchWithAuth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    return orders
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (o.orderNumber || "").toLowerCase().includes(q) || (o.customerName || "").toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, search, statusFilter]);

  const totalOmzet = filtered.reduce((s, o) => s + (o.totalOrderValue ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/owner/dashboard" className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 text-slate-600">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800">Riwayat Order</h1>
                <p className="text-xs text-slate-400">{filtered.length} pesanan • Total: {fmt(totalOmzet)}</p>
              </div>
            </div>
            <button onClick={fetchData} className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
              <RefreshCw size={16} className={loading ? "animate-spin text-primary" : ""} />
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Cari no. order / customer..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none">
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="proses">Proses</option>
              <option value="selesai">Selesai</option>
              <option value="void">Void</option>
            </select>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-5xl mx-auto pt-4">
        {loading ? (
          <div className="space-y-2 pt-4">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center"><p className="text-sm text-slate-400">Tidak ada pesanan ditemukan.</p></div>
        ) : (
          <div className="space-y-2 pb-4">
            {filtered.slice(0, 50).map((o) => {
              const st = STATUS_MAP[o.status] || STATUS_MAP.pending;
              return (
                <div key={o.id} className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-slate-800">{o.orderNumber || o.id.slice(0, 8)}</span>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase border ${st.color}`}>{st.label}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${o.paymentStatus === "sudah_bayar" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                        {o.paymentStatus === "sudah_bayar" ? "Lunas" : "Belum Bayar"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span>{(o.customerName || "Walk-in")}</span>
                      <span>•</span>
                      <span>{o.orderChannel || "walkin"}</span>
                      <span>•</span>
                      <span>{new Date(o.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black tabular-nums text-slate-800">{fmt(o.totalOrderValue ?? 0)}</p>
                    <p className="text-[10px] text-slate-400">{o.paymentMethod || "cash"}</p>
                  </div>
                </div>
              );
            })}
            {filtered.length > 50 && <p className="text-center text-xs text-slate-400 py-4">Menampilkan 50 dari {filtered.length} pesanan</p>}
          </div>
        )}
      </div>
    </div>
  );
}
