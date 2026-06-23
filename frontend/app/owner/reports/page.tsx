"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PnlData {
  month: string;
  pemasukan: number;
  hppProduk: number;
  labaKotor: number;
  biayaOperasional: number;
  biayaPromosi: number;
  gajiBonus: number;
  labaBersih: number;
}

export default function OwnerReportsPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchWithAuth = useCallback(
    async (url: string) => {
      const token = await getToken();
      return fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    [getToken]
  );

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/reports/pnl?month=${month}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [month, fetchWithAuth]);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);
  }

  function formatMonth(m: string) {
    const [y, mo] = m.split("-").map(Number);
    const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${names[mo - 1]} ${y}`;
  }

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-1">Laporan Laba Rugi</h1>
      <p className="text-sm text-stone-500 mb-5">Profit & Loss per bulan</p>

      <div className="flex items-center justify-between mb-5">
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)}>
          <ChevronLeft size={18} />
        </Button>
        <span className="text-sm font-semibold text-stone-900">{formatMonth(month)}</span>
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)}>
          <ChevronRight size={18} />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : data ? (
        <div className="space-y-3">
          <Card className="p-4 bg-emerald-600 text-white">
            <p className="text-sm text-emerald-100">Pemasukan</p>
            <p className="text-2xl font-bold">{formatCurrency(data.pemasukan)}</p>
          </Card>

          <PnlRow label="HPP Produk" value={data.hppProduk} formatCurrency={formatCurrency} negative />
          <Card className="p-3 border-emerald-200 bg-emerald-50/50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-emerald-800">Laba Kotor</span>
              <div className="flex items-center gap-1">
                {data.labaKotor > 0 ? (
                  <TrendingUp size={14} className="text-emerald-600" />
                ) : data.labaKotor < 0 ? (
                  <TrendingDown size={14} className="text-red-600" />
                ) : (
                  <Minus size={14} className="text-stone-400" />
                )}
                <span className={`text-sm font-bold ${data.labaKotor >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {formatCurrency(data.labaKotor)}
                </span>
              </div>
            </div>
          </Card>

          <div className="border-t border-stone-100 pt-3">
            <p className="text-xs text-stone-400 mb-2 uppercase tracking-wide">Pengeluaran</p>
            <PnlRow label="Biaya Operasional" value={data.biayaOperasional} formatCurrency={formatCurrency} negative />
            <PnlRow label="Biaya Promosi / Adj. Stok" value={data.biayaPromosi} formatCurrency={formatCurrency} negative />
            <PnlRow label="Gaji & Bonus" value={data.gajiBonus} formatCurrency={formatCurrency} negative />
          </div>

          <Card className={`p-4 ${data.labaBersih >= 0 ? "bg-emerald-600" : "bg-red-600"} text-white`}>
            <div className="flex justify-between items-center">
              <span className="text-sm">Laba Bersih</span>
              <span className="text-xl font-bold">{formatCurrency(data.labaBersih)}</span>
            </div>
          </Card>

          {data.pemasukan > 0 && (
            <p className="text-xs text-center text-stone-400">
              Margin bersih: {((data.labaBersih / data.pemasukan) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-stone-400 py-10">Data tidak tersedia</p>
      )}
    </div>
  );
}

function PnlRow({
  label,
  value,
  formatCurrency,
  negative,
}: {
  label: string;
  value: number;
  formatCurrency: (n: number) => string;
  negative?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 px-1">
      <span className="text-sm text-stone-600">{label}</span>
      <span className={`text-sm font-medium ${negative && value > 0 ? "text-red-600" : "text-stone-900"}`}>
        {negative && value > 0 ? "- " : ""}
        {formatCurrency(value)}
      </span>
    </div>
  );
}
