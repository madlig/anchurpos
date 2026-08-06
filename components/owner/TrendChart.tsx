"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

export interface TrendDataPoint {
  month: string;       // YYYY-MM
  label: string;       // "Agu 26"
  pemasukan: number;
  hppProduk: number;
  labaKotor: number;
  biayaOperasional: number;
  biayaPromosi: number;
  gajiBonus: number;
  labaBersih: number;
}

export interface TrendChartProps {
  data: TrendDataPoint[];
  loading?: boolean;
  /** Which month key is currently active (for highlighting). */
  activeMonth?: string;
}

function fmtRp(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`;
  return `Rp ${Math.round(n)}`;
}

// Custom tooltip so owner sees clean rupiah, not scientific notation
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 text-xs space-y-1.5 min-w-[180px]">
      <p className="font-extrabold text-slate-800 text-sm">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="font-semibold text-slate-600 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-black tabular-nums text-slate-800">{fmtRp(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** 6-month P&L trend area chart for owner dashboard. */
export function TrendChart({ data, loading }: TrendChartProps) {
  const hasData = data && data.length > 0 && data.some((d) => d.pemasukan > 0 || d.labaBersih !== 0);

  // Determine a nice Y-axis domain
  const yDomain = useMemo(() => {
    if (!data || data.length === 0) return [0, 1_000_000];
    const allVals = data.flatMap((d) => [d.pemasukan, d.labaKotor, Math.abs(d.labaBersih)]);
    const maxVal = Math.max(...allVals, 100_000);
    // Round up to next "nice" number
    const nice = Math.ceil(maxVal / 500_000) * 500_000;
    return [0, nice || 1_000_000];
  }, [data]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 h-[280px] animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-40 mb-4" />
        <div className="h-full bg-slate-100 rounded" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 h-[280px] flex items-center justify-center">
        <p className="text-xs text-slate-400 font-medium">Belum cukup data untuk menampilkan tren.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            📈 Tren P&L 6 Bulan
          </h2>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Pemasukan vs Laba Bersih per bulan</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gradPemasukan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradLaba" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtRp}
            tick={{ fontSize: 9, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            domain={yDomain}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 10, fontWeight: 700 }}
          />
          <Area
            type="monotone"
            dataKey="pemasukan"
            name="Pemasukan"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#gradPemasukan)"
          />
          <Area
            type="monotone"
            dataKey="labaBersih"
            name="Laba Bersih"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#gradLaba)"
          />
          <Area
            type="monotone"
            dataKey="hppProduk"
            name="HPP"
            stroke="#f43f5e"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            fill="none"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
