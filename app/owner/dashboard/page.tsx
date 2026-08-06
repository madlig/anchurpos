"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
  CheckCircle, AlertTriangle, Package, ChefHat, RefreshCw, Bell,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

import { SaldoBar } from "@/components/owner/SaldoBar";
import { TrendChart, type TrendDataPoint } from "@/components/owner/TrendChart";
import { CashFeed, type FeedItem } from "@/components/owner/CashFeed";
import { QuickCashEntry } from "@/components/owner/QuickCashEntry";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " jt";
  if (abs >= 1_000) return "Rp " + Math.round(n / 1_000) + " rb";
  return "Rp " + Math.round(n);
}

/* ──────────────────────────────────────────────────────────────────── */

export default function OwnerDashboardPage() {
  const { getToken } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashModalType, setCashModalType] = useState<"expense" | "income">("expense");
  const hasMounted = useRef(false);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, trendRes] = await Promise.all([
        fetchWithAuth("/api/owner/overview"),
        fetchWithAuth("/api/reports/trend?months=6"),
      ]);
      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        setTrend(trendData.series ?? []);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  // Initial load
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-refresh when tab gains focus
  useEffect(() => {
    function onFocus() {
      if (hasMounted.current) loadAll();
      hasMounted.current = true;
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadAll]);

  // Post expense helper
  async function postExpense(body: Record<string, unknown>) {
    const res = await fetchWithAuth("/api/expenses", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error ?? "Gagal menyimpan" };
    }
    return { ok: true };
  }

  // ── Derived data ────────────────────────────────────────────────
  const pnl = overview?.pnl;
  const balances = overview?.balances;
  const approvals = overview?.approvals;
  const sfm = overview?.sfm;
  const lowStock = overview?.lowStockItems ?? [];

  // Smart insight: today vs yesterday trend
  const todayVsYesterday = pnl && pnl.yesterdayOmzet > 0
    ? Math.round(((pnl.omzet - pnl.yesterdayOmzet) / pnl.yesterdayOmzet) * 100)
    : null;

  const grossMargin = pnl && pnl.omzet > 0
    ? Math.round((pnl.labaKotor / pnl.omzet) * 100)
    : 0;

  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading && !overview) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <div className="h-16 bg-slate-900 animate-pulse" />
        <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-5 pt-5">
          <div className="h-48 bg-slate-200 rounded-3xl animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-slate-200 rounded-2xl animate-pulse" />
            <div className="h-20 bg-slate-200 rounded-2xl animate-pulse" />
          </div>
          <div className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
          <div className="h-40 bg-slate-200 rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24">
      {/* ── Sticky Saldo Bar ──────────────────────────────────────── */}
      <SaldoBar
        saldoBukuCash={balances?.saldoBukuCash ?? 0}
        saldoBukuBank={balances?.saldoBukuBank ?? 0}
        loading={loading}
        onRefresh={loadAll}
        scope={balances?.scope}
      />

      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-5 pt-4">
        {/* ── Header Row ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{todayLabel}</p>
            <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">Beranda Owner</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Alerts / Approvals mini-badge */}
            {approvals && approvals.total > 0 && (
              <Link href="/owner/approval" className="relative p-2.5 rounded-xl bg-amber-50 border border-amber-200 tap-target">
                <Bell size={16} className="text-amber-600" />
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center bg-rose-500">
                  {approvals.total > 9 ? "9+" : approvals.total}
                </span>
              </Link>
            )}
            {sfm && sfm.activeCount > 0 && (
              <Link href="/owner/sfm" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 tap-target">
                <ChefHat size={14} className="text-rose-600" />
                <span className="text-[10px] font-bold text-rose-700">{sfm.activeCount} WO</span>
              </Link>
            )}
          </div>
        </div>

        {/* ── P&L Hero Card ──────────────────────────────────────── */}
        <div className="rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 md:p-6 text-white shadow-xl shadow-slate-900/10 border border-slate-800 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl" />

          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-3">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <TrendingUp size={14} className="text-emerald-400" /> Omzet Hari Ini
              </span>
              <div className="text-2xl md:text-3xl font-black text-white mt-1 tabular-nums">
                {fmt(pnl?.omzet ?? 0)}
              </div>
            </div>
            <div className="text-right space-y-1">
              {todayVsYesterday !== null && (
                <div className={`flex items-center gap-1 text-xs font-bold ${todayVsYesterday >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {todayVsYesterday >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {todayVsYesterday >= 0 ? "+" : ""}{todayVsYesterday}% vs kemarin
                </div>
              )}
              <p className="text-[10px] font-semibold text-slate-400">{pnl?.orderCount ?? 0} pesanan</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-semibold text-slate-400 block">HPP</span>
              <span className="text-sm font-extrabold text-rose-400 tabular-nums block mt-0.5">-{fmt(pnl?.hpp ?? 0)}</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-semibold text-slate-400 block">Laba Kotor</span>
              <span className="text-sm font-extrabold text-emerald-400 tabular-nums block mt-0.5">{fmt(pnl?.labaKotor ?? 0)}</span>
              <span className="text-[9px] text-slate-500">Margin {grossMargin}%</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-semibold text-slate-400 block">SFM</span>
              <span className="text-sm font-extrabold text-white block mt-0.5">{sfm?.todayGoodPacks ?? 0} packs</span>
              <span className="text-[9px] text-slate-500">Yield {sfm?.todayYieldPct ?? 0}%</span>
            </div>
          </div>
        </div>

        {/* ── Quick-Entry Buttons ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setCashModalType("income"); setShowCashModal(true); }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 tap-target active:scale-[0.98] transition-all"
          >
            <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <ArrowUpCircle size={22} className="text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-extrabold">+ Pemasukan</p>
              <p className="text-[10px] font-medium text-emerald-600">Modal, refund, cashback</p>
            </div>
          </button>
          <button
            onClick={() => { setCashModalType("expense"); setShowCashModal(true); }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 tap-target active:scale-[0.98] transition-all"
          >
            <div className="h-11 w-11 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <ArrowDownCircle size={22} className="text-rose-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-extrabold">- Pengeluaran</p>
              <p className="text-[10px] font-medium text-rose-600">Operasional, belanja</p>
            </div>
          </button>
        </div>

        {/* ── Trend Chart ─────────────────────────────────────────── */}
        <TrendChart data={trend} loading={loading} />

        {/* ── Smart Insights ──────────────────────────────────────── */}
        {(lowStock.length > 0 || (sfm?.stuckCount ?? 0) > 0 || (approvals?.total ?? 0) > 0) && (
          <div className="space-y-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">Insight Cepat</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {lowStock.length > 0 && (
                <Link href="/owner/inventory" className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 tap-target active:scale-[0.98] transition-all">
                  <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle size={16} className="text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-amber-900">Stok Menipis</p>
                    <p className="text-[10px] text-amber-700 truncate">
                      {lowStock.length} bahan baku di bawah minimum ({lowStock.slice(0, 2).map((i: any) => i.name).join(", ")}{lowStock.length > 2 ? "..." : ""})
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-amber-400 shrink-0" />
                </Link>
              )}
              {(sfm?.stuckCount ?? 0) > 0 && (
                <Link href="/owner/sfm" className="flex items-center gap-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 tap-target active:scale-[0.98] transition-all">
                  <div className="h-9 w-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                    <AlertTriangle size={16} className="text-rose-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-rose-900">WO Stuck</p>
                    <p className="text-[10px] text-rose-700">
                      {sfm.stuckCount} work order stuck &gt; 3.5 jam, perlu perhatian
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-rose-400 shrink-0" />
                </Link>
              )}
              {(approvals?.total ?? 0) > 0 && (
                <Link href="/owner/approval" className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 tap-target active:scale-[0.98] transition-all">
                  <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <CheckCircle size={16} className="text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-blue-900">Approval Pending</p>
                    <p className="text-[10px] text-blue-700">
                      {approvals.opnamePending} opname, {approvals.attendancePending} absensi, {approvals.payrollPending} payroll
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-blue-400 shrink-0" />
                </Link>
              )}
              {pnl && pnl.labaKotor > 0 && grossMargin >= 50 && (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <TrendingUp size={16} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-emerald-900">Margin Kotor Sehat</p>
                    <p className="text-[10px] text-emerald-700">Hari ini {grossMargin}% — di atas target 50%</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Cash Feed ───────────────────────────────────────────── */}
        <CashFeed
          items={(overview?.todayFeed ?? []) as FeedItem[]}
          loading={loading}
        />

        {/* ── Active SFM Mini ─────────────────────────────────────── */}
        {sfm && sfm.activeCount > 0 && (
          <Link href="/owner/sfm" className="block bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm p-4 md:p-5 tap-target active:scale-[0.99] transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <ChefHat size={16} className="text-primary" />
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Produksi Aktif
                </h2>
              </div>
              <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200">
                {sfm.activeCount} WO berjalan
              </span>
            </div>
            <div className="space-y-2">
              {(sfm.activeWorkOrders ?? []).slice(0, 3).map((wo: any) => (
                <div key={wo.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${wo.stuck ? "bg-rose-500 animate-pulse" : "bg-emerald-400"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-800 truncate">{wo.woNumber}</p>
                      <p className="text-[10px] text-slate-400">{wo.productName} • {wo.assignedCrewName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden sm:block w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${wo.progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">{wo.currentStage?.replace(/_/g, " ")}</span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          </Link>
        )}

        {/* ── Quick Links ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link href="/owner/reports" className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center tap-target active:scale-[0.98] transition-all">
            <p className="text-xs font-extrabold text-slate-800">📊 Laporan P&L</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Detail keuangan bulanan</p>
          </Link>
          <Link href="/owner/omzet" className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center tap-target active:scale-[0.98] transition-all">
            <p className="text-xs font-extrabold text-slate-800">📈 Analisis Omzet</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Channel & pembayaran</p>
          </Link>
          <Link href="/owner/orders" className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center tap-target active:scale-[0.98] transition-all">
            <p className="text-xs font-extrabold text-slate-800">🛒 Riwayat Order</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Semua pesanan</p>
          </Link>
          <Link href="/owner/stock-history" className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-center tap-target active:scale-[0.98] transition-all">
            <p className="text-xs font-extrabold text-slate-800">📦 Audit Stok</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Buku stok & pergerakan</p>
          </Link>
        </div>
      </div>

      {/* ── Quick Cash Entry Modal ───────────────────────────────── */}
      {showCashModal && (
        <QuickCashEntry
          initialType={cashModalType}
          postExpense={postExpense}
          onSaved={loadAll}
          onClose={() => setShowCashModal(false)}
        />
      )}
    </div>
  );
}
