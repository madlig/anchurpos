"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { 
  Loader2, Plus, Trash2, ChevronLeft, ChevronRight, X, ArrowLeft,
  SlidersHorizontal, ArrowUpRight, ArrowDownRight, Package, ShoppingBag,
  FileText, CheckCircle2, AlertTriangle, Filter, Search, Tag, User
} from "lucide-react";
import Link from "next/link";

interface Adjustment {
  id: string;
  date: string;
  itemType: "variant" | "ingredient";
  itemId: string;
  itemName: string;
  qty: number;
  direction: "decrease" | "increase";
  reasonCategory: string;
  reasonCustom: string | null;
  recipientName: string | null;
  hppPerUnit: number;
  totalCost: number;
  createdBy: string;
  createdAt: string;
}

interface ItemOption {
  id: string;
  name: string;
  type: "variant" | "ingredient";
  unit: string;
  currentStock: number;
}

const REASON_OPTIONS = [
  { value: "sample_affiliate", label: "Sample Affiliate / Marketing" },
  { value: "rusak_reject", label: "Rusak / Reject / Basi" },
  { value: "konsumsi_internal", label: "Konsumsi Internal Outlet" },
  { value: "selisih_opname", label: "Selisih Opname / Audit" },
  { value: "hadiah_bonus", label: "Hadiah / Bonus Supplier" },
  { value: "lainnya", label: "Lainnya" },
];

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[mo - 1]} ${y}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function StockAdjustmentsPage() {
  const { getToken } = useAuth();
  const { alert, confirm } = useAlertConfirm();

  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [itemsList, setItemsList] = useState<ItemOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Filters
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("all");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [formType, setFormType] = useState<"variant" | "ingredient">("ingredient");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [qty, setQty] = useState("");
  const [direction, setDirection] = useState<"decrease" | "increase">("decrease");
  const [reasonCategory, setReasonCategory] = useState("rusak_reject");
  const [reasonCustom, setReasonCustom] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formError, setFormError] = useState("");

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
      const [adjRes, varRes, ingRes] = await Promise.all([
        fetchWithAuth(`/api/stock-adjustments?month=${month}`),
        fetchWithAuth("/api/products/stocks"),
        fetchWithAuth("/api/ingredients"),
      ]);

      if (adjRes.ok) setAdjustments(await adjRes.json());

      const availableItems: ItemOption[] = [];

      if (varRes.ok) {
        const vars = await varRes.json();
        vars.forEach((v: any) => {
          availableItems.push({
            id: v.id,
            name: v.name,
            type: "variant",
            unit: "Pack",
            currentStock: v.currentStock ?? 0,
          });
        });
      }

      if (ingRes.ok) {
        const ings = await ingRes.json();
        ings.forEach((i: any) => {
          availableItems.push({
            id: i.id,
            name: i.name,
            type: "ingredient",
            unit: i.baseUnit ?? "Unit",
            currentStock: i.currentStock ?? 0,
          });
        });
      }

      setItemsList(availableItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month, fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreateModal() {
    setSelectedItemId("");
    setItemSearch("");
    setQty("");
    setDirection("decrease");
    setReasonCategory("rusak_reject");
    setReasonCustom("");
    setRecipientName("");
    setCustomDate(new Date().toISOString().split("T")[0]);
    setFormError("");
    setShowModal(true);
  }

  async function handleSubmit() {
    setFormError("");
    const qtyNum = parseFloat(qty);
    if (!selectedItemId) {
      setFormError("Pilih item produk / bahan yang akan di-adjust");
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setFormError("Jumlah (Qty) adjustment harus lebih dari 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/stock-adjustments", {
        method: "POST",
        body: JSON.stringify({
          itemType: formType,
          itemId: selectedItemId,
          qty: qtyNum,
          direction,
          reasonCategory,
          reasonCustom,
          recipientName,
          customDate,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setFormError(resData.error ?? "Gagal menyimpan adjustment stok");
        return;
      }

      setShowModal(false);
      await loadData();
    } catch {
      setFormError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const isOk = await confirm(
      "Data adjustment akan dihapus dan stok akan dikembalikan ke kondisi semula secara otomatis.",
      "Hapus Adjustment Stok?",
      { destructive: true, confirmLabel: "Ya, Hapus & Revert Stok" }
    );

    if (!isOk) return;

    setDeletingId(id);
    try {
      const res = await fetchWithAuth(`/api/stock-adjustments?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadData();
      } else {
        alert("Gagal menghapus adjustment.");
      }
    } catch {
      alert("Terjadi kesalahan sistem.");
    } finally {
      setDeletingId(null);
    }
  }

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Analytics
  const totalDecreaseCost = useMemo(() => {
    return adjustments
      .filter(a => a.direction === "decrease")
      .reduce((sum, a) => sum + (a.totalCost || 0), 0);
  }, [adjustments]);

  const totalIncreaseCost = useMemo(() => {
    return adjustments
      .filter(a => a.direction === "increase")
      .reduce((sum, a) => sum + (a.totalCost || 0), 0);
  }, [adjustments]);

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter(a => {
      const isReasonMatch = reasonFilter === "all" || a.reasonCategory === reasonFilter;
      const isSearchMatch = !search || 
        a.itemName.toLowerCase().includes(search.toLowerCase()) || 
        (a.reasonCustom ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (a.recipientName ?? "").toLowerCase().includes(search.toLowerCase());
      return isReasonMatch && isSearchMatch;
    });
  }, [adjustments, reasonFilter, search]);

  const filteredItemOptions = itemsList.filter(i => 
    i.type === formType && i.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const selectedItemObj = itemsList.find(i => i.id === selectedItemId);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      {/* ── Native App Sticky Header ── */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/manager/inventory"
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">
                  Adjustment & Koreksi Stok
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  ERP Inventory Write-Off & Surplus Adjustment
                </p>
              </div>
            </div>

            <button
              onClick={openCreateModal}
              className="px-3.5 md:px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Plus size={16} /> Buat Adjustment
            </button>
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
              {formatMonthLabel(month)}
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
        
        {/* ── Executive Summary Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowDownRight size={14} className="text-rose-500" /> Total Write-Off (Pengurangan)
              </span>
              <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200">
                Biaya P&L
              </span>
            </div>
            <div className="text-2xl font-black text-slate-800 tabular-nums">
              {fmt(totalDecreaseCost)}
            </div>
            <p className="text-xs font-semibold text-slate-400">Total nilai barang rusak/sample/basi</p>
          </div>

          <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowUpRight size={14} className="text-emerald-500" /> Total Surplus (Penambahan)
              </span>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                Nilai Aset
              </span>
            </div>
            <div className="text-2xl font-black text-slate-800 tabular-nums">
              {fmt(totalIncreaseCost)}
            </div>
            <p className="text-xs font-semibold text-slate-400">Nilai penambahan stok dari opname/bonus</p>
          </div>

          <div className="bg-white rounded-2xl md:rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <SlidersHorizontal size={14} className="text-indigo-500" /> Total Jurnal Adjustment
              </span>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                Terverifikasi
              </span>
            </div>
            <div className="text-2xl font-black text-slate-800 tabular-nums">
              {adjustments.length} Transaksi
            </div>
            <p className="text-xs font-semibold text-slate-400">Riwayat audit perubahan stok di Firestore</p>
          </div>

        </div>

        {/* ── Filter & Search Controls ── */}
        <div className="bg-white rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-sm border border-slate-200/80 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              <select
                value={reasonFilter}
                onChange={e => setReasonFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/20"
              >
                <option value="all">Semua Alasan Adjustment</option>
                {REASON_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari item / penerima / alasan..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
              />
            </div>

          </div>
        </div>

        {/* ── Adjustments History List ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm space-y-2">
            <SlidersHorizontal size={32} className="text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Belum ada jurnal adjustment stok untuk bulan ini.</p>
            <p className="text-xs text-slate-400">Klik "+ Buat Adjustment" untuk mencatat pengeluaran sampel, barang rusak, atau koreksi opname.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredAdjustments.map(item => {
              const isIncrease = item.direction === "increase";
              const formattedDate = new Date(item.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
              const reasonObj = REASON_OPTIONS.find(r => r.value === item.reasonCategory);

              return (
                <div 
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex items-center justify-between gap-3 animate-in fade-in"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                      isIncrease ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
                    }`}>
                      {isIncrease ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-800 truncate">{item.itemName}</h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 border ${
                          isIncrease ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {isIncrease ? "+ Penambahan" : "- Pengurangan"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 mt-1">
                        <span>{formattedDate}</span>
                        <span>•</span>
                        <span className="font-bold text-slate-700">{reasonObj?.label || item.reasonCategory}</span>
                        {item.recipientName && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 flex items-center gap-0.5">
                              <User size={10} /> {item.recipientName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className={`text-sm md:text-base font-black tabular-nums block ${isIncrease ? "text-emerald-600" : "text-slate-800"}`}>
                        {isIncrease ? "+" : "-"}{item.qty} Item
                      </span>
                      {item.totalCost > 0 && (
                        <span className="text-[10px] font-bold text-slate-400 block">
                          Nett: {fmt(item.totalCost)}
                        </span>
                      )}
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

      {/* ── Modal Form Adjustment Stok ── */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl p-5 md:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                  <SlidersHorizontal size={16} />
                </div>
                <h2 className="text-base font-extrabold text-slate-800">Buat Adjustment Stok Baru</h2>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Type Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => { setFormType("ingredient"); setSelectedItemId(""); setItemSearch(""); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    formType === "ingredient" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Bahan Baku & Packaging
                </button>
                <button
                  type="button"
                  onClick={() => { setFormType("variant"); setSelectedItemId(""); setItemSearch(""); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    formType === "variant" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
                  }`}
                >
                  Varian Produk Jadi
                </button>
              </div>

              {/* Item Selection Dropdown */}
              <div className="relative" onClick={e => e.stopPropagation()}>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Pilih {formType === "variant" ? "Produk Varian" : "Bahan Baku / Packaging"} *
                </label>
                <input
                  type="text"
                  placeholder="Ketik untuk mencari nama item..."
                  value={itemSearch}
                  onChange={e => { setItemSearch(e.target.value); setSelectedItemId(""); setShowItemDropdown(true); }}
                  onFocus={() => setShowItemDropdown(true)}
                  onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                />

                {showItemDropdown && filteredItemOptions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-44 overflow-y-auto">
                    {filteredItemOptions.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedItemId(opt.id);
                          setItemSearch(opt.name);
                          setShowItemDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 flex items-center justify-between"
                      >
                        <span>{opt.name}</span>
                        <span className="text-[10px] text-slate-400">Stok: {opt.currentStock} {opt.unit}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Direction Toggle */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Arah Adjustment *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection("decrease")}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all border flex items-center justify-center gap-1.5 ${
                      direction === "decrease" 
                        ? "bg-rose-600 text-white border-rose-600 shadow-sm" 
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    <ArrowDownRight size={14} /> Pengurangan (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("increase")}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all border flex items-center justify-center gap-1.5 ${
                      direction === "increase" 
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    <ArrowUpRight size={14} /> Penambahan (+)
                  </button>
                </div>
              </div>

              {/* Qty Input */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Jumlah Item (Qty) *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="0"
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                  />
                  <span className="text-xs font-bold text-slate-500 w-16 text-right">
                    {selectedItemObj ? selectedItemObj.unit : "Unit"}
                  </span>
                </div>
              </div>

              {/* Reason Category */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Kategori Alasan *</label>
                <select
                  value={reasonCategory}
                  onChange={e => setReasonCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  {REASON_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Recipient / Custom Notes */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Penerima / Catatan Detil (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Nama Affiliate / Keterangan penyebab rusak..."
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>

              {/* Custom Date */}
              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Tanggal Tanggal Transaction</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-center">
                  {formError}
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : "Simpan & Update Stok Firestore"}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
