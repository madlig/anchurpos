"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Loader2, ClipboardList } from "lucide-react";
import Link from "next/link";

interface OrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  source: string;
  createdAt: string;
}

export default function OrdersListPage() {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");

  const fetchWithAuth = useCallback(
    async (url: string) => {
      const token = await getToken();
      return fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    [getToken]
  );

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams();
        if (filter === "belum_selesai") params.set("status", "belum_selesai");
        if (filter === "belum_bayar")
          params.set("paymentStatus", "belum_bayar");
        const url = `/api/orders${params.toString() ? `?${params}` : ""}`;
        const res = await fetchWithAuth(url);
        const data = await res.json();
        if (res.ok) setOrders(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchWithAuth, filter]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const FILTERS = [
    { key: "semua", label: "Semua" },
    { key: "belum_selesai", label: "Belum Selesai" },
    { key: "belum_bayar", label: "Belum Bayar" },
  ];

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-1">Riwayat Order</h1>
      <p className="text-sm text-stone-500 mb-4">Daftar semua pesanan</p>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setLoading(true);
              setFilter(f.key);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f.key
                ? "bg-emerald-600 text-white"
                : "bg-stone-100 text-stone-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">Belum ada order</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link key={order.id} href={`/manager/orders/${order.id}`}>
              <Card className="p-4 hover:bg-stone-50 transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-bold text-stone-900">
                    {order.orderNumber}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === "selesai"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {order.status === "selesai" ? "Selesai" : "Proses"}
                  </span>
                </div>
                <p className="text-xs text-stone-600">{order.customerName}</p>
                <div className="flex items-center justify-between mt-2">
                  <span
                    className={`text-xs ${
                      order.paymentStatus === "sudah_bayar"
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}
                  >
                    {order.paymentStatus === "sudah_bayar"
                      ? "Lunas"
                      : "Belum Bayar"}
                  </span>
                  <span className="text-xs text-stone-400">
                    {formatDate(order.createdAt)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
