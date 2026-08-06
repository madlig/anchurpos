"use client";

import { ArrowUpRight, ArrowDownRight, Wallet, Building2, ShoppingCart, Package, ArrowLeftRight, Users } from "lucide-react";

export interface FeedItem {
  id: string;
  time: string;
  type: "sales" | "expense" | "income" | "purchase" | "transfer" | "payroll";
  description: string;
  account: "cash" | "bank";
  amount: number; // signed: positive=in, negative=out
  notes?: string;
}

export interface CashFeedProps {
  items: FeedItem[];
  loading?: boolean;
  maxDisplay?: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n));
}

function timeOnly(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const TYPE_CONFIG: Record<string, { icon: typeof ArrowUpRight; label: string; inColor: string; outColor: string }> = {
  sales:    { icon: ShoppingCart,    label: "Penjualan",   inColor: "text-emerald-600 bg-emerald-50 border-emerald-200", outColor: "" },
  expense:  { icon: ArrowDownRight,  label: "Pengeluaran", inColor: "", outColor: "text-rose-600 bg-rose-50 border-rose-200" },
  income:   { icon: ArrowUpRight,    label: "Pemasukan",   inColor: "text-emerald-600 bg-emerald-50 border-emerald-200", outColor: "" },
  purchase: { icon: Package,         label: "Belanja",     inColor: "", outColor: "text-orange-600 bg-orange-50 border-orange-200" },
  transfer: { icon: ArrowLeftRight,  label: "Mutasi",      inColor: "text-blue-600 bg-blue-50 border-blue-200", outColor: "text-blue-600 bg-blue-50 border-blue-200" },
  payroll:  { icon: Users,           label: "Payroll",     inColor: "", outColor: "text-purple-600 bg-purple-50 border-purple-200" },
};

/** Chronological cash-in/cash-out feed for the owner dashboard. */
export function CashFeed({ items, loading, maxDisplay = 8 }: CashFeedProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Arus Kas Hari Ini</h2>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-9 w-9 rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-slate-100 rounded w-3/4" />
              <div className="h-2 bg-slate-50 rounded w-1/2" />
            </div>
            <div className="h-4 w-20 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const display = items.slice(0, maxDisplay);

  return (
    <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          💸 Arus Kas Hari Ini
        </h2>
        <span className="text-[10px] font-bold text-slate-400">
          {items.length} transaksi
        </span>
      </div>

      {display.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-xs font-medium text-slate-400">Belum ada transaksi tercatat hari ini.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {display.map((item) => {
            const isIn = item.amount > 0;
            const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.expense;
            const Icon = isIn ? ArrowUpRight : ArrowDownRight;
            const wrapperColor = isIn ? config.inColor || "text-emerald-600 bg-emerald-50 border-emerald-200" : config.outColor || "text-rose-600 bg-rose-50 border-rose-200";

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all"
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${wrapperColor}`}>
                  <Icon size={16} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-extrabold text-slate-800 truncate">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-semibold text-slate-400">{timeOnly(item.time)}</span>
                    <span className="text-[10px] text-slate-300">•</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                      item.account === "cash"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {item.account === "cash" ? "Cash" : "Bank"}
                    </span>
                    {item.notes && (
                      <>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] text-slate-400 italic truncate">{item.notes}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <span className={`text-xs font-black tabular-nums shrink-0 ${
                  isIn ? "text-emerald-600" : "text-rose-600"
                }`}>
                  {isIn ? "+" : "-"}{fmt(item.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {items.length > maxDisplay && (
        <div className="text-center pt-3">
          <p className="text-[10px] font-bold text-slate-400">
            + {items.length - maxDisplay} transaksi lainnya hari ini
          </p>
        </div>
      )}
    </div>
  );
}
