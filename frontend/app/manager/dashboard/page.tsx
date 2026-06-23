"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  TrendingUp,
  Package,
  AlertTriangle,
  Bell,
  CheckCheck,
  ShoppingCart,
  Receipt,
  Users,
} from "lucide-react";
import Link from "next/link";

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

export default function ManagerDashboardPage() {
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-stone-900">Dashboard</h1>
        <p className="text-sm text-stone-500">
          Hai, {user?.displayName ?? "Manager"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Link href="/manager/pos">
          <Card className="p-3 text-center hover:bg-stone-50 transition-colors">
            <ShoppingCart size={18} className="text-emerald-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-stone-700">Kasir</p>
          </Card>
        </Link>
        <Link href="/manager/inventory">
          <Card className="p-3 text-center hover:bg-stone-50 transition-colors">
            <Receipt size={18} className="text-emerald-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-stone-700">Pengeluaran</p>
          </Card>
        </Link>
        <Link href="/manager/employees">
          <Card className="p-3 text-center hover:bg-stone-50 transition-colors">
            <Users size={18} className="text-emerald-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-stone-700">Payroll</p>
          </Card>
        </Link>
      </div>

      {data && (
        <>
          <Card className="p-4 mb-3 bg-emerald-600 text-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-emerald-100">Omzet Hari Ini</span>
              <TrendingUp size={16} className="text-emerald-200" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(data.omzet)}</p>
            <p className="text-xs text-emerald-200 mt-1">
              {data.orderCount} order
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="p-3">
              <p className="text-xs text-stone-500">HPP</p>
              <p className="text-lg font-bold text-stone-900">
                {formatCurrency(data.hpp)}
              </p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-stone-500">Profit</p>
              <p className="text-lg font-bold text-emerald-600">
                {formatCurrency(data.profit)}
              </p>
            </Card>
          </div>

          {data.productionToday.length > 0 && (
            <Card className="p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Package size={16} className="text-stone-400" />
                <h2 className="text-sm font-semibold text-stone-900">
                  Produksi Hari Ini
                </h2>
              </div>
              <div className="space-y-1">
                {data.productionToday.map((p) => (
                  <div key={p.variantId} className="flex justify-between text-sm">
                    <span className="text-stone-600">{p.variantName}</span>
                    <span className="text-stone-900 font-medium">
                      {p.batches} batch, {p.loyangCount} loyang
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data.lowStockItems.length > 0 && (
            <Card className="p-4 mb-4 border-amber-200 bg-amber-50/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-800">
                  Bahan Menipis
                </h2>
              </div>
              <div className="space-y-1">
                {data.lowStockItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-amber-800">{item.name}</span>
                    <span className="text-amber-600 font-mono text-xs">
                      {item.currentStock.toLocaleString("id-ID")}/
                      {item.minStock.toLocaleString("id-ID")} {item.baseUnit}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {alerts.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-stone-400" />
              <h2 className="text-sm font-semibold text-stone-900">
                Notifikasi ({alerts.length})
              </h2>
            </div>
            <Button onClick={markAllRead} variant="ghost" size="sm" className="text-xs gap-1">
              <CheckCheck size={12} /> Tandai dibaca
            </Button>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg text-sm ${
                  alert.severity === "warning"
                    ? "bg-amber-50 border border-amber-100"
                    : "bg-stone-50 border border-stone-100"
                }`}
              >
                <p className="font-medium text-stone-900">{alert.title}</p>
                <p className="text-xs text-stone-500 mt-0.5">{alert.message}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
