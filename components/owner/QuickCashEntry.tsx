"use client";

import { useState } from "react";
import { Loader2, X, ArrowUpCircle, ArrowDownCircle, Check } from "lucide-react";

export interface QuickCashEntryProps {
  /** Called with the auth token-bearing fetch; the modal posts via this. */
  postExpense: (body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  /** Default entry kind when opening. */
  initialType?: "expense" | "income";
  /** Fired after a successful save so the parent can refresh its data. */
  onSaved?: () => void;
  /** Notifies parent to close. */
  onClose: () => void;
}

const EXPENSE_CATEGORIES = [
  { id: "operasional", label: "Operasional Outlet" },
  { id: "bahan_baku", label: "Bahan Baku" },
  { id: "packaging", label: "Packaging" },
  { id: "lain_lain", label: "Lain-lain" },
];

const INCOME_CATEGORIES = [
  { id: "suntikan_modal", label: "Suntikan Modal" },
  { id: "refund_supplier", label: "Refund Supplier" },
  { id: "cashback", label: "Cashback" },
  { id: "penjualan_aset", label: "Penjualan Aset" },
  { id: "lain_lain", label: "Lain-lain" },
];

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash Laci" },
  { id: "transfer", label: "Transfer Bank" },
  { id: "qris", label: "QRIS" },
];

export function QuickCashEntry({ postExpense, initialType = "expense", onSaved, onClose }: QuickCashEntryProps) {
  const [type, setType] = useState<"expense" | "income">(initialType);
  const [category, setCategory] = useState(initialType === "expense" ? "operasional" : "suntikan_modal");
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function switchType(next: "expense" | "income") {
    setType(next);
    setCategory(next === "expense" ? "operasional" : "suntikan_modal");
  }

  async function handleSubmit() {
    setError("");
    const amountNum = parseInt(amount.replace(/\D/g, ""), 10);
    if (!amountNum || amountNum <= 0) {
      setError("Nominal harus lebih dari 0");
      return;
    }
    if (!itemName.trim()) {
      setError("Keterangan/nama wajib diisi");
      return;
    }
    setSubmitting(true);
    const res = await postExpense({
      type,
      category,
      itemName: itemName.trim(),
      totalPrice: amountNum,
      paymentMethod,
      notes: notes.trim() || null,
      customDate: date,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Gagal menyimpan");
      return;
    }
    onSaved?.();
    onClose();
  }

  const isIncome = type === "income";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end md:justify-center items-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl p-5 md:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isIncome ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              {isIncome ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
            </div>
            <h2 className="text-base font-extrabold text-slate-800">
              {isIncome ? "Catat Pemasukan" : "Catat Pengeluaran"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Type Switch */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => switchType("expense")}
            className={`py-2.5 rounded-xl font-bold text-xs transition-all border flex items-center justify-center gap-1.5 ${
              type === "expense"
                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
            }`}
          >
            <ArrowDownCircle size={14} /> Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => switchType("income")}
            className={`py-2.5 rounded-xl font-bold text-xs transition-all border flex items-center justify-center gap-1.5 ${
              type === "income"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
            }`}
          >
            <ArrowUpCircle size={14} /> Pemasukan
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Amount — big, prominent */}
          <div>
            <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Nominal (Rp) *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount ? Number(amount.replace(/\D/g, "")).toLocaleString("id-ID") : ""}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="w-full h-14 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-2xl font-black text-slate-800 tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Keterangan *</label>
            <input
              type="text"
              placeholder={isIncome ? "Contoh: Setoran modal harian" : "Contoh: Belanja gas LPG"}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Category chips */}
          <div>
            <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Kategori</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`px-3 py-2 rounded-xl font-bold text-xs transition-all border ${
                    category === c.id
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment method + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Dari Kas</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Tanggal</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Catatan (Opsional)</label>
            <input
              type="text"
              placeholder="Catatan tambahan..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`w-full h-12 rounded-xl text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 ${
              isIncome ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
