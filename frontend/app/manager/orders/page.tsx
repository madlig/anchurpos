"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ClipboardList, ChevronRight } from "lucide-react";
import Link from "next/link";

interface OrderSummary {
  id: string; orderNumber: string; customerName: string;
  status: string; paymentStatus: string; source: string; createdAt: string;
}

const TABS = [
  { key: "semua", label: "Semua" },
  { key: "pending", label: "Pending" },
  { key: "proses", label: "Proses" },
  { key: "selesai", label: "Selesai" },
];

function getStatusStyle(status: string) {
  if (status === "selesai") return { color: "#16A34A", background: "#DCFCE7" };
  if (status === "proses") return { color: "#D97706", background: "#FEF3C7" };
  return { color: "#64748B", background: "#F1F5F9" };
}
function getStatusLabel(status: string) {
  if (status === "selesai") return "Selesai";
  if (status === "proses") return "Proses";
  return "Pending";
}

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

  return (
    <div className="page-enter min-h-screen" style={{ background: "#FCABB4" }}>

      {/* Header (white) */}
      <div className="px-5 pt-4 pb-0" style={{ background: "#fff" }}>
        <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Pesanan</h1>
        <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>
          Hari ini — {todayCount} pesanan
        </p>

        {/* Status Tabs — underline style */}
        <div className="flex" style={{ marginTop: "12px" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`tab-${t.key}`}
              className="flex-1 tap-target"
              style={{
                paddingBottom: "8px",
                paddingTop: "8px",
                borderBottom: tab === t.key ? "2px solid #E85D8C" : "2px solid transparent",
                fontSize: "12px",
                fontWeight: tab === t.key ? "600" : "500",
                color: tab === t.key ? "#E85D8C" : "#94A3B8",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Order Cards */}
      <div className="px-4 pt-3 pb-4 flex flex-col gap-2.5 md:px-8 md:max-w-5xl">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
          </div>
        ) : orders.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "14px", padding: "40px", textAlign: "center", border: "1px solid #F1F5F9" }}>
            <ClipboardList className="mx-auto mb-3" size={32} style={{ color: "#CBD5E1" }} />
            <p style={{ fontSize: "14px", color: "#94A3B8" }}>Belum ada pesanan</p>
          </div>
        ) : (
          orders.map((order) => (
            <Link key={order.id} href={`/manager/orders/${order.id}`} data-testid={`order-item-${order.id}`}>
              <div
                className="tap-target"
                style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }}
              >
                {/* Row 1: avatar + name + orderId + status */}
                <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
                  <div className="flex items-center gap-2">
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "10px",
                      background: "#FEF1F5", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "12px", fontWeight: "600", color: "#E85D8C", flexShrink: 0
                    }}>
                      {(order.customerName || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{order.customerName}</p>
                      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{order.orderNumber}</p>
                    </div>
                  </div>
                  <span style={{
                    padding: "3px 10px", borderRadius: "100px",
                    fontSize: "10px", fontWeight: "500",
                    ...getStatusStyle(order.status)
                  }}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                {/* Row 2: source + time */}
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: "12px", color: "#64748B" }}>{order.source?.replace(/_/g, " ") ?? "-"}</span>
                  <span style={{ fontSize: "11px", color: "#94A3B8" }}>{formatTime(order.createdAt)}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
