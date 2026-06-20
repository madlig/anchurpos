"use client";
import { useMemo } from "react";
import Link from "next/link";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { TransactionItem } from "@/components/shared/TransactionItem";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { transactions, materials, productions, products } from "@/lib/mock-data";
import { formatRupiah, formatRupiahCompact, formatShortDate } from "@/lib/utils";
import { TrendingUp, Flame, Sparkles, Zap, Factory, BarChart3, Box, AlertTriangle, ChevronRight, Calendar, Download } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const SparkPath = ({ data }: { data: number[] }) => {
  if (!data.length) return null;
  const w = 320, h = 48, pad = 4;
  const max = Math.max(...data, 1);
  const xs = data.map((_, i) => pad + (i * (w - pad * 2)) / (data.length - 1));
  const ys = data.map(v => h - pad - (v / max) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const fill = `${d} L${xs[xs.length - 1]},${h} L${xs[0]},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
      <path d={fill} fill="rgba(255,255,255,0.15)" />
      <path d={d} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3.5" fill="#fff" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
    </svg>
  );
};

export default function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTx = useMemo(
    () => transactions.filter(tx => !tx.voided && isSameDay(new Date(new Date(tx.date).setHours(0,0,0,0)), today)),
    []
  );

  const revenue = todayTx.reduce((s, tx) => s + tx.totalPrice, 0);
  const cost = todayTx.reduce((s, tx) => s + tx.totalCost, 0);
  const profit = todayTx.reduce((s, tx) => s + tx.profit, 0);
  const txCount = todayTx.length;
  const packsSold = todayTx.reduce((s, tx) => s + tx.qty, 0);
  const margin = revenue ? Math.round((profit / revenue) * 100) : 0;

  const lowStock = materials.filter(m => m.stock < m.lowStockThreshold);
  const product = products[0];

  const revenueSeries = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      const tx = transactions.filter(t => !t.voided && isSameDay(new Date(new Date(t.date).setHours(0,0,0,0)), d));
      return {
        label: ["Min","Sen","Sel","Rab","Kam","Jum","Sab"][d.getDay()],
        revenue: tx.reduce((s, t) => s + t.totalPrice, 0),
        profit: tx.reduce((s, t) => s + t.profit, 0),
        highlight: i === 6,
      };
    });
  }, []);

  const sparkData = revenueSeries.map(d => d.revenue);
  const recentTx = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4);
  const todayProducedPacks = productions.filter(p => isSameDay(new Date(new Date(p.date).setHours(0,0,0,0)), today)).reduce((s, p) => s + p.packCount, 0);
  const todayLabel = today.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="lg:hidden">
        {/* Greeting */}
        <div className="px-5 pt-4 pb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm shadow-emerald-600/30">A</div>
          <div className="flex-1">
            <p className="text-xs text-stone-500">Halo, Rina 👋</p>
            <p className="text-sm font-semibold text-stone-900">{todayLabel}</p>
          </div>
          <button className="h-10 w-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600">
            <AlertTriangle className="h-4.5 w-4.5" size={18} />
          </button>
        </div>

        {/* Hero revenue card */}
        <div className="mx-5 rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-5 shadow-lg shadow-emerald-600/20 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute right-12 top-6 h-20 w-20 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center gap-2 text-emerald-100 text-xs font-semibold uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse inline-block" />
              Pendapatan Hari Ini
            </div>
            <div className="mt-1 font-mono text-3xl font-bold tracking-tight">{formatRupiah(revenue)}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-emerald-100">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{txCount} transaksi · {packsSold} pack terjual</span>
            </div>
            <div className="mt-4">
              <SparkPath data={sparkData} />
            </div>
          </div>
        </div>

        {/* HPP / Profit */}
        <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
              <Flame className="h-3.5 w-3.5 text-amber-600" /> HPP
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-stone-900">{formatRupiahCompact(cost)}</div>
            <div className="text-xs text-stone-500 mt-0.5">{100 - margin}% dari omzet</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Profit
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-emerald-700">{formatRupiahCompact(profit)}</div>
            <div className="text-xs text-emerald-600 mt-0.5">margin {margin}%</div>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="mx-5 mt-5 grid grid-cols-3 gap-3">
          <Link href="/pos" className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white border border-stone-200 active:scale-95">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Zap size={18} />
            </div>
            <span className="text-xs font-medium text-stone-700">Jualan</span>
          </Link>
          <Link href="/production/new" className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white border border-stone-200 active:scale-95">
            <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Factory size={18} />
            </div>
            <span className="text-xs font-medium text-stone-700">Batch baru</span>
          </Link>
          <Link href="/reports" className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white border border-stone-200 active:scale-95">
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <BarChart3 size={18} />
            </div>
            <span className="text-xs font-medium text-stone-700">Laporan</span>
          </Link>
        </div>

        {/* Stock summary */}
        <div className="mx-5 mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-stone-900">Stok cepat</h3>
            <Link href="/inventory" className="text-xs text-emerald-700 font-medium">Lihat semua →</Link>
          </div>
          <Card className="divide-y divide-stone-100">
            <div className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Box size={18} className="text-emerald-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-900">Churros Pack siap jual</p>
                <p className="text-xs text-stone-500">{todayProducedPacks} pack diproduksi hari ini</p>
              </div>
              <div className="font-mono text-xl font-bold text-stone-900">{product.stock}</div>
            </div>
            {lowStock.length > 0 && (
              <Link href="/inventory" className="p-4 flex items-center gap-3 bg-amber-50/40 block">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-amber-700" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">{lowStock.length} bahan menipis</p>
                  <p className="text-xs text-amber-700">{lowStock.map(m => m.name).join(", ")}</p>
                </div>
                <ChevronRight size={18} className="text-amber-600" />
              </Link>
            )}
          </Card>
        </div>

        {/* Recent tx */}
        <div className="mx-5 mt-5 pb-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-stone-900">Transaksi terakhir</h3>
            <Link href="/reports" className="text-xs text-emerald-700 font-medium">Semua →</Link>
          </div>
          <Card className="divide-y divide-stone-100">
            {recentTx.map(t => (
              <Link key={t.id} href={`/reports/${t.id}`} className="p-3.5 flex items-center gap-3 hover:bg-stone-50 transition-colors block">
                <div className="h-9 w-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 text-xs font-mono font-semibold shrink-0">{t.qty}×</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">Churros Pack</p>
                  <p className="text-xs text-stone-500">{formatShortDate(t.date)} · {t.id}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-semibold text-stone-900">{formatRupiah(t.totalPrice)}</p>
                  <p className="text-xs text-emerald-600">+{formatRupiahCompact(t.profit)}</p>
                </div>
              </Link>
            ))}
          </Card>
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden lg:block p-6 space-y-5">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Halo, Rina 👋</h2>
            <p className="text-sm text-stone-500">{todayLabel}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 border-stone-200">
              <Calendar size={14} /> Hari ini
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 border-stone-200">
              <Download size={14} /> Export
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          {/* Revenue hero */}
          <Card className="p-5 col-span-2 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white relative overflow-hidden border-0">
            <div className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100 uppercase tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse inline-block" /> Pendapatan Hari Ini
              </div>
              <p className="font-mono text-4xl font-bold mt-1.5">{formatRupiah(revenue)}</p>
              <p className="text-sm text-emerald-100 mt-1 flex items-center gap-1.5">
                <TrendingUp size={14} /> {txCount} transaksi · {packsSold} pack
              </p>
              <div className="mt-4">
                <SparkPath data={sparkData} />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">HPP Hari Ini</p>
              <Flame size={16} className="text-amber-600" />
            </div>
            <p className="font-mono text-2xl font-bold text-stone-900 mt-2">{formatRupiah(cost)}</p>
            <p className="text-xs text-stone-500 mt-1">{100 - margin}% dari omzet</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Profit</p>
              <Sparkles size={16} className="text-emerald-600" />
            </div>
            <p className="font-mono text-2xl font-bold text-emerald-700 mt-2">{formatRupiah(profit)}</p>
            <p className="text-xs text-emerald-600 mt-1">margin {margin}%</p>
          </Card>
        </div>

        {/* Chart + Low stock */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-5 col-span-2">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-semibold text-stone-900">Omzet 7 hari terakhir</h3>
              <span className="text-xs text-stone-500">total {formatRupiah(revenueSeries.reduce((s, d) => s + d.revenue, 0))}</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueSeries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0ede8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
                <Tooltip formatter={(v: number) => formatRupiah(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }} />
                <Bar dataKey="revenue" radius={[4,4,0,0]} name="Revenue" fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-600" /> Bahan menipis
            </h3>
            {lowStock.length === 0
              ? <p className="text-sm text-stone-400">Semua bahan aman ✓</p>
              : <div className="space-y-2">
                  {lowStock.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50">
                      <div>
                        <p className="text-sm font-medium text-amber-900">{m.name}</p>
                        <p className="text-xs text-amber-700">min {m.lowStockThreshold} {m.unit}</p>
                      </div>
                      <p className="font-mono text-sm font-bold text-amber-900">{m.stock.toLocaleString("id-ID")} {m.unit}</p>
                    </div>
                  ))}
                </div>
            }
          </Card>
        </div>

        {/* Recent transactions table */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-stone-900">Transaksi terakhir</h3>
            <Link href="/reports" className="text-xs text-emerald-700 font-semibold">Lihat semua →</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-500 uppercase tracking-wide">
                <th className="text-left font-semibold py-2">ID</th>
                <th className="text-left font-semibold">Waktu</th>
                <th className="text-left font-semibold">Produk</th>
                <th className="text-right font-semibold">Qty</th>
                <th className="text-right font-semibold">Total</th>
                <th className="text-right font-semibold">Profit</th>
                <th className="text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {[...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6).map(t => (
                <tr key={t.id} className="hover:bg-stone-50 cursor-pointer">
                  <td className="py-2.5 font-mono text-xs text-stone-600">{t.id}</td>
                  <td className="text-stone-700">{formatShortDate(t.date)}</td>
                  <td className="text-stone-900 font-medium">Churros Pack</td>
                  <td className="text-right font-mono">{t.qty}</td>
                  <td className={`text-right font-mono ${t.voided ? "line-through text-stone-400" : "text-stone-900"}`}>{formatRupiah(t.totalPrice)}</td>
                  <td className={`text-right font-mono ${t.voided ? "text-stone-400" : "text-emerald-700"}`}>{t.voided ? "–" : `+${formatRupiahCompact(t.profit)}`}</td>
                  <td className="text-right">{t.voided ? <Badge variant="destructive">Void</Badge> : <Badge variant="success">Lunas</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
