"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ClipboardList, ChevronRight } from "lucide-react";
import Link from "next/link";

interface OrderSummary {
  id: string; orderNumber: string; customerName: string;
  status: string; paymentStatus: string; source: string; createdAt: string;
}

const FILTERS = [
  { key: "semua", label: "Semua" },
  { key: "belum_selesai", label: "Belum Selesai" },
  { key: "belum_bayar", label: "Belum Bayar" },
];

export default function OrdersListPage() {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");

  const fetchWithAuth = useCallback(async (url: string) => {
    const token = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [getToken]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filter === "belum_selesai") params.set("status", "belum_selesai");
        if (filter === "belum_bayar") params.set("paymentStatus", "belum_bayar");
        const res = await fetchWithAuth(`/api/orders${params.toString() ? `?${params}` : ""}`);
        const data = await res.json();
        if (res.ok) setOrders(data);
      } finally { setLoading(false); }
    })();
  }, [fetchWithAuth, filter]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="px-5 pt-6 pb-4 max-w-md mx-auto page-enter">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#1C1C1E" }}>Riwayat Order</h1>
      <p className="text-sm mb-5" style={{ color: "#64748B" }}>Daftar semua pesanan</p>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all tap-target"
            style={filter === f.key
              ? { background: "linear-gradient(135deg,#E85D8C,#C94A73)", color: "#fff" }
              : { background: "#fff", color: "#64748B", border: "1px solid #E2E8F0" }}
            data-testid={`filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl p-10 text-center" style={{ background: "#fff", border: "2px dashed #E2E8F0" }}>
          <ClipboardList className="h-10 w-10 mx-auto mb-3" style={{ color: "#CBD5E1" }} />
          <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Belum ada order</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link key={order.id} href={`/manager/orders/${order.id}`} data-testid={`order-item-${order.id}`}>
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold" style={{ color: "#1C1C1E" }}>{order.orderNumber}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={order.status === "selesai"
                        ? { color: "#16A34A", background: "#DCFCE7" }
                        : { color: "#D97706", background: "#FEF3C7" }}>
                      {order.status === "selesai" ? "Selesai" : "Proses"}
                    </span>
                  </div>
                  <p className="text-xs truncate" style={{ color: "#64748B" }}>{order.customerName}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs font-semibold"
                      style={{ color: order.paymentStatus === "sudah_bayar" ? "#E85D8C" : "#DC2626" }}>
                      {order.paymentStatus === "sudah_bayar" ? "Lunas" : "Belum Bayar"}
                    </span>
                    <span className="text-xs" style={{ color: "#94A3B8" }}>{formatDate(order.createdAt)}</span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: "#CBD5E1" }} className="shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
