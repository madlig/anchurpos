"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  Loader2, Bell, ShoppingCart, ClipboardList, Banknote, FileText, 
  Users, Package, Database, BookOpen, ChefHat, 
  TrendingUp, AlertTriangle, ChevronRight, Layers, ArrowLeftRight, CheckCircle2,
  Wallet, Building2, Target, BarChart3, ShieldCheck
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  omzet: number; 
  hpp: number; 
  operationalExpenses: number; 
  totalPengeluaran: number; 
  profit: number; 
  orderCount: number;
  productionToday: { variantId: string; variantName: string; batches: number; loyangCount: number }[];
  lowStockItems: { id: string; name: string; currentStock: number; minStock: number; baseUnit: string }[];
}

interface AlertItem {
  id: string; type: string; severity: string;
  title: string; message: string; isRead: boolean; createdAt: string;
}

interface OrderSummary {
  id: string; orderNumber: string; customerName: string;
  status: string; paymentStatus: string; createdAt: string; totalOrderValue?: number;
}

interface PnlSummary {
  saldoBukuCash: number;
  saldoBukuBank: number;
}

const DAILY_TARGET = 2_000_000;

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function ManagerDashboardPage() {
  const { user, getToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([]);
  const [pnlSummary, setPnlSummary] = useState<PnlSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSector, setActiveSector] = useState<"all" | "penjualan" | "keuangan" | "produksi" | "sdm">("all");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    const currentMonth = new Date().toISOString().substring(0, 7);
    Promise.all([
      fetchWithAuth("/api/dashboard/today").then((r) => r.json()),
      fetchWithAuth("/api/alerts?unread=true").then((r) => r.json()),
      fetchWithAuth("/api/orders").then((r) => r.json()),
      fetchWithAuth(`/api/reports/pnl?month=${currentMonth}`).then((r) => r.ok ? r.json() : null),
    ]).then(([d, a, o, p]) => {
      setData(d);
      setAlerts(Array.isArray(a) ? a : []);
      setRecentOrders(Array.isArray(o) ? o.slice(0, 5) : []);
      if (p) {
        setPnlSummary({
          saldoBukuCash: p.saldoBukuCash ?? 0,
          saldoBukuBank: p.saldoBukuBank ?? 0,
        });
      }
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
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const omzet = data?.omzet ?? 0;
  const omzetPct = Math.min(100, Math.round((omzet / DAILY_TARGET) * 100));

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      {/* ── Native App Professional Header ── */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-4 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-gradient-to-br from-primary to-rose-600 flex items-center justify-center text-white font-black text-base md:text-lg shadow-md shadow-primary/20">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "M"}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">{greeting}</p>
                <h1 className="text-base md:text-lg font-extrabold text-slate-800 tracking-tight leading-tight">
                  {user?.displayName ?? "Manager Outlet"}
                </h1>
                <p className="text-[11px] font-semibold text-slate-400">{todayLabel} • Outlet Utama</p>
              </div>
            </div>

            <button
              onClick={alerts.length > 0 ? markAllRead : undefined}
              className="relative w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Bell size={18} />
              {alerts.length > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
              )}
            </button>
          </div>

          {/* ── Financial Ledger Balance Card ── */}
          <div className="rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 text-white shadow-xl shadow-slate-900/10 border border-slate-800">
            <div className="grid grid-cols-2 gap-4 pb-3.5 border-b border-slate-700/60">
              <div>
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] md:text-xs font-bold uppercase tracking-wider">
                  <Wallet size={13} className="text-amber-400" />
                  <span>Laci Tunai</span>
                </div>
                <div className="text-sm md:text-base font-black text-white mt-1 tabular-nums">
                  {fmt(pnlSummary?.saldoBukuCash ?? 0)}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] md:text-xs font-bold uppercase tracking-wider">
                  <Building2 size={13} className="text-emerald-400" />
                  <span>Bank Transfer</span>
                </div>
                <div className="text-sm md:text-base font-black text-emerald-400 mt-1 tabular-nums">
                  {fmt(pnlSummary?.saldoBukuBank ?? 0)}
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-400" /> Mutasi Real-time
              </span>

              <Link
                href="/manager/reports?tab=cashflow"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1 border border-white/10"
              >
                <ArrowLeftRight size={13} /> Setor / Mutasi Kas
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-5 pt-5">
        
        {/* ── Target Omzet Progress Bar ── */}
        <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] md:text-xs font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Target size={13} className="text-primary" /> Target Penjualan Hari Ini
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg md:text-xl font-black text-slate-800 tabular-nums">{fmt(omzet)}</span>
                <span className="text-xs font-bold text-slate-400">/ {fmt(DAILY_TARGET)}</span>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-xs md:text-sm font-black px-2.5 py-1 rounded-full ${omzetPct >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'}`}>
                {omzetPct}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-primary via-rose-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${omzetPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>{data?.orderCount ?? 0} Transaksi Terproses</span>
            <span>{omzet >= DAILY_TARGET ? "Target Tercapai" : `Sisa Target: ${fmt(DAILY_TARGET - omzet)}`}</span>
          </div>
        </div>

        {/* ── 4 Sektor ERP Quick Filter Tabs ── */}
        <div className="flex bg-slate-200/60 p-1.5 rounded-2xl gap-1 overflow-x-auto hide-scrollbar">
          {[
            { id: "all", label: "Semua Fitur", icon: BarChart3 },
            { id: "penjualan", label: "Penjualan", icon: ShoppingCart },
            { id: "keuangan", label: "Keuangan", icon: Banknote },
            { id: "produksi", label: "Stok & Produksi", icon: Package },
            { id: "sdm", label: "SDM", icon: Users },
          ].map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSector === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSector(sec.id as any)}
                className={`flex-1 min-w-[95px] py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  isActive ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon size={13} className={isActive ? "text-primary" : "text-slate-400"} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── ERP Apps Grid ── */}
        <div className="space-y-4">
          {/* SEKTOR 1: PENJUALAN */}
          {(activeSector === "all" || activeSector === "penjualan") && (
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-3">
              <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShoppingCart size={13} className="text-primary" /> Sektor Penjualan & Kasir
              </h2>
              <div className="grid grid-cols-4 gap-2 md:gap-3">
                <Link href="/manager/pos" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shadow-sm">
                    <ShoppingCart size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Kasir POS</span>
                </Link>

                <Link href="/manager/orders" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform shadow-sm">
                    <ClipboardList size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Pesanan</span>
                </Link>

                <Link href="/manager/master-data?tab=pelanggan" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 group-hover:scale-105 transition-transform shadow-sm">
                    <Users size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Pelanggan</span>
                </Link>

                <Link href="/manager/omzet" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform shadow-sm">
                    <TrendingUp size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Omzet</span>
                </Link>
              </div>
            </div>
          )}

          {/* SEKTOR 2: KEUANGAN & P&L */}
          {(activeSector === "all" || activeSector === "keuangan") && (
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-3">
              <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Banknote size={13} className="text-emerald-600" /> Sektor Keuangan & P&L
              </h2>
              <div className="grid grid-cols-4 gap-2 md:gap-3">
                <Link href="/manager/reports" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform shadow-sm">
                    <FileText size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Laporan P&L</span>
                </Link>

                <Link href="/manager/expenses" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform shadow-sm">
                    <Banknote size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Buku Kas</span>
                </Link>

                <Link href="/manager/purchases" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform shadow-sm">
                    <Package size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Belanja</span>
                </Link>

                <Link href="/manager/reports?tab=cashflow" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 group-hover:scale-105 transition-transform shadow-sm">
                    <ArrowLeftRight size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Arus Kas</span>
                </Link>
              </div>
            </div>
          )}

          {/* SEKTOR 3: PRODUKSI, BOM & STOK */}
          {(activeSector === "all" || activeSector === "produksi") && (
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-3">
              <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package size={13} className="text-teal-600" /> Sektor Produksi, BOM & Gudang
              </h2>
              <div className="grid grid-cols-4 gap-2 md:gap-3">
                <Link href="/manager/inventory" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 group-hover:scale-105 transition-transform shadow-sm">
                    <Package size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Inventori</span>
                </Link>

                <Link href="/manager/inventory/stock-opname" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform shadow-sm">
                    <ClipboardList size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Stock Opname</span>
                </Link>

                <Link href="/manager/bom" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 group-hover:scale-105 transition-transform shadow-sm">
                    <BookOpen size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">BOM & Resep</span>
                </Link>

                <Link href="/manager/productions" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 group-hover:scale-105 transition-transform shadow-sm">
                    <ChefHat size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Produksi</span>
                </Link>

                <Link href="/manager/pre-packing" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform shadow-sm">
                    <Layers size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Pre-Packing</span>
                </Link>

                <Link href="/manager/packing" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 group-hover:scale-105 transition-transform shadow-sm">
                    <Package size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Packing Kirim</span>
                </Link>
              </div>
            </div>
          )}

          {/* SEKTOR 4: SDM & KARYAWAN */}
          {(activeSector === "all" || activeSector === "sdm") && (
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-3">
              <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users size={13} className="text-purple-600" /> Sektor SDM & Operasional
              </h2>
              <div className="grid grid-cols-4 gap-2 md:gap-3">
                <Link href="/manager/employees" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform shadow-sm">
                    <Users size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Karyawan</span>
                </Link>

                <Link href="/manager/tasks" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform shadow-sm">
                    <ClipboardList size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Beri Tugas</span>
                </Link>

                <Link href="/manager/master-data" className="flex flex-col items-center group">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 group-hover:scale-105 transition-transform shadow-sm">
                    <Database size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 text-center mt-1.5">Master Data</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Executive ERP KPI Widgets ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Executive Widget: Ringkasan Hari Ini */}
          <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-slate-600" /> Ringkasan Finansial Hari Ini
              </h3>
              <Link href="/manager/reports" className="text-xs font-bold text-primary flex items-center gap-0.5 hover:underline">
                P&L Detail <ChevronRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Omzet Kotor</span>
                <p className="text-base font-extrabold text-slate-800 mt-0.5">{fmt(data?.omzet ?? 0)}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Estimasi HPP</span>
                <p className="text-base font-extrabold text-rose-600 mt-0.5">{fmt(data?.hpp ?? 0)}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Biaya Operasional</span>
                <p className="text-base font-extrabold text-amber-600 mt-0.5">{fmt(data?.operationalExpenses ?? 0)}</p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <span className="text-[11px] font-bold text-emerald-700 uppercase">Estimasi Laba Bersih</span>
                <p className="text-base font-extrabold text-emerald-700 mt-0.5">{fmt(data?.profit ?? 0)}</p>
              </div>
            </div>
          </div>

          {/* Executive Widget: Low Stock Warnings */}
          <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Peringatan Stok Menipis ({data?.lowStockItems?.length ?? 0})
              </h3>
              <Link href="/manager/inventory" className="text-xs font-bold text-primary flex items-center gap-0.5 hover:underline">
                Cek Gudang <ChevronRight size={14} />
              </Link>
            </div>

            {!data?.lowStockItems?.length ? (
              <div className="py-6 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-1.5">
                <ShieldCheck size={16} className="text-emerald-500" /> Semua stok bahan baku & kemasan dalam batas aman.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {data.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-rose-50/60 border border-rose-100 text-xs">
                    <span className="font-bold text-slate-800 truncate">{item.name}</span>
                    <span className="font-black text-rose-600 bg-white px-2 py-0.5 rounded-lg border border-rose-200">
                      {item.currentStock} / {item.minStock} {item.baseUnit}
                    </span>
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
