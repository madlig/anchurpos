"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, FileText, X } from "lucide-react";

interface PnlData {
  month: string; pemasukan: number; hppProduk: number; labaKotor: number;
  biayaOperasional: number; biayaPromosi: number; gajiBonus: number; labaBersih: number;
  totalCashIn?: number; totalCashOut?: number;
  totalBankIn?: number; totalBankOut?: number;
  mutasiCashToBank?: number; mutasiBankToCash?: number;
  saldoBukuCash?: number; saldoBukuBank?: number;
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

  // Cash Flow & Transfer States
  const [activeSubTab, setActiveSubTab] = useState<"pnl" | "cashflow">("pnl");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferFrom, setTransferFrom] = useState<"cash" | "bank">("cash");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/reports/pnl?month=${month}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month, fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleTransferSubmit() {
    setTransferError("");
    const amountNum = parseInt(transferAmount);
    if (!amountNum || amountNum <= 0) {
      setTransferError("Nominal transfer harus lebih dari 0");
      return;
    }
    setTransferSubmitting(true);
    try {
      const toVal = transferFrom === "cash" ? "bank" : "cash";
      const res = await fetchWithAuth("/api/cash-transfers", {
        method: "POST",
        body: JSON.stringify({
          amount: amountNum,
          from: transferFrom,
          to: toVal,
          notes: transferNotes.trim() || undefined,
          customDate: transferDate || undefined,
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setTransferError(resData.error ?? "Gagal memproses mutasi kas");
        return;
      }
      setShowTransferModal(false);
      setTransferAmount("");
      setTransferNotes("");
      setTransferDate("");
      await loadData();
    } catch {
      setTransferError("Gagal menghubungi server");
    } finally {
      setTransferSubmitting(false);
    }
  }

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
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "#FEF1F5" }}>
            <FileText size={16} style={{ color: "#E85D8C" }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#1C1C1E" }}>Laporan</h1>
        </div>

        <button
          onClick={() => {
            setTransferDate(new Date().toISOString().split("T")[0]);
            setShowTransferModal(true);
          }}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98] tap-target"
          style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)", boxShadow: "0 4px 12px rgba(232,93,140,0.2)" }}
        >
          💸 Catat Mutasi Kas
        </button>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between mb-4 rounded-2xl p-3" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
        <button onClick={() => shiftMonth(-1)} className="h-9 w-9 rounded-xl flex items-center justify-center tap-target" style={{ background: "#F1F5F9" }} data-testid="prev-month">
          <ChevronLeft size={18} style={{ color: "#334155" }} />
        </button>
        <span className="text-sm font-bold" style={{ color: "#1C1C1E" }}>{formatMonth(month)}</span>
        <button onClick={() => shiftMonth(1)} className="h-9 w-9 rounded-xl flex items-center flex-shrink-0 justify-center tap-target" style={{ background: "#F1F5F9" }} data-testid="next-month">
          <ChevronRight size={18} style={{ color: "#334155" }} />
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1 mb-5" style={{ border: "1px solid #E2E8F0" }}>
        <button
          onClick={() => setActiveSubTab("pnl")}
          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all tap-target"
          style={activeSubTab === "pnl" ? { background: "#fff", color: "#E85D8C", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" } : { color: "#64748B" }}
        >
          📈 Laba Rugi
        </button>
        <button
          onClick={() => setActiveSubTab("cashflow")}
          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all tap-target"
          style={activeSubTab === "cashflow" ? { background: "#fff", color: "#E85D8C", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" } : { color: "#64748B" }}
        >
          💰 Arus Kas & Saldo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} /></div>
      ) : data ? (
        activeSubTab === "pnl" ? (
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
          <div className="space-y-4">
            {/* Cash vs Bank Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
                <p className="text-xs font-bold text-slate-400">💵 SALDO CASH (Buku)</p>
                <p className="text-lg font-extrabold mt-1 text-slate-800 tabular-nums">{fmt(data.saldoBukuCash ?? 0)}</p>
                <div className="mt-3 space-y-1 text-xxs text-slate-400">
                  <div className="flex justify-between"><span>Uang Masuk:</span><span className="text-emerald-600 font-bold">+{fmt(data.totalCashIn ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Uang Keluar:</span><span className="text-red-500">-{fmt(data.totalCashOut ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Transfer Internal:</span><span className="font-bold text-slate-600">{(data.mutasiBankToCash ?? 0) - (data.mutasiCashToBank ?? 0) >= 0 ? "+" : ""}{fmt((data.mutasiBankToCash ?? 0) - (data.mutasiCashToBank ?? 0))}</span></div>
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
                <p className="text-xs font-bold text-slate-400">🏦 SALDO BANK (Buku)</p>
                <p className="text-lg font-extrabold mt-1 text-slate-800 tabular-nums">{fmt(data.saldoBukuBank ?? 0)}</p>
                <div className="mt-3 space-y-1 text-xxs text-slate-400">
                  <div className="flex justify-between"><span>Uang Masuk:</span><span className="text-emerald-600 font-bold">+{fmt(data.totalBankIn ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Uang Keluar:</span><span className="text-red-500">-{fmt(data.totalBankOut ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Transfer Internal:</span><span className="font-bold text-slate-600">{(data.mutasiCashToBank ?? 0) - (data.mutasiBankToCash ?? 0) >= 0 ? "+" : ""}{fmt((data.mutasiCashToBank ?? 0) - (data.mutasiBankToCash ?? 0))}</span></div>
                </div>
              </div>
            </div>

            {/* Arus Kas Detail */}
            <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#94A3B8" }}>Detail Mutasi Internal</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">Setoran Tunai (Cash → Bank)</span>
                  <span className="font-semibold text-slate-800">{fmt(data.mutasiCashToBank ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">Tarik Tunai (Bank → Cash)</span>
                  <span className="font-semibold text-slate-800">{fmt(data.mutasiBankToCash ?? 0)}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-3 text-center italic">
                * Saldo dihitung berdasarkan data tercatat di sistem pada periode ini.
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-2xl border-2 border-dashed p-10 text-center" style={{ borderColor: "#E2E8F0" }}>
          <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Data tidak tersedia untuk bulan ini</p>
        </div>
      )}

      {/* ── Cash Transfer Modal (Mutasi Kas) ── */}
      {showTransferModal && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowTransferModal(false); }}
        >
          <div className="overflow-y-auto" style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "80vh" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#1C1C1E" }}>Catat Mutasi Kas Internal</h2>
              <button
                onClick={() => setShowTransferModal(false)}
                style={{ width: "30px", height: "30px", borderRadius: "10px", background: "#F8FAFC", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} style={{ color: "#64748B" }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Nominal Uang</label>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#64748B" }}>Rp</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={transferAmount}
                    onChange={e => setTransferAmount(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "13px", outline: "none", background: "#F8FAFC" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Arah Mutasi</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTransferFrom("cash")}
                    style={{ flex: 1, padding: "10px 0", borderRadius: "12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: "none",
                      color: transferFrom === "cash" ? "#fff" : "#64748B", background: transferFrom === "cash" ? "#E85D8C" : "#F1F5F9" }}
                  >
                    Setoran Tunai (Cash → Bank)
                  </button>
                  <button
                    onClick={() => setTransferFrom("bank")}
                    style={{ flex: 1, padding: "10px 0", borderRadius: "12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: "none",
                      color: transferFrom === "bank" ? "#fff" : "#64748B", background: transferFrom === "bank" ? "#E85D8C" : "#F1F5F9" }}
                  >
                    Tarik Tunai (Bank → Cash)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Tanggal Catatan</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "13px", outline: "none", color: "#1C1C1E", background: "#F8FAFC" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Setoran harian / Biaya kembalian kasir"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "13px", outline: "none", background: "#F8FAFC" }}
                />
              </div>

              {transferError && <p style={{ fontSize: "12px", color: "#DC2626", textAlign: "center" }}>{transferError}</p>}

              <button
                onClick={handleTransferSubmit}
                disabled={transferSubmitting}
                className="w-full flex items-center justify-center min-h-[48px]"
                style={{ padding: "12px", borderRadius: "14px", fontSize: "14px", fontWeight: "700", color: "#fff", background: "#E85D8C", border: "none", cursor: "pointer", opacity: transferSubmitting ? 0.7 : 1 }}
              >
                {transferSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Simpan Mutasi Kas"}
              </button>
            </div>
          </div>
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

