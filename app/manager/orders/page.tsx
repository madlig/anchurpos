"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ClipboardList, ChevronRight, Ban } from "lucide-react";
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
  { key: "void", label: "Dibatalkan" },
];

function getStatusStyle(status: string) {
  if (status === "selesai") return { color: "#16A34A", background: "#DCFCE7" };
  if (status === "proses") return { color: "#D97706", background: "#FEF3C7" };
  if (status === "void") return { color: "#DC2626", background: "#FEE2E2" };
  return { color: "#64748B", background: "#F1F5F9" };
}
function getStatusLabel(status: string) {
  if (status === "selesai") return "Selesai";
  if (status === "proses") return "Proses";
  if (status === "void") return "Dibatalkan";
  return "Pending";
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
    <div className="page-enter min-h-screen" style={{ background: "#FCABB4" }}>

      {/* Header (white) */}
      <div className="px-5 pt-4 pb-0" style={{ background: "#fff" }}>
        <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Pesanan</h1>
        <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>
          {isVoidTab ? `${todayCount} pesanan dibatalkan` : `Hari ini — ${todayCount} pesanan`}
        </p>

        {/* Status Tabs — underline style */}
        <div className="flex" style={{ marginTop: "12px", overflowX: "auto" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`tab-${t.key}`}
              className="flex-shrink-0 tap-target"
              style={{
                paddingBottom: "8px",
                paddingTop: "8px",
                paddingLeft: "12px",
                paddingRight: "12px",
                fontSize: "12px",
                fontWeight: tab === t.key ? "600" : "500",
                color: tab === t.key
                  ? (t.key === "void" ? "#DC2626" : "#E85D8C")
                  : "#94A3B8",
                background: "transparent",
                border: "none",
                borderBottom: tab === t.key
                  ? `2px solid ${t.key === "void" ? "#DC2626" : "#E85D8C"}`
                  : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
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
            {isVoidTab
              ? <Ban className="mx-auto mb-3" size={32} style={{ color: "#CBD5E1" }} />
              : <ClipboardList className="mx-auto mb-3" size={32} style={{ color: "#CBD5E1" }} />
            }
            <p style={{ fontSize: "14px", color: "#94A3B8" }}>
              {isVoidTab ? "Tidak ada pesanan yang dibatalkan" : "Belum ada pesanan"}
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const isVoidCard = order.status === "void";
            return (
              <Link key={order.id} href={`/manager/orders/${order.id}`} data-testid={`order-item-${order.id}`}>
                <div
                  className="tap-target"
                  style={{
                    background: isVoidCard ? "#FAFAFA" : "#fff",
                    borderRadius: "14px",
                    padding: "14px",
                    border: isVoidCard ? "1px solid #FCA5A5" : "1px solid #F1F5F9",
                    opacity: isVoidCard ? 0.8 : 1,
                  }}
                >
                  {/* Void Banner */}
                  {isVoidCard && (
                    <div className="flex items-center gap-1.5 mb-2.5 pb-2" style={{ borderBottom: "1px dashed #FCA5A5" }}>
                      <Ban size={11} style={{ color: "#DC2626" }} />
                      <span style={{ fontSize: "10px", fontWeight: "700", color: "#DC2626", letterSpacing: "0.3px" }}>
                        DIBATALKAN
                        {order.voidReason && ` — ${order.voidReason}`}
                      </span>
                    </div>
                  )}

                  {/* Row 1: avatar + name + orderId + status */}
                  <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
                    <div className="flex items-center gap-2">
                      <div style={{
                        width: "32px", height: "32px", borderRadius: "10px",
                        background: isVoidCard ? "#F3F4F6" : "#FEF1F5",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: "12px", fontWeight: "600",
                        color: isVoidCard ? "#9CA3AF" : "#E85D8C", flexShrink: 0
                      }}>
                        {(order.customerName || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: "600", color: isVoidCard ? "#6B7280" : "#1C1C1E", textDecoration: isVoidCard ? "line-through" : "none" }}>{order.customerName}</p>
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

                  {/* Row 2: channel + payment status + time */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "11px", color: "#64748B" }}>
                        {CHANNEL_LABELS[order.orderChannel] ?? order.source?.replace(/_/g, " ") ?? "-"}
                      </span>
                      {order.paymentStatus === "belum_bayar" && !isVoidCard && (
                        <span style={{ padding: "2px 7px", borderRadius: "6px", background: "#FEE2E2", fontSize: "10px", fontWeight: "700", color: "#DC2626" }}>
                          Belum Bayar
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "11px", color: "#94A3B8" }}>{formatTime(order.createdAt)}</span>
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


