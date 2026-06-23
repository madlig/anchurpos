"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Bell, AlertTriangle, CheckCheck, ChevronRight, TrendingUp } from "lucide-react";

interface DashboardData {
  omzet: number; hpp: number; profit: number; orderCount: number;
  productionToday: { variantId: string; variantName: string; batches: number; loyangCount: number }[];
  lowStockItems: { id: string; name: string; currentStock: number; minStock: number; baseUnit: string }[];
}
interface AlertItem {
  id: string; type: string; severity: string;
  title: string; message: string; isRead: boolean; createdAt: string;
}

const DAILY_TARGET = 3_000_000;

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function OwnerDashboardPage() {
  const { user, getToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/dashboard/today").then((r) => r.json()),
      fetchWithAuth("/api/alerts?unread=true").then((r) => r.json()),
    ]).then(([d, a]) => { setData(d); setAlerts(Array.isArray(a) ? a : []); }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  async function markAllRead() {
    await fetchWithAuth("/api/alerts/read-all", { method: "PATCH" });
    setAlerts([]);
  }

  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

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

      {/* Header (white) */}
      <div className="px-5 pt-4 pb-4" style={{ background: "#fff" }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs" style={{ color: "#94A3B8" }}>Owner</p>
            <h1 className="text-lg font-bold mt-0.5" style={{ color: "#1C1C1E" }}>Overview</h1>
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
        <p className="text-xs mt-1.5" style={{ color: "#94A3B8" }}>{todayLabel} — Semua Outlet</p>
      </div>

      <div className="px-4 pt-4 pb-4 md:px-8 md:max-w-5xl">

        {/* Total Revenue Card */}
        {data && (
          <div
            data-testid="owner-hero-card"
            className="relative overflow-hidden"
            style={{
              borderRadius: "16px",
              padding: "20px",
              background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
              marginBottom: "12px",
            }}
          >
            {/* Decorative circles */}
            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "100px", height: "100px", borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
            <div style={{ position: "absolute", bottom: "-30px", right: "30px", width: "70px", height: "70px", borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />

            <div style={{ position: "relative" }}>
              <div className="flex items-center gap-1.5" style={{ marginBottom: "6px" }}>
                <TrendingUp size={13} style={{ color: "rgba(255,255,255,0.75)" }} />
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)", fontWeight: "500" }}>Total Omzet Hari Ini</span>
              </div>
              <p
                data-testid="owner-omzet"
                style={{ fontSize: "28px", fontWeight: "700", color: "#fff", marginBottom: "16px" }}
              >
                {fmt(data.omzet)}
              </p>
              <div className="flex gap-4">
                <div style={{ padding: "8px 14px", borderRadius: "100px", background: "rgba(255,255,255,0.2)" }}>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)" }}>Pesanan</p>
                  <p style={{ fontSize: "16px", fontWeight: "700", color: "#fff" }}>{data.orderCount}</p>
                </div>
                <div style={{ padding: "8px 14px", borderRadius: "100px", background: "rgba(255,255,255,0.2)" }}>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)" }}>Outlet Aktif</p>
                  <p style={{ fontSize: "16px", fontWeight: "700", color: "#fff" }}>1</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerts Card */}
        {alerts.length > 0 && (
          <div
            data-testid="owner-alerts-card"
            style={{ borderRadius: "14px", padding: "14px", background: "#FFFBEB", border: "1px solid #FDE68A", marginBottom: "12px" }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} style={{ color: "#D97706" }} />
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#92400E" }}>{alerts.length} Notifikasi</span>
              </div>
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 tap-target"
                style={{ fontSize: "11px", fontWeight: "600", color: "#D97706" }}
                data-testid="owner-mark-all-read"
              >
                <CheckCheck size={12} /> Tandai semua
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {alerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between" style={{ padding: "8px 10px", borderRadius: "10px", background: "#fff" }}>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: "600", color: "#1C1C1E" }}>{alert.title}</p>
                    <p style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>{alert.message}</p>
                  </div>
                  <ChevronRight size={14} style={{ color: "#CBD5E1", flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Low Stock */}
        {data && data.lowStockItems.length > 0 && (
          <div
            data-testid="owner-low-stock-card"
            style={{ borderRadius: "14px", padding: "14px", background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: "12px" }}
          >
            <div className="flex items-center gap-2" style={{ marginBottom: "10px" }}>
              <AlertTriangle size={16} style={{ color: "#DC2626" }} />
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#991B1B" }}>Bahan Menipis</span>
            </div>
            {data.lowStockItems.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center justify-between"
                style={{ padding: "8px 0", borderBottom: i < data.lowStockItems.length - 1 ? "1px solid #FECACA" : "none" }}
              >
                <span style={{ fontSize: "13px", fontWeight: "500", color: "#991B1B" }}>{item.name}</span>
                <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px", color: "#DC2626", background: "#FEE2E2" }}>
                  {item.currentStock}/{item.minStock} {item.baseUnit}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Per Outlet */}
        <div>
          <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E", marginBottom: "10px" }}>Per Outlet</p>
          {data && (
            <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }} data-testid="outlet-card-utama">
              <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>Outlet Utama</p>
                  <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{data.orderCount} pesanan</p>
                </div>
                <p style={{ fontSize: "17px", fontWeight: "700", color: "#1C1C1E" }}>{fmt(data.omzet)}</p>
              </div>
              <div style={{ height: "6px", borderRadius: "3px", background: "#F1F5F9" }}>
                <div style={{ height: "6px", borderRadius: "3px", background: "linear-gradient(90deg,#E85D8C,#F2A0B7)", width: `${omzetPct}%`, transition: "width 0.6s" }} />
              </div>
              <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "5px" }}>{omzetPct}% dari target {fmt(DAILY_TARGET)}</p>
            </div>
          )}
        </div>

        {/* Production */}
        {data && data.productionToday.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E", marginBottom: "10px" }}>Produksi Hari Ini</p>
            <div style={{ background: "#fff", borderRadius: "14px", overflow: "hidden", border: "1px solid #F1F5F9" }} data-testid="owner-production-card">
              {data.productionToday.map((p, i) => (
                <div
                  key={p.variantId}
                  className="flex items-center justify-between"
                  style={{ padding: "12px 14px", borderBottom: i < data.productionToday.length - 1 ? "1px solid #F8FAFC" : "none" }}
                >
                  <span style={{ fontSize: "13px", color: "#334155", fontWeight: "500" }}>{p.variantName}</span>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px", color: "#E85D8C", background: "#FEF1F5" }}>
                    {p.batches}b · {p.loyangCount} loyang
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
