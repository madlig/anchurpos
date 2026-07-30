"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { 
  Plus, Calendar, Search, FileText, CreditCard, HelpCircle, Loader2, Check, X, Building,
  ArrowUpRight, ArrowDownRight, Filter, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Wallet, Banknote, DollarSign, ArrowLeftRight, Trash2, PiggyBank, RefreshCw
} from "lucide-react";

interface CashItem {
  id: string;
  date: string;
  category: string;
  type?: "expense" | "income";
  itemName: string;
  totalPrice: number;
  paymentMethod: string;
  supplier: string;
  notes: string;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const EXPENSE_CATEGORIES = [
  { id: "operasional", label: "Operasional Outlet" },
  { id: "lain_lain", label: "Lain-lain" },
];

const INCOME_CATEGORIES = [
  { id: "suntikan_modal", label: "Suntikan Modal / Investor" },
  { id: "refund_supplier", label: "Refund / Retur Supplier" },
  { id: "cashback", label: "Cashback / Bonus Pembayaran" },
  { id: "penjualan_aset", label: "Penjualan Aset Bekas" },
  { id: "lain_lain", label: "Lain-lain" },
];

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[mo - 1]} ${y}`;
}

export default function CashbookPage() {
  const { getToken } = useAuth();
  const { alert } = useAlertConfirm();
  const [items, setItems] = useState<CashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Month selector state (default: current month YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Filters & Search
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [search, setSearch] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"expense" | "income">("expense");

  // Form State
  const [category, setCategory] = useState("operasional");
  const [itemName, setItemName] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [y, m] = selectedMonth.split("-").map(Number);
      const start = `${selectedMonth}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

      const res = await fetchWithAuth(`/api/expenses?startDate=${start}&endDate=${end}`);
      if (res.ok) {
        setItems(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreateModal(type: "expense" | "income") {
    setModalType(type);
    setCategory(type === "expense" ? "operasional" : "suntikan_modal");
    setItemName("");
    setTotalCost("");
    setPaymentMethod("cash");
    setNotes("");
    setCustomDate(new Date().toISOString().split("T")[0]);
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    setError("");
    const amount = parseInt(totalCost);
    if (!itemName.trim()) {
      setError("Nama catatan wajib diisi");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Nominal harus lebih dari 0");
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          itemName: itemName.trim(),
          category,
          totalPrice: amount,
          paymentMethod,
          notes: notes.trim(),
          type: modalType,
          customDate,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Gagal menyimpan catatan");
        return;
      }

      setShowModal(false);
      await loadData();
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetchWithAuth(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadData();
      } else {
        alert("Gagal menghapus catatan.");
      }
    } catch {
      alert("Terjadi kesalahan sistem.");
    } finally {
      setDeletingId(null);
    }
  }

  function shiftMonth(delta: number) {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Filtered Items & Calculations
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const isTypeMatch = filterType === "all" || (item.type ?? "expense") === filterType;
      const isSearchMatch = !search || item.itemName.toLowerCase().includes(search.toLowerCase()) || (item.notes ?? "").toLowerCase().includes(search.toLowerCase());
      return isTypeMatch && isSearchMatch;
    });
  }, [items, filterType, search]);

  const totalIncome = useMemo(() => {
    return items.filter(i => (i.type ?? "expense") === "income").reduce((acc, i) => acc + (i.totalPrice || 0), 0);
  }, [items]);

  const totalExpense = useMemo(() => {
    return items.filter(i => (i.type ?? "expense") === "expense").reduce((acc, i) => acc + (i.totalPrice || 0), 0);
  }, [items]);

  const netFlow = totalIncome - totalExpense;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      {/* ── Native App Sticky Header ── */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                <Banknote size={20} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">
                  Buku Kas
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  Pemasukan Non-Penjualan & Pengeluaran Kas
                </p>
              </div>
            </div>

            {/* Dual Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => openCreateModal("expense")}
                className="px-3 md:px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <ArrowDownRight size={15} /> + Pengeluaran
              </button>

              <button
                onClick={() => openCreateModal("income")}
                className="px-3 md:px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <ArrowUpRight size={15} /> + Pemasukan
              </button>
            </div>
          </div>

          {/* Month Selector Bar */}
          <div className="flex items-center justify-between bg-slate-100/80 rounded-2xl p-1.5 border border-slate-200/80">
            <button
              onClick={() => shiftMonth(-1)}
              className="h-9 w-9 rounded-xl bg-white flex items-center justify-center text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs md:text-sm font-extrabold text-slate-800 tracking-tight">
              {formatMonthLabel(selectedMonth)}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              className="h-9 w-9 rounded-xl bg-white flex items-center justify-center text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-5 pt-5">
        
        {/* ── 3 Executive Financial Summary Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Income Non Sales Card */}
          <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 text-emerald-600">
                <ArrowUpRight size={14} /> Pemasukan Non-POS
              </span>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                Kas Masuk
              </span>
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-800 tabular-nums">
              {fmt(totalIncome)}
            </div>
            <p className="text-[11px] font-semibold text-slate-400">Suntikan modal, refund, cashback, & aset</p>
          </div>

          {/* Expenses Card */}
          <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 text-rose-600">
                <ArrowDownRight size={14} /> Pengeluaran Kas
              </span>
              <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100">
                Kas Keluar
              </span>
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-800 tabular-nums">
              {fmt(totalExpense)}
            </div>
            <p className="text-[11px] font-semibold text-slate-400">Biaya operasional & pengeluaran kasir</p>
          </div>

          {/* Net Flow Card */}
          <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 text-slate-700">
                <Wallet size={14} className="text-primary" /> Net Cashflow Buku Kas
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                netFlow >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
              }`}>
                {netFlow >= 0 ? "+Surplus" : "-Defisit"}
              </span>
            </div>
            <div className={`text-xl md:text-2xl font-black tabular-nums ${netFlow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {fmt(netFlow)}
            </div>
            <p className="text-[11px] font-semibold text-slate-400">Selisih kas masuk vs kas keluar</p>
          </div>

        </div>

        {/* ── Transaction Filter & Search Row ── */}
        <div className="bg-white rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-sm border border-slate-200/80 space-y-3">
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {[
                { id: "all", label: "Semua (" + items.length + ")" },
                { id: "expense", label: "Pengeluaran (" + items.filter(i => (i.type??"expense")==="expense").length + ")" },
                { id: "income", label: "Pemasukan (" + items.filter(i => (i.type??"expense")==="income").length + ")" },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilterType(t.id as any)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterType === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari transaksi / catatan..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

        </div>

        {/* ── Transaction Items List ── */}
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-white rounded-2xl border border-slate-200/80 p-4" />
            <div className="h-20 bg-white rounded-2xl border border-slate-200/80 p-4" />
            <div className="h-20 bg-white rounded-2xl border border-slate-200/80 p-4" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm space-y-2">
            <Banknote size={32} className="text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Belum ada transaksi di Buku Kas untuk bulan ini.</p>
            <p className="text-xs text-slate-400">Klik tombol di atas untuk mencatat pengeluaran atau pemasukan baru.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredItems.map(item => {
              const isIncome = (item.type ?? "expense") === "income";
              const formattedDate = new Date(item.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

              return (
                <div 
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex items-center justify-between gap-3 animate-in fade-in"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                      isIncome ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
                    }`}>
                      {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-800 truncate">{item.itemName}</h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 border ${
                          isIncome ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {item.category.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 mt-1">
                        <span>{formattedDate}</span>
                        <span>•</span>
                        <span className="capitalize">{item.paymentMethod || "Cash"}</span>
                        {item.notes && (
                          <>
                            <span>•</span>
                            <span className="italic truncate">{item.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className={`text-sm md:text-base font-black tabular-nums block ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>
                        {isIncome ? "+" : "-"}{fmt(item.totalPrice)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors"
                    >
                      {deletingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ── Modal Bottom Sheet (Create Transaction) ── */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl p-5 md:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  modalType === "income" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                }`}>
                  {modalType === "income" ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                </div>
                <h2 className="text-base font-extrabold text-slate-800">
                  {modalType === "income" ? "Catat Pemasukan Non-Penjualan" : "Catat Pengeluaran Kas"}
                </h2>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Type Switcher inside Modal */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setModalType("expense"); setCategory("operasional"); }}
                  className={`py-2 rounded-lg font-bold text-xs transition-all ${
                    modalType === "expense" ? "bg-rose-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Pengeluaran Kas
                </button>
                <button
                  type="button"
                  onClick={() => { setModalType("income"); setCategory("suntikan_modal"); }}
                  className={`py-2 rounded-lg font-bold text-xs transition-all ${
                    modalType === "income" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Pemasukan Non-POS
                </button>
              </div>

              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  {modalType === "income" ? "Nama Pemasukan / Sumber *" : "Nama Pengeluaran / Item *"}
                </label>
                <input
                  type="text"
                  placeholder={modalType === "income" ? "Contoh: Suntikan Modal Owner / Refund Sabun" : "Contoh: Pembelian Listrik / Air Minum"}
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Kategori *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  >
                    {(modalType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Metode Pembayaran *</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  >
                    <option value="cash">Tunai / Cash Laci</option>
                    <option value="transfer">Bank Transfer</option>
                    <option value="qris">QRIS / E-Wallet</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Nominal Uang (Rp) *</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={totalCost}
                    onChange={e => setTotalCost(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Tanggal Catatan</label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Catatan detail tambahan..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-center">
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`w-full h-12 rounded-xl text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                    modalType === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : (modalType === "income" ? "Simpan Pemasukan" : "Simpan Pengeluaran")}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
