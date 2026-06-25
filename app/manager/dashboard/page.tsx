"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Bell, AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  omzet: number; hpp: number; operationalExpenses: number; totalPengeluaran: number; profit: number; orderCount: number;
  productionToday: { variantId: string; variantName: string; batches: number; loyangCount: number }[];
  lowStockItems: { id: string; name: string; currentStock: number; minStock: number; baseUnit: string }[];
}
interface AlertItem {
  id: string; type: string; severity: string;
  title: string; message: string; isRead: boolean; createdAt: string;
}
interface OrderSummary {
  id: string; orderNumber: string; customerName: string;
  status: string; paymentStatus: string; createdAt: string;
}

const DAILY_TARGET = 2_000_000;

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)}k`;
  return fmt(n);
}

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

export default function ManagerDashboardPage() {
  const { user, getToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/dashboard/today").then((r) => r.json()),
      fetchWithAuth("/api/alerts?unread=true").then((r) => r.json()),
      fetchWithAuth("/api/orders").then((r) => r.json()),
    ]).then(([d, a, o]) => {
      setData(d);
      setAlerts(Array.isArray(a) ? a : []);
      setRecentOrders(Array.isArray(o) ? o.slice(0, 5) : []);
    }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  async function markAllRead() {
    await fetchWithAuth("/api/alerts/read-all", { method: "PATCH" });
    setAlerts([]);
  }

  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat Pagi";
    if (h < 15) return "Selamat Siang";
    if (h < 18) return "Selamat Sore";
    return "Selamat Malam";
  })();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
      </div>
    );
  }

  const omzetPct = data ? Math.min(100, Math.round((data.omzet / DAILY_TARGET) * 100)) : 0;

  return (
    <div className="page-enter min-h-screen" style={{ background: "#FCABB4" }}>

      {/* ── Greeting Header (white) ── */}
      <div className="px-5 pt-4 pb-4" style={{ background: "#fff" }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs" style={{ color: "#94A3B8" }}>{greeting}</p>
            <h1 className="text-lg font-bold mt-0.5" style={{ color: "#1C1C1E" }}>
              {user?.displayName?.split(" ")[0] ?? "Manager"}
            </h1>
          </div>
          <button
            onClick={alerts.length > 0 ? markAllRead : undefined}
            className="relative p-2.5 rounded-2xl tap-target"
            style={{ background: "#FEF1F5" }}
            data-testid="alerts-bell-button"
          >
            <Bell size={18} style={{ color: "#E85D8C" }} />
            {alerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full" style={{ background: "#DC2626", border: "2px solid #FEF1F5" }} />
            )}
          </button>
        </div>
        <p className="text-xs mt-1.5" style={{ color: "#94A3B8" }}>{todayLabel} — Outlet Utama</p>
      </div>

      {/* ── Stats Section ── */}
      <div className="px-4 pt-4 flex flex-col gap-2.5 md:px-8 md:max-w-5xl">

        {/* Omzet Card */}
        <div
          data-testid="omzet-card"
          style={{ background: "#fff", borderRadius: "14px", padding: "14px 16px", border: "1px solid #F1F5F9" }}
        >
          <div className="flex justify-between items-center" style={{ marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "500", color: "#64748B" }}>Omzet Hari Ini</span>
            <span style={{ fontSize: "11px", fontWeight: "500", color: "#16A34A" }}>↑ {omzetPct}%</span>
          </div>
          <p data-testid="omzet-value" style={{ fontSize: "22px", fontWeight: "700", color: "#1C1C1E", marginBottom: "10px" }}>
            {data ? fmt(data.omzet) : "Rp 0"}
          </p>
          <div style={{ height: "6px", borderRadius: "3px", background: "#F1F5F9" }}>
            <div style={{ height: "6px", borderRadius: "3px", background: "linear-gradient(90deg,#E85D8C,#F2A0B7)", width: `${omzetPct}%`, transition: "width 0.6s ease" }} />
          </div>
          <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Target: {fmt(DAILY_TARGET)}</p>
        </div>

        {/* 2-col stats */}
        <div className="flex gap-2.5">
          <div
            data-testid="orders-count-card"
            className="flex-1"
            style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }}
          >
            <p style={{ fontSize: "11px", fontWeight: "500", color: "#64748B", marginBottom: "6px" }}>Pesanan</p>
            <p style={{ fontSize: "20px", fontWeight: "700", color: "#1C1C1E" }}>{data?.orderCount ?? 0}</p>
            <div style={{ height: "4px", borderRadius: "2px", background: "#F1F5F9", marginTop: "8px" }}>
              <div style={{ height: "4px", borderRadius: "2px", background: "#16A34A", width: "72%" }} />
            </div>
          </div>
          <div
            data-testid="expenses-card"
            className="flex-1"
            style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }}
          >
            <p style={{ fontSize: "11px", fontWeight: "500", color: "#64748B", marginBottom: "6px" }}>Pengeluaran Hari Ini</p>
            <p style={{ fontSize: "20px", fontWeight: "700", color: "#1C1C1E" }}>{data ? fmtShort(data.totalPengeluaran) : "Rp 0"}</p>
            <div style={{ height: "4px", borderRadius: "2px", background: "#F1F5F9", marginTop: "8px" }}>
              <div style={{ height: "4px", borderRadius: "2px", background: "#D97706", width: "45%" }} />
            </div>
          </div>
        </div>

        {/* Profit Card */}
        <div
          data-testid="profit-card"
          style={{ background: "#fff", borderRadius: "14px", padding: "14px 16px", border: "1px solid #F1F5F9" }}
        >
          <div className="flex justify-between items-center" style={{ marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "500", color: "#64748B" }}>Pemasukan Bersih</span>
          </div>
          <p data-testid="profit-value" style={{ fontSize: "22px", fontWeight: "700", color: "#16A34A", marginBottom: "4px" }}>
            {data ? fmt(data.profit) : "Rp 0"}
          </p>
        </div>
      </div>

      {/* ── Low Stock Alert ── */}
      {data && data.lowStockItems.length > 0 && (
        <div className="px-4 pt-3 md:px-8 md:max-w-5xl">
          <div style={{ padding: "10px 14px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", fontWeight: "500", color: "#DC2626" }}>
              {data.lowStockItems.length} bahan baku stok rendah
            </span>
          </div>
        </div>
      )}

      {/* ── Recent Orders ── */}
      <div className="px-4 pt-5 pb-2 md:px-8 md:max-w-5xl">
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#1C1C1E" }}>Pesanan Terbaru</h2>
          <Link href="/manager/orders" className="text-xs font-semibold tap-target" style={{ color: "#E85D8C" }}>
            Lihat semua
          </Link>
        </div>
        <div style={{ background: "#fff", borderRadius: "14px", overflow: "hidden", border: "1px solid #F1F5F9" }} data-testid="recent-orders-card">
          {recentOrders.length === 0 ? (
            <div className="py-8 text-center" style={{ color: "#94A3B8", fontSize: "13px" }}>
              Belum ada pesanan hari ini
            </div>
          ) : (
            recentOrders.map((o, i) => (
              <Link key={o.id} href={`/manager/orders/${o.id}`} data-testid={`recent-order-${i}`}>
                <div
                  className="flex items-start justify-between tap-target"
                  style={{
                    padding: "12px 14px",
                    borderBottom: i < recentOrders.length - 1 ? "1px solid #F8FAFC" : "none",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "10px",
                      background: "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: "600", color: "#E85D8C", flexShrink: 0
                    }}>
                      {(o.customerName || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{o.customerName}</span>
                        <span style={{ fontSize: "11px", color: "#94A3B8" }}>{o.orderNumber}</span>
                      </div>
                      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                        {new Date(o.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <span
                    style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: "500", ...getStatusStyle(o.status) }}
                  >
                    {getStatusLabel(o.status)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* ── Low Stock Detail ── */}
      {data && data.lowStockItems.length > 0 && (
        <div className="px-4 pt-3 pb-4 md:px-8 md:max-w-5xl">
          <h2 className="mb-3" style={{ fontSize: "14px", fontWeight: "600", color: "#1C1C1E" }}>Bahan Menipis</h2>
          <div style={{ background: "#FEF2F2", borderRadius: "14px", overflow: "hidden", border: "1px solid #FECACA" }} data-testid="low-stock-card">
            {data.lowStockItems.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center justify-between"
                style={{
                  padding: "11px 14px",
                  borderBottom: i < data.lowStockItems.length - 1 ? "1px solid #FECACA" : "none",
                }}
                data-testid={`low-stock-item-${i}`}
              >
                <span style={{ fontSize: "13px", fontWeight: "500", color: "#991B1B" }}>{item.name}</span>
                <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "100px", color: "#DC2626", background: "#FEE2E2" }}>
                  {item.currentStock}/{item.minStock} {item.baseUnit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Produksi Hari Ini ── */}
      {data && data.productionToday.length > 0 && (
        <div className="px-4 pb-4 md:px-8 md:max-w-5xl">
          <h2 className="mb-3" style={{ fontSize: "14px", fontWeight: "600", color: "#1C1C1E" }}>Produksi Hari Ini</h2>
          <div style={{ background: "#fff", borderRadius: "14px", overflow: "hidden", border: "1px solid #F1F5F9" }} data-testid="production-today-card">
            {data.productionToday.map((p, i) => (
              <div
                key={p.variantId}
                className="flex items-center justify-between"
                style={{
                  padding: "11px 14px",
                  borderBottom: i < data.productionToday.length - 1 ? "1px solid #F8FAFC" : "none",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: "500", color: "#334155" }}>{p.variantName}</span>
                <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "100px", color: "#E85D8C", background: "#FEF1F5" }}>
                  {p.batches} batch · {p.loyangCount} loyang
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
