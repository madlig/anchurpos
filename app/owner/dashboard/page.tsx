"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Bell, AlertTriangle, TrendingUp, History, ClipboardList, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function OwnerDashboardPage() {
  const { user, getToken } = useAuth();
  const [data, setData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/dashboard/today").then((r) => r.json()),
      fetchWithAuth("/api/alerts?unread=true").then((r) => r.json()),
      fetchWithAuth("/api/tasks?limit=5").then((r) => r.json())
    ]).then(([d, a, t]) => { 
      setData(d); 
      setAlerts(Array.isArray(a) ? a : []); 
      setTasks(Array.isArray(t) ? t : []);
    }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  async function markAllRead() {
    await fetchWithAuth("/api/alerts/read-all", { method: "PATCH" });
    setAlerts([]);
  }

  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="page-enter min-h-screen bg-slate-50 pb-24">

      {/* Header */}
      <div className="bg-white px-5 pt-6 pb-5 shadow-sm rounded-b-[32px] mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{todayLabel}</p>
            <h1 className="text-xl font-black text-slate-800 mt-1">Owner Dashboard</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Status: Semua Cabang Beroperasi</p>
          </div>
          <button onClick={alerts.length > 0 ? markAllRead : undefined} className="relative p-3 rounded-2xl bg-slate-50 border border-slate-100 tap-target">
            <Bell size={18} className="text-slate-600" />
            {alerts.length > 0 && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white" />}
          </button>
        </div>
      </div>

      <div className="px-5 space-y-6 max-w-md mx-auto">

        {/* P&L COMMAND CENTER */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-bold text-slate-800">Laba & Rugi (Hari Ini)</h2>
          </div>
          
          <div className="bg-slate-900 rounded-[28px] p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
            {/* Dekorasi */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp size={12} className="text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Total Penjualan (Omzet)</span>
            </div>
            
            <p className="text-4xl font-black tabular-nums tracking-tight">{fmt(data?.omzet || 0)}</p>
            
            <div className="mt-6 space-y-2 border-t border-white/10 pt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Est. HPP (Bahan Baku)</span>
                <span className="font-bold text-red-400">-{fmt(data?.hpp || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Laba Kotor (Gross)</span>
                <span className="font-bold text-emerald-400">{fmt(data?.profit || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TRANSPARENCY & AUDIT CENTER */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-bold text-slate-800">Pusat Transparansi</h2>
          </div>
          
          <Link href="/owner/stock-history" className="block bg-white p-5 rounded-3xl border border-slate-100 shadow-sm active:scale-[0.98] transition-all group">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <History size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Buku Stok (Audit Trail)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Lacak setiap pergerakan barang (terjual, diproduksi, dibuang) lengkap dengan waktunya. Bebas kecurigaan.
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* ACTIVITY LOG (TIMELINE) */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-sm font-bold text-slate-800">Aktivitas Outlet Terkini</h2>
            <Link href="/manager/tasks" className="text-xs font-bold text-primary">Lihat Semua</Link>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            {tasks.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Belum ada aktivitas tercatat hari ini.</p>
            ) : (
              <div className="space-y-5 relative before:absolute before:inset-0 before:ml-[11px] before:h-full before:w-[2px] before:bg-slate-100">
                {tasks.map(t => (
                  <div key={t.id} className="relative flex items-start gap-4 z-10">
                    {t.status === 'done' ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center shrink-0 mt-0.5">
                        <ClipboardList size={10} className="text-slate-400" />
                      </div>
                    )}
                    
                    <div className="flex-1 pb-1">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(t.createdAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                        {t.status === 'done' && <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md uppercase">Selesai</span>}
                      </div>
                      <p className="text-sm font-bold text-slate-800">{t.title}</p>
                      {t.status === 'done' && t.completedAt && (
                        <p className="text-xs text-slate-500 mt-1">Selesai pada {new Date(t.completedAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
