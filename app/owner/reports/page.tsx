"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, FileText } from "lucide-react";

interface PnlData {
  month: string; pemasukan: number; hppProduk: number; labaKotor: number;
  biayaOperasional: number; biayaPromosi: number; gajiBonus: number; labaBersih: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function OwnerReportsPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchWithAuth = useCallback(async (url: string) => {
    const token = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [getToken]);

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/reports/pnl?month=${month}`).then((r) => r.json()).then((d) => setData(d)).finally(() => setLoading(false));
  }, [month, fetchWithAuth]);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  function formatMonth(m: string) {
    const [y, mo] = m.split("-").map(Number);
    return `${MONTH_NAMES[mo - 1]} ${y}`;
  }

  return (
    <div className="px-5 pt-6 pb-4 md:px-8 md:pt-8 page-enter">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "#FEF1F5" }}>
          <FileText size={16} style={{ color: "#E85D8C" }} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#1C1C1E" }}>Laporan Laba Rugi</h1>
        </div>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between mb-6 rounded-2xl p-3" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
        <button onClick={() => shiftMonth(-1)} className="h-9 w-9 rounded-xl flex items-center justify-center tap-target" style={{ background: "#F1F5F9" }} data-testid="prev-month">
          <ChevronLeft size={18} style={{ color: "#334155" }} />
        </button>
        <span className="text-sm font-bold" style={{ color: "#1C1C1E" }}>{formatMonth(month)}</span>
        <button onClick={() => shiftMonth(1)} className="h-9 w-9 rounded-xl flex items-center justify-center tap-target" style={{ background: "#F1F5F9" }} data-testid="next-month">
          <ChevronRight size={18} style={{ color: "#334155" }} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} /></div>
      ) : data ? (
        <div className="space-y-3">
          {/* Hero pemasukan */}
          <div className="relative rounded-3xl p-6 overflow-hidden" style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)", boxShadow: "0 8px 24px rgba(232,93,140,0.25)" }} data-testid="pemasukan-card">
            <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>Pemasukan</p>
            <p className="text-3xl font-extrabold tabular-nums text-white mt-1" data-testid="pemasukan-value">{fmt(data.pemasukan)}</p>
          </div>

          <PnlRow label="HPP Produk" value={data.hppProduk} negative />

          {/* Laba kotor */}
          <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: data.labaKotor >= 0 ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${data.labaKotor >= 0 ? "#BBF7D0" : "#FECACA"}` }}>
            <span className="text-sm font-bold" style={{ color: data.labaKotor >= 0 ? "#166534" : "#991B1B" }}>Laba Kotor</span>
            <div className="flex items-center gap-1.5">
              {data.labaKotor > 0 ? <TrendingUp size={15} style={{ color: "#16A34A" }} /> : data.labaKotor < 0 ? <TrendingDown size={15} style={{ color: "#DC2626" }} /> : <Minus size={15} style={{ color: "#94A3B8" }} />}
              <span className="text-sm font-extrabold tabular-nums" style={{ color: data.labaKotor >= 0 ? "#16A34A" : "#DC2626" }}>{fmt(data.labaKotor)}</span>
            </div>
          </div>

          {/* Pengeluaran */}
          <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#94A3B8" }}>Pengeluaran</p>
            <div className="space-y-0.5">
              <PnlRow label="Biaya Operasional" value={data.biayaOperasional} negative />
              <PnlRow label="Biaya Promosi / Adj. Stok" value={data.biayaPromosi} negative />
              <PnlRow label="Gaji & Bonus" value={data.gajiBonus} negative />
            </div>
          </div>

          {/* Laba bersih */}
          <div className="rounded-3xl p-5 flex items-center justify-between" style={{ background: data.labaBersih >= 0 ? "linear-gradient(135deg,#E85D8C,#C94A73)" : "linear-gradient(135deg,#EF4444,#DC2626)", boxShadow: "0 4px 16px rgba(232,93,140,0.2)" }} data-testid="laba-bersih-card">
            <span className="text-sm font-semibold text-white">Laba Bersih</span>
            <span className="text-xl font-extrabold tabular-nums text-white" data-testid="laba-bersih-value">{fmt(data.labaBersih)}</span>
          </div>

          {data.pemasukan > 0 && (
            <p className="text-xs text-center" style={{ color: "#94A3B8" }}>
              Margin bersih: <span className="font-bold" style={{ color: "#E85D8C" }}>{((data.labaBersih / data.pemasukan) * 100).toFixed(1)}%</span>
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed p-10 text-center" style={{ borderColor: "#E2E8F0" }}>
          <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Data tidak tersedia untuk bulan ini</p>
        </div>
      )}
    </div>
  );
}

function PnlRow({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 px-1">
      <span className="text-sm" style={{ color: "#64748B" }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: negative && value > 0 ? "#DC2626" : "#1C1C1E" }}>
        {negative && value > 0 ? "- " : ""}{fmt(value)}
      </span>
    </div>
  );
}
