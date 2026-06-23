"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2, TrendingUp, Package, AlertTriangle, Bell,
  CheckCheck, ChevronRight, ShoppingBag,
} from "lucide-react";

interface DashboardData {
  omzet: number; hpp: number; profit: number; orderCount: number;
  productionToday: { variantId: string; variantName: string; batches: number; loyangCount: number }[];
  lowStockItems: { id: string; name: string; currentStock: number; minStock: number; baseUnit: string }[];
}
interface AlertItem {
  id: string; type: string; severity: string;
  title: string; message: string; isRead: boolean; createdAt: string;
}

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

  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} /></div>;
  }

  return (
    <div className="page-enter px-5 pt-6 pb-4 md:px-8 md:pt-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 max-w-5xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94A3B8" }}>{today}</p>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#1C1C1E" }}>
            Hai, {user?.displayName?.split(" ")[0] ?? "Owner"} 👋
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#94A3B8" }}>Ringkasan bisnis hari ini</p>
        </div>
        {alerts.length > 0 && (
          <button onClick={markAllRead} className="relative mt-1 p-2.5 rounded-2xl tap-target" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #F1F5F9" }} data-testid="alerts-bell-button">
            <Bell size={20} style={{ color: "#64748B" }} />
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full" style={{ background: "#DC2626", border: "2px solid white" }} />
          </button>
        )}
      </div>

      {/* Hero revenue card */}
      {data && (
        <div
          data-testid="owner-hero-card"
          className="relative rounded-3xl p-6 mb-5 overflow-hidden max-w-5xl"
          style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)", boxShadow: "0 8px 32px rgba(232,93,140,0.3)" }}
        >
          <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
          <div className="absolute -bottom-8 right-8 h-20 w-20 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="relative md:flex md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={14} style={{ color: "rgba(255,255,255,0.7)" }} />
                <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>Omzet Hari Ini</span>
              </div>
              <p className="text-3xl font-extrabold tracking-tight text-white tabular-nums mb-2" data-testid="owner-omzet">{fmt(data.omzet)}</p>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>{data.orderCount} order</span>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>Profit: {fmt(data.profit)}</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4 mt-0">
              <div className="rounded-2xl px-5 py-3" style={{ background: "rgba(255,255,255,0.15)" }}>
                <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>HPP</p>
                <p className="text-lg font-extrabold text-white tabular-nums">{fmt(data.hpp)}</p>
              </div>
              <div className="rounded-2xl px-5 py-3" style={{ background: "rgba(255,255,255,0.15)" }}>
                <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>Profit Bersih</p>
                <p className="text-lg font-extrabold text-white tabular-nums">{fmt(data.profit)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats row - mobile only (desktop shows in hero card) */}
      {data && (
        <div className="grid grid-cols-2 gap-3 mb-5 md:hidden">
          <div className="rounded-2xl p-4" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #F1F5F9" }} data-testid="owner-hpp-card">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#94A3B8" }}>HPP</p>
            <p className="text-lg font-extrabold tabular-nums" style={{ color: "#1C1C1E" }}>{fmt(data.hpp)}</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #F1F5F9" }} data-testid="owner-profit-card">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#94A3B8" }}>Profit</p>
            <p className="text-lg font-extrabold tabular-nums" style={{ color: "#E85D8C" }}>{fmt(data.profit)}</p>
          </div>
        </div>
      )}

      {/* Desktop: 2-col content layout */}
      <div className="md:grid md:grid-cols-2 md:gap-5 max-w-5xl">
        {/* Left column */}
        <div className="space-y-4">
          {/* Production today */}
          {data && data.productionToday.length > 0 && (
            <div className="rounded-2xl p-4 page-enter stagger-2" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #F1F5F9" }} data-testid="owner-production-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: "#FEF1F5" }}>
                  <Package size={14} style={{ color: "#E85D8C" }} />
                </div>
                <h2 className="text-sm font-bold" style={{ color: "#1C1C1E" }}>Produksi Hari Ini</h2>
              </div>
              <div className="space-y-2">
                {data.productionToday.map((p) => (
                  <div key={p.variantId} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "#F8FAFC" }}>
                    <span className="text-sm font-medium" style={{ color: "#334155" }}>{p.variantName}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: "#64748B" }}>
                      {p.batches} batch · {p.loyangCount} loyang
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low stock */}
          {data && data.lowStockItems.length > 0 && (
            <div className="rounded-2xl p-4 page-enter stagger-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }} data-testid="owner-low-stock-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: "#FEE2E2" }}>
                  <AlertTriangle size={14} style={{ color: "#DC2626" }} />
                </div>
                <h2 className="text-sm font-bold" style={{ color: "#991B1B" }}>Bahan Menipis</h2>
              </div>
              <div className="space-y-1.5">
                {data.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: "#991B1B" }}>{item.name}</span>
                    <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full" style={{ color: "#DC2626", background: "#FEE2E2" }}>
                      {item.currentStock}/{item.minStock} {item.baseUnit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when no data */}
          {data && data.productionToday.length === 0 && data.lowStockItems.length === 0 && (
            <div className="rounded-2xl p-6 text-center" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
              <ShoppingBag size={28} className="mx-auto mb-2" style={{ color: "#CBD5E1" }} />
              <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Semua stok aman hari ini</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4 mt-4 md:mt-0">
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="rounded-2xl p-4 page-enter stagger-4" style={{ background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #F1F5F9" }} data-testid="owner-alerts-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: "#FEF1F5" }}>
                    <Bell size={14} style={{ color: "#E85D8C" }} />
                  </div>
                  <h2 className="text-sm font-bold" style={{ color: "#1C1C1E" }}>Notifikasi</h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: "#E85D8C", background: "#FEF1F5" }}>{alerts.length}</span>
                </div>
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-semibold tap-target" style={{ color: "#64748B" }} data-testid="owner-mark-all-read">
                  <CheckCheck size={12} /> Baca semua
                </button>
              </div>
              <div className="space-y-2">
                {alerts.slice(0, 6).map((alert) => (
                  <div key={alert.id} className="rounded-xl px-3 py-2.5 flex items-start justify-between gap-2"
                    style={{ background: alert.severity === "warning" ? "#FFFBEB" : "#F8FAFC", border: `1px solid ${alert.severity === "warning" ? "#FDE68A" : "#F1F5F9"}` }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>{alert.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>{alert.message}</p>
                    </div>
                    <ChevronRight size={14} style={{ color: "#CBD5E1" }} className="mt-0.5 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {alerts.length === 0 && (
            <div className="rounded-2xl p-6 text-center" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
              <CheckCheck size={28} className="mx-auto mb-2" style={{ color: "#CBD5E1" }} />
              <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Tidak ada notifikasi baru</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
