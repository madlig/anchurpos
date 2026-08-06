"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSearchParams } from "next/navigation";
import { 
  Loader2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, 
  FileText, X, Wallet, Building2, ArrowLeftRight, CheckCircle2, AlertCircle,
  PieChart, ArrowUpRight, ArrowDownRight, Scale, ShoppingBag, Search, Filter,
  ArrowDownLeft, RefreshCw, Banknote, ShieldCheck
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

interface CashJournalEntry {
  id: string;
  date: string;
  type: "pos_sales" | "purchases" | "expense" | "non_sales_income" | "payroll" | "transfer";
  description: string;
  account: "cash" | "bank";
  amount: number;
  notes?: string;
}

interface PnlData {
  month: string; 
  pemasukan: number; 
  hppProduk: number; 
  labaKotor: number;
  biayaOperasional: number; 
  biayaPromosi: number; 
  gajiBonus: number; 
  labaBersih: number;
  totalBelanjaBahan?: number;
  totalNonSalesIncome?: number;
  totalCashIn?: number; 
  totalCashOut?: number;
  totalBankIn?: number; 
  totalBankOut?: number;
  mutasiCashToBank?: number; 
  mutasiBankToCash?: number;
  saldoBukuCash?: number; 
  saldoBukuBank?: number;
  cashJournal?: CashJournalEntry[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[mo - 1]} ${y}`;
}

function OwnerReportsContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Cash Flow & Transfer States
  const [activeSubTab, setActiveSubTab] = useState<"pnl" | "cashflow">("pnl");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "cashflow") {
      setActiveSubTab("cashflow");
    } else if (tab === "pnl") {
      setActiveSubTab("pnl");
    }
  }, [searchParams]);

  // Cash Journal Filters
  const [accountFilter, setAccountFilter] = useState<"all" | "cash" | "bank">("all");
  const [journalTypeFilter, setJournalTypeFilter] = useState<string>("all");
  const [journalSearch, setJournalSearch] = useState("");

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
      console.error("Fetch PnL error:", err);
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

  const grossProfitMargin = useMemo(() => {
    if (!data || !data.pemasukan) return 0;
    return ((data.labaKotor / data.pemasukan) * 100).toFixed(1);
  }, [data]);

  const netProfitMargin = useMemo(() => {
    if (!data || !data.pemasukan) return 0;
    return ((data.labaBersih / data.pemasukan) * 100).toFixed(1);
  }, [data]);

  // Cash Flow Calculations
  const posSalesIn = useMemo(() => {
    if (!data) return 0;
    return ((data.totalCashIn ?? 0) + (data.totalBankIn ?? 0)) - (data.totalNonSalesIncome ?? 0);
  }, [data]);

  const netOperatingCashFlow = useMemo(() => {
    if (!data) return 0;
    return posSalesIn - (data.totalBelanjaBahan ?? 0) - (data.biayaOperasional ?? 0) - (data.gajiBonus ?? 0);
  }, [data, posSalesIn]);

  const netFinancingCashFlow = useMemo(() => {
    if (!data) return 0;
    return data.totalNonSalesIncome ?? 0;
  }, [data]);

  const netTotalCashFlow = netOperatingCashFlow + netFinancingCashFlow;

  // Filtered Cash Journal Entries
  const filteredJournal = useMemo(() => {
    if (!data || !data.cashJournal) return [];
    return data.cashJournal.filter(item => {
      const isAccountMatch = accountFilter === "all" || item.account === accountFilter;
      const isTypeMatch = journalTypeFilter === "all" || item.type === journalTypeFilter;
      const isSearchMatch = !journalSearch || 
        item.description.toLowerCase().includes(journalSearch.toLowerCase()) || 
        (item.notes ?? "").toLowerCase().includes(journalSearch.toLowerCase());
      return isAccountMatch && isTypeMatch && isSearchMatch;
    });
  }, [data, accountFilter, journalTypeFilter, journalSearch]);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      {/* ── Native App Sticky Header ── */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-primary shrink-0 shadow-sm">
                <FileText size={20} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">
                  Laporan Keuangan & Arus Kas
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  {formatMonthLabel(month)} • Outlet Utama
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setTransferDate(new Date().toISOString().split("T")[0]);
                setShowTransferModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-primary hover:bg-rose-600 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <ArrowLeftRight size={14} /> Catat Mutasi Kas
            </button>
          </div>

          {/* ── Month Selector Bar ── */}
          <div className="flex items-center justify-between bg-slate-100/80 rounded-2xl p-1.5 border border-slate-200/80">
            <button
              onClick={() => shiftMonth(-1)}
              className="h-9 w-9 rounded-xl bg-white flex items-center justify-center text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs md:text-sm font-extrabold text-slate-800 tracking-tight">
              {formatMonthLabel(month)}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              className="h-9 w-9 rounded-xl bg-white flex items-center justify-center text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* ── Sub-Tabs Switcher ── */}
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl gap-1">
            <button
              onClick={() => setActiveSubTab("pnl")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeSubTab === "pnl" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <TrendingUp size={14} className={activeSubTab === "pnl" ? "text-primary" : "text-slate-400"} />
              Laba Rugi (P&L)
            </button>

            <button
              onClick={() => setActiveSubTab("cashflow")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeSubTab === "cashflow" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Wallet size={14} className={activeSubTab === "cashflow" ? "text-primary" : "text-slate-400"} />
              Arus Kas & Saldo
            </button>
          </div>

        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-5 pt-5">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-3xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-28 w-full rounded-3xl" />
              <Skeleton className="h-28 w-full rounded-3xl" />
            </div>
            <Skeleton className="h-36 w-full rounded-3xl" />
          </div>
        ) : !data ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm space-y-2">
            <AlertCircle size={32} className="text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Data laporan tidak ditemukan untuk bulan ini.</p>
          </div>
        ) : activeSubTab === "pnl" ? (
          <div className="space-y-4">
            
            {/* ── PNL Card 1: Hero Pemasukan (Revenue) ── */}
            <div className="rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 md:p-6 text-white shadow-xl shadow-slate-900/10 border border-slate-800 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-2xl" />
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpRight size={15} className="text-emerald-400" /> Total Pemasukan Kotor (Revenue)
                </span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Terverifikasi
                </span>
              </div>
              <div className="text-2xl md:text-3xl font-black text-white tabular-nums">
                {fmt(data.pemasukan)}
              </div>
            </div>

            {/* ── PNL Card 2: HPP & Laba Kotor ── */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <PieChart size={14} className="text-primary" /> Harga Pokok Penjualan (HPP) & Margin Kotor
              </h2>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="font-bold text-slate-600">Total HPP Produk (Bahan Baku & Kemasan)</span>
                  <span className="font-extrabold text-rose-600 tabular-nums">-{fmt(data.hppProduk)}</span>
                </div>

                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  data.labaKotor >= 0 ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-900" : "bg-rose-50/70 border-rose-200/80 text-rose-900"
                }`}>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block">Laba Kotor (Gross Profit)</span>
                    <span className="text-xs font-medium text-slate-500 mt-0.5 block">Margin Kotor: {grossProfitMargin}%</span>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    {data.labaKotor >= 0 ? <TrendingUp size={18} className="text-emerald-600" /> : <TrendingDown size={18} className="text-rose-600" />}
                    <span className="text-base md:text-lg font-black tabular-nums">{fmt(data.labaKotor)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── PNL Card 3: Rincian Pengeluaran Operasional ── */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <ArrowDownRight size={14} className="text-rose-500" /> Beban Operasional & Biaya Lainnya
              </h2>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-600">Biaya Operasional Outlet</span>
                  <span className="font-extrabold text-rose-600 tabular-nums">-{fmt(data.biayaOperasional)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-600">Biaya Promosi / Adjustment Stok</span>
                  <span className="font-extrabold text-rose-600 tabular-nums">-{fmt(data.biayaPromosi)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-600">Gaji, Uang Makan & Bonus Karyawan</span>
                  <span className="font-extrabold text-rose-600 tabular-nums">-{fmt(data.gajiBonus)}</span>
                </div>
              </div>
            </div>

            {/* ── PNL Card 4: Net Profit (Laba Bersih) Banner ── */}
            <div className={`rounded-2xl md:rounded-3xl p-5 md:p-6 text-white shadow-lg flex items-center justify-between ${
              data.labaBersih >= 0 ? "bg-gradient-to-br from-emerald-600 to-teal-700" : "bg-gradient-to-br from-rose-600 to-red-700"
            }`}>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/80 block">Laba Bersih Akhir (Net Profit)</span>
                <span className="text-xs font-medium text-white/80 mt-0.5 block">Margin Bersih: {netProfitMargin}%</span>
              </div>

              <div className="text-right">
                <span className="text-xl md:text-2xl font-black tabular-nums text-white">{fmt(data.labaBersih)}</span>
              </div>
            </div>

          </div>
        ) : (
          /* ── SUB TAB: ARUS KAS & SALDO BUKU (FORMAL ERP STATEMENT + CHRONOLOGICAL LEDGER) ── */
          <div className="space-y-5">
            
            {/* ── Section 1: Executive 3-Card Balance Summary ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Cash Balance */}
              <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
                    <Wallet size={14} className="text-amber-500" /> Saldo Cash (Laci)
                  </span>
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                    Kas Fisik
                  </span>
                </div>
                <div className="text-xl md:text-2xl font-black text-slate-800 tabular-nums">
                  {fmt(data.saldoBukuCash ?? 0)}
                </div>
                <p className="text-[11px] font-semibold text-slate-400">Total uang tunai fisik laci kasir</p>
              </div>

              {/* Bank Balance */}
              <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
                    <Building2 size={14} className="text-emerald-500" /> Saldo Bank (Digital)
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                    Rekening
                  </span>
                </div>
                <div className="text-xl md:text-2xl font-black text-slate-800 tabular-nums">
                  {fmt(data.saldoBukuBank ?? 0)}
                </div>
                <p className="text-[11px] font-semibold text-slate-400">Transfer & QRIS settlement bank</p>
              </div>

              {/* Net Cash Flow */}
              <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
                    <Scale size={14} className="text-primary" /> Net Cash Flow
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    netTotalCashFlow >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}>
                    {netTotalCashFlow >= 0 ? "+Surplus" : "-Defisit"}
                  </span>
                </div>
                <div className={`text-xl md:text-2xl font-black tabular-nums ${netTotalCashFlow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {fmt(netTotalCashFlow)}
                </div>
                <p className="text-[11px] font-semibold text-slate-400">Kas Masuk minus Kas Keluar</p>
              </div>
            </div>

            {/* ── Section 2: Formal Statement of Cash Flows (Accurate / Odoo ERP Style) ── */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-primary" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                    Laporan Arus Kas Formal (Statement of Cash Flows)
                  </h2>
                </div>
                <span className="text-xs font-bold text-slate-400">Standar ERP</span>
              </div>

              <div className="space-y-4 text-xs">
                
                {/* 1. Operating Cash Flow */}
                <div className="space-y-2">
                  <h3 className="font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-xs text-emerald-700">
                    <ArrowUpRight size={15} /> 1. Arus Kas Dari Aktivitas Operasional
                  </h3>

                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-600 font-medium">Penerimaan Uang Kas dari Penjualan POS (Kas & Bank)</span>
                      <span className="font-extrabold text-emerald-600 tabular-nums">+{fmt(posSalesIn)}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-600 font-medium">Pembayaran Kas untuk Belanja Bahan Baku & Kemasan</span>
                      <span className="font-extrabold text-rose-600 tabular-nums">-{fmt(data.totalBelanjaBahan ?? 0)}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="text-slate-600 font-medium">Pembayaran Kas untuk Beban Operasional Outlet</span>
                      <span className="font-extrabold text-rose-600 tabular-nums">-{fmt(data.biayaOperasional ?? 0)}</span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-600 font-medium">Pembayaran Kas untuk Gaji & Bonus Karyawan</span>
                      <span className="font-extrabold text-rose-600 tabular-nums">-{fmt(data.gajiBonus ?? 0)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200/70 font-extrabold text-emerald-900">
                    <span>Arus Kas Bersih Dari Operasional</span>
                    <span className="tabular-nums">{fmt(netOperatingCashFlow)}</span>
                  </div>
                </div>

                {/* 2. Financing / Non Sales Cash Flow */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h3 className="font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-xs text-primary">
                    <Building2 size={15} /> 2. Arus Kas Dari Pendanaan & Pemasukan Non-POS
                  </h3>

                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-600 font-medium">Suntikan Modal Owner, Refund Supplier, Cashback & Aset</span>
                      <span className="font-extrabold text-emerald-600 tabular-nums">+{fmt(netFinancingCashFlow)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-rose-50/70 border border-rose-200/70 font-extrabold text-rose-900">
                    <span>Arus Kas Bersih Dari Pendanaan / Non-POS</span>
                    <span className="tabular-nums">{fmt(netFinancingCashFlow)}</span>
                  </div>
                </div>

                {/* 3. Net Cash Flow Reconciliation */}
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center p-3 rounded-2xl bg-slate-900 text-white font-black text-xs md:text-sm">
                  <span>TOTAL KENAIKAN / PENURUNAN KAS BERSIH</span>
                  <span className="tabular-nums text-emerald-400">{fmt(netTotalCashFlow)}</span>
                </div>

              </div>
            </div>

            {/* ── Section 3: Jurnal Mutasi Kas Kronologis Lengkap ── */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm border border-slate-200/80 space-y-4">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Banknote size={18} className="text-emerald-600" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                    Jurnal Mutasi Kas Kronologis (Cash Journal Ledger)
                  </h2>
                </div>

                <span className="text-xs font-bold text-slate-400">
                  {filteredJournal.length} Transaksi Terhitung
                </span>
              </div>

              {/* Filters & Search Row */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                
                {/* Account Filter Pills */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  {[
                    { id: "all", label: "Semua Akun" },
                    { id: "cash", label: "Laci Cash" },
                    { id: "bank", label: "Rekening Bank" },
                  ].map(a => (
                    <button
                      key={a.id}
                      onClick={() => setAccountFilter(a.id as any)}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        accountFilter === a.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>

                {/* Type Filter Select & Search */}
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <select
                    value={journalTypeFilter}
                    onChange={e => setJournalTypeFilter(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="all">Semua Tipe Aktivitas</option>
                    <option value="pos_sales">Penjualan POS</option>
                    <option value="purchases">Belanja Bahan</option>
                    <option value="expense">Operasional</option>
                    <option value="non_sales_income">Pemasukan Non-POS</option>
                    <option value="payroll">Gaji & Payroll</option>
                    <option value="transfer">Mutasi Internal</option>
                  </select>

                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari jurnal kas..."
                      value={journalSearch}
                      onChange={e => setJournalSearch(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

              </div>

              {/* Journal Table List */}
              {filteredJournal.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-1">
                  <p className="text-xs font-bold text-slate-600">Tidak ada jurnal mutasi kas ditemukan.</p>
                  <p className="text-[11px] text-slate-400">Coba ubah kata kunci atau filter akun di atas.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredJournal.map(item => {
                    const isIn = item.amount > 0;
                    const dateObj = new Date(item.date);
                    const formattedDate = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

                    return (
                      <div 
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                            isIn ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-rose-50 border-rose-200 text-rose-600"
                          }`}>
                            {isIn ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-slate-800 truncate">{item.description}</h4>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 border ${
                                item.account === "cash" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              }`}>
                                {item.account === "cash" ? "Cash Laci" : "Bank"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 mt-0.5">
                              <span>{formattedDate}</span>
                              {item.notes && (
                                <>
                                  <span>•</span>
                                  <span className="italic truncate">{item.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`font-black tabular-nums text-xs md:text-sm block ${isIn ? "text-emerald-600" : "text-rose-600"}`}>
                            {isIn ? "+" : ""}{fmt(item.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

          </div>
        )}
      </div>

      {/* ── Cash Transfer Modal (Mutasi Kas) ── */}
      {showTransferModal && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          onClick={e => { if (e.target === e.currentTarget) setShowTransferModal(false); }}
        >
          <div className="w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl p-5 md:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-primary flex items-center justify-center">
                  <ArrowLeftRight size={16} />
                </div>
                <h2 className="text-base font-extrabold text-slate-800">Catat Mutasi Kas Internal</h2>
              </div>

              <button
                onClick={() => setShowTransferModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Nominal Uang Transfer (Rp) *</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Arah Mutasi *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferFrom("cash")}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all border ${
                      transferFrom === "cash" 
                        ? "bg-primary text-white border-primary shadow-sm" 
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    Setoran (Cash → Bank)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferFrom("bank")}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all border ${
                      transferFrom === "bank" 
                        ? "bg-primary text-white border-primary shadow-sm" 
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    Tarik Tunai (Bank → Cash)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Tanggal Mutasi</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Setoran harian / Kembalian kasir"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              {transferError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-center">
                  {transferError}
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleTransferSubmit}
                  disabled={transferSubmitting}
                  className="w-full h-12 rounded-xl bg-primary hover:bg-rose-600 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {transferSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Simpan Mutasi Kas"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OwnerReportsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <OwnerReportsContent />
    </Suspense>
  );
}
