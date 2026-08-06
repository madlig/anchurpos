"use client";

import { Wallet, Building2, Scale, RefreshCw } from "lucide-react";

export interface SaldoBarProps {
  saldoBukuCash: number;
  saldoBukuBank: number;
  loading?: boolean;
  onRefresh?: () => void;
  scope?: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " jt";
  if (abs >= 1_000) return "Rp " + Math.round(n / 1_000) + " rb";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

/** Sticky, always-visible owner saldo bar: Cash drawer + Bank + Net total. */
export function SaldoBar({ saldoBukuCash, saldoBukuBank, loading, onRefresh, scope }: SaldoBarProps) {
  const total = saldoBukuCash + saldoBukuBank;

  return (
    <div className="sticky top-0 z-30 bg-slate-900 text-white shadow-lg">
      <div className="px-4 md:px-8 py-3 max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          {/* Left: total */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Scale size={12} className="text-emerald-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Saldo</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl md:text-2xl font-black tabular-nums truncate">{fmt(total)}</span>
              {loading && <RefreshCw size={12} className="animate-spin text-slate-500 shrink-0" />}
            </div>
          </div>

          {/* Right: cash + bank chips */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-right">
              <div className="flex items-center gap-1 justify-end">
                <Wallet size={10} className="text-amber-400" />
                <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider">Cash</span>
              </div>
              <p className="text-xs font-black tabular-nums text-amber-100">{fmtCompact(saldoBukuCash)}</p>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right">
              <div className="flex items-center gap-1 justify-end">
                <Building2 size={10} className="text-emerald-400" />
                <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider">Bank</span>
              </div>
              <p className="text-xs font-black tabular-nums text-emerald-100">{fmtCompact(saldoBukuBank)}</p>
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors shrink-0"
                aria-label="Refresh saldo"
              >
                <RefreshCw size={14} className={loading ? "animate-spin text-slate-400" : "text-slate-300"} />
              </button>
            )}
          </div>
        </div>
        {scope && (
          <p className="text-[9px] text-slate-500 font-medium mt-0.5">* {scope}</p>
        )}
      </div>
    </div>
  );
}
