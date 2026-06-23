"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  TrendingUp,
  Package,
  AlertTriangle,
  Bell,
  CheckCheck,
  ChevronRight,
} from "lucide-react";

interface DashboardData {
  omzet: number;
  hpp: number;
  profit: number;
  orderCount: number;
  productionToday: { variantId: string; variantName: string; batches: number; loyangCount: number }[];
  lowStockItems: { id: string; name: string; currentStock: number; minStock: number; baseUnit: string }[];
}

interface AlertItem {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function OwnerDashboardPage() {
  const { user, getToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const token = await getToken();
      return fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
    },
    [getToken]
  );

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/dashboard/today").then((r) => r.json()),
      fetchWithAuth("/api/alerts?unread=true").then((r) => r.json()),
    ])
      .then(([d, a]) => {
        setData(d);
        setAlerts(Array.isArray(a) ? a : []);
      })
      .finally(() => setLoading(false));
  }, [fetchWithAuth]);

  async function markAllRead() {
    await fetchWithAuth("/api/alerts/read-all", { method: "PATCH" });
    setAlerts([]);
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);
  }

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="page-enter px-5 pt-6 pb-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-0.5">{today}</p>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">
            Hai, {user?.displayName?.split(" ")[0] ?? "Owner"} 👋
          </h1>
          <p className="text-sm text-stone-400 mt-0.5">Ringkasan bisnis hari ini</p>
        </div>
        {alerts.length > 0 && (
          <div className="relative mt-1">
            <div className="p-2 rounded-2xl bg-white shadow-sm border border-stone-100">
              <Bell size={20} className="text-stone-600" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
            </div>
          </div>
        )}
      </div>

      {/* Hero card */}
      {data && (
        <div
          className="relative rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 mb-4 overflow-hidden shadow-[0_8px_30px_rgba(5,150,105,0.25)]"
          data-testid="owner-hero-card"
        >
          <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -right-2 h-24 w-24 rounded-full bg-white/5" />

          <div className="relative">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={14} className="text-emerald-200" />
              <span className="text-sm font-medium text-emerald-100">Omzet Hari Ini</span>
            </div>
            <p className="text-3xl font-black tracking-tight text-white tabular-nums mb-2" data-testid="owner-omzet">
              {formatCurrency(data.omzet)}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-emerald-200">{data.orderCount} order</span>
              <span className="text-emerald-400">·</span>
              <span className="text-xs font-medium text-emerald-200">
                Profit: {formatCurrency(data.profit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      {data && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl bg-white border border-stone-100 shadow-sm p-4" data-testid="owner-hpp-card">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">HPP</p>
            <p className="text-xl font-black tabular-nums text-stone-900">{formatCurrency(data.hpp)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-stone-100 shadow-sm p-4" data-testid="owner-profit-card">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Profit</p>
            <p className="text-xl font-black tabular-nums text-emerald-600">{formatCurrency(data.profit)}</p>
          </div>
        </div>
      )}

      {/* Production today */}
      {data && data.productionToday.length > 0 && (
        <div className="rounded-2xl bg-white border border-stone-100 shadow-sm p-4 mb-4" data-testid="owner-production-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Package size={14} className="text-emerald-600" />
            </div>
            <h2 className="text-sm font-bold text-stone-900">Produksi Hari Ini</h2>
          </div>
          <div className="space-y-2">
            {data.productionToday.map((p) => (
              <div key={p.variantId} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
                <span className="text-sm font-medium text-stone-700">{p.variantName}</span>
                <span className="text-xs font-bold text-stone-500 tabular-nums">
                  {p.batches}batch · {p.loyangCount}lyang
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low stock */}
      {data && data.lowStockItems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-4" data-testid="owner-low-stock-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={14} className="text-amber-600" />
            </div>
            <h2 className="text-sm font-bold text-amber-800">Bahan Menipis</h2>
          </div>
          <div className="space-y-1.5">
            {data.lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-800">{item.name}</span>
                <span className="text-xs font-bold tabular-nums text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  {item.currentStock}/{item.minStock} {item.baseUnit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-2xl bg-white border border-stone-100 shadow-sm p-4" data-testid="owner-alerts-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-xl bg-rose-50 flex items-center justify-center">
                <Bell size={14} className="text-rose-500" />
              </div>
              <h2 className="text-sm font-bold text-stone-900">Notifikasi</h2>
              <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">{alerts.length}</span>
            </div>
            <Button
              onClick={markAllRead}
              variant="ghost"
              size="sm"
              className="text-xs gap-1 h-7 text-stone-500"
              data-testid="owner-mark-all-read"
            >
              <CheckCheck size={12} /> Baca semua
            </Button>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl px-3 py-2.5 ${
                  alert.severity === "warning"
                    ? "bg-amber-50 border border-amber-100"
                    : "bg-stone-50 border border-stone-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{alert.title}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{alert.message}</p>
                  </div>
                  <ChevronRight size={14} className="text-stone-300 mt-0.5 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
