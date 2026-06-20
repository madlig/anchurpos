"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { transactions, REVENUE_SERIES } from "@/lib/mock-data";
import { formatRupiah, formatRupiahCompact, formatShortDate } from "@/lib/utils";
import { Download, ChevronRight, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Period = "today" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hari Ini",
  week: "Minggu Ini",
  month: "Bulan Ini",
};

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("week");

  const filtered = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      if (tx.voided) return false;
      const d = new Date(tx.date);
      if (period === "today") {
        return d.toDateString() === now.toDateString();
      } else if (period === "week") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      } else {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return d >= monthAgo;
      }
    });
  }, [period]);

  const revenue = filtered.reduce((s, tx) => s + tx.totalPrice, 0);
  const hpp = filtered.reduce((s, tx) => s + tx.totalCost, 0);
  const profit = filtered.reduce((s, tx) => s + tx.profit, 0);

  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <Header
        title="Laporan"
        action={
          <Button variant="outline" size="sm" className="gap-1.5 border-stone-200 text-stone-600">
            <Download size={14} /> Export
          </Button>
        }
      />
      <PageWrapper>
        {/* Period selector */}
        <div className="mt-1 mb-4 bg-stone-100 p-1 rounded-xl flex">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${
                period === p ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              }`}
            >
              {p === "today" ? "Hari Ini" : p === "week" ? "Minggu" : "Bulan"}
            </button>
          ))}
        </div>

        {/* Desktop page title */}
        <div className="hidden lg:flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Laporan</h2>
            <p className="text-sm text-stone-500">{PERIOD_LABELS[period]}</p>
          </div>
          <Button variant="outline" className="gap-1.5 border-stone-200">
            <Download size={14} /> Export CSV
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">Revenue</p>
            <p className="font-mono text-base font-bold text-stone-900 mt-1">{formatRupiahCompact(revenue)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">HPP</p>
            <p className="font-mono text-base font-bold text-stone-900 mt-1">{formatRupiahCompact(hpp)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">Profit</p>
            <p className="font-mono text-base font-bold text-emerald-700 mt-1">{formatRupiahCompact(profit)}</p>
          </Card>
        </div>

        {/* Bar chart */}
        <Card className="mb-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-stone-900">Revenue harian</p>
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <TrendingUp size={12} /> 7 hari terakhir
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={REVENUE_SERIES} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#78716c" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#78716c" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v / 1000}k`}
              />
              <Tooltip
                formatter={(v: number) => [formatRupiah(v), "Revenue"]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 12,
                  border: "1px solid #e7e5e4",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                }}
                cursor={{ fill: "#f5f5f4" }}
              />
              <Bar dataKey="revenue" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Transaction list */}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-stone-900">Semua Transaksi</p>
          <span className="text-xs text-stone-500">{sorted.length} transaksi</span>
        </div>
        <Card className="divide-y divide-stone-100">
          {sorted.map((tx) => (
            <Link
              key={tx.id}
              href={`/reports/${tx.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-stone-900">Churros Pack</span>
                  {tx.voided && <Badge variant="destructive" className="text-[10px]">Void</Badge>}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{formatShortDate(tx.date)} · {tx.qty} pack</p>
              </div>
              <div className="text-right">
                <p className={`font-mono text-sm font-semibold ${tx.voided ? "text-stone-400 line-through" : "text-stone-900"}`}>
                  {formatRupiah(tx.totalPrice)}
                </p>
                {!tx.voided && (
                  <p className="text-xs text-emerald-600">+{formatRupiahCompact(tx.profit)}</p>
                )}
              </div>
              <ChevronRight size={14} className="text-stone-400 shrink-0" />
            </Link>
          ))}
        </Card>
      </PageWrapper>
    </>
  );
}
