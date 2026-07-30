"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { 
  Plus, Calendar, Search, CreditCard, Package, Loader2, X, Filter, User,
  ChevronLeft, ChevronRight, ShoppingBag, Store, Trash2, ArrowDownRight,
  Check, Building2, Tag, FileText, ShoppingCart
} from "lucide-react";

interface PurchaseItem {
  id: string;
  date: string;
  category: string;
  ingredientId: string;
  itemName: string;
  qtyPurchased: number;
  purchaseUnit: string;
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

interface UnitAlternative {
  unit: string;
  conversionToBase: number;
}

interface Ingredient {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  unitAlternatives: UnitAlternative[];
  currentStock: number;
}

interface CartItem {
  id: string;
  category: "bahan_baku" | "packaging";
  ingredientId: string;
  ingredientName: string;
  qtyPurchased: number;
  purchaseUnit: string;
  totalPrice: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatMonthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[mo - 1]} ${y}`;
}

export default function PurchasesPage() {
  const { getToken } = useAuth();
  const { alert } = useAlertConfirm();

  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  // Month selector state (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState<"all" | "bahan_baku" | "packaging">("all");
  const [search, setSearch] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // Cart Data inside Modal
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [formCategory, setFormCategory] = useState<"bahan_baku" | "packaging">("bahan_baku");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [qtyPurchased, setQtyPurchased] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [ingSearch, setIngSearch] = useState("");
  const [showIngDropdown, setShowIngDropdown] = useState(false);
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
      const [y, m] = selectedMonth.split("-").map(Number);
      const start = `${selectedMonth}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

      const [resP, resS, resI] = await Promise.all([
        fetchWithAuth(`/api/purchases?startDate=${start}&endDate=${end}`),
        fetchWithAuth("/api/suppliers"),
        fetchWithAuth("/api/ingredients"),
      ]);

      if (resP.ok) setPurchases(await resP.json());
      if (resS.ok) setSuppliers(await resS.json());
      if (resI.ok) setIngredients(await resI.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreateModal() {
    setCartItems([]);
    setSelectedSupplier(null);
    setSupplierSearch("");
    setPaymentMethod("cash");
    setNotes("");
    setCustomDate(new Date().toISOString().split("T")[0]);
    resetFormItem();
    setFormError("");
    setShowModal(true);
  }

  function resetFormItem() {
    setSelectedIngredient(null);
    setIngSearch("");
    setQtyPurchased("");
    setPurchaseUnit("");
    setTotalCost("");
  }

  function handleAddToCart() {
    setFormError("");
    const qty = parseFloat(qtyPurchased);
    const cost = parseInt(totalCost);

    if (!selectedIngredient) {
      setFormError("Pilih bahan atau kemasan terlebih dahulu");
      return;
    }
    if (!qty || qty <= 0) {
      setFormError("Jumlah belanja harus lebih dari 0");
      return;
    }
    if (!purchaseUnit.trim()) {
      setFormError("Pilih satuan belanja");
      return;
    }
    if (!cost || cost <= 0) {
      setFormError("Total harga item harus lebih dari 0");
      return;
    }

    const newItem: CartItem = {
      id: "cart_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      category: formCategory,
      ingredientId: selectedIngredient.id,
      ingredientName: selectedIngredient.name,
      qtyPurchased: qty,
      purchaseUnit: purchaseUnit.trim(),
      totalPrice: cost,
    };

    setCartItems(prev => [...prev, newItem]);
    resetFormItem();
  }

  async function handleSaveAllPurchases() {
    setFormError("");
    if (cartItems.length === 0) {
      setFormError("Tambahkan minimal 1 item belanja ke daftar");
      return;
    }

    setSaving(true);
    try {
      const supplierName = selectedSupplier ? selectedSupplier.name : supplierSearch.trim();

      for (const item of cartItems) {
        await fetchWithAuth("/api/purchases", {
          method: "POST",
          body: JSON.stringify({
            ingredientId: item.ingredientId,
            category: item.category,
            itemName: item.ingredientName,
            qtyPurchased: item.qtyPurchased,
            purchaseUnit: item.purchaseUnit,
            totalPrice: item.totalPrice,
            paymentMethod,
            supplier: supplierName,
            notes,
            customDate,
          }),
        });
      }

      setShowModal(false);
      await loadData();
    } catch {
      setFormError("Gagal menyimpan transaksi belanja");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetchWithAuth(`/api/purchases?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadData();
      } else {
        alert("Gagal menghapus data belanja.");
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

  // Filtered Purchases & Analytics
  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      const isCatMatch = categoryFilter === "all" || item.category === categoryFilter;
      const isSearchMatch = !search || 
        item.itemName.toLowerCase().includes(search.toLowerCase()) || 
        (item.supplier ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (item.notes ?? "").toLowerCase().includes(search.toLowerCase());
      return isCatMatch && isSearchMatch;
    });
  }, [purchases, categoryFilter, search]);

  const totalSpent = useMemo(() => {
    return purchases.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
  }, [purchases]);

  const totalItemCount = purchases.length;

  const availableUnits = useMemo(() => {
    if (!selectedIngredient) return [];
    const base = selectedIngredient.baseUnit;
    const alts = (selectedIngredient.unitAlternatives || []).map(u => u.unit);
    return Array.from(new Set([base, ...alts])).filter(Boolean);
  }, [selectedIngredient]);

  const filteredIngredients = ingredients.filter(ing => 
    ing.category === formCategory && ing.name.toLowerCase().includes(ingSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      {/* ── Native App Sticky Header ── */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto space-y-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                <ShoppingBag size={20} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">
                  Belanja
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  Pembelian Bahan Baku & Kemasan Outlet
                </p>
              </div>
            </div>

            <button
              onClick={openCreateModal}
              className="px-3.5 md:px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Plus size={16} /> Catat Belanja
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
        
        {/* ── Executive Summary Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-2">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <ShoppingBag size={14} className="text-amber-500" /> Total Pengeluaran Belanja
            </span>
            <div className="text-2xl font-black text-slate-800 tabular-nums">
              {fmt(totalSpent)}
            </div>
            <p className="text-xs font-semibold text-slate-400">Total akumulasi nota belanja bulan ini</p>
          </div>

          <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/80 space-y-2">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <Package size={14} className="text-emerald-500" /> Total Item Terbeli
            </span>
            <div className="text-2xl font-black text-slate-800 tabular-nums">
              {totalItemCount} Transaksi
            </div>
            <p className="text-xs font-semibold text-slate-400">Restok bahan baku & kemasan terproses</p>
          </div>

        </div>

        {/* ── Filter & Search Row ── */}
        <div className="bg-white rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-sm border border-slate-200/80 space-y-3">
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            {/* Category Filter Pills */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {[
                { id: "all", label: "Semua (" + purchases.length + ")" },
                { id: "bahan_baku", label: "Bahan Baku (" + purchases.filter(p => p.category === "bahan_baku").length + ")" },
                { id: "packaging", label: "Kemasan (" + purchases.filter(p => p.category === "packaging").length + ")" },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setCategoryFilter(t.id as any)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    categoryFilter === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
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
                placeholder="Cari item / supplier / catatan..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

        </div>

        {/* ── Purchases Item List ── */}
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 bg-white rounded-2xl border border-slate-200/80 p-4" />
            <div className="h-20 bg-white rounded-2xl border border-slate-200/80 p-4" />
            <div className="h-20 bg-white rounded-2xl border border-slate-200/80 p-4" />
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm space-y-2">
            <ShoppingBag size={32} className="text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Belum ada catatan Belanja untuk bulan ini.</p>
            <p className="text-xs text-slate-400">Klik "+ Catat Belanja" untuk mencatat restok bahan baku atau kemasan baru.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredPurchases.map(item => {
              const formattedDate = new Date(item.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
              const isPkg = item.category === "packaging";

              return (
                <div 
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex items-center justify-between gap-3 animate-in fade-in"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                      isPkg ? "bg-cyan-50 border-cyan-100 text-cyan-600" : "bg-amber-50 border-amber-100 text-amber-600"
                    }`}>
                      {isPkg ? <Package size={18} /> : <ShoppingBag size={18} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-800 truncate">{item.itemName}</h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 border ${
                          isPkg ? "bg-cyan-50 text-cyan-700 border-cyan-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {isPkg ? "Kemasan" : "Bahan Baku"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 mt-1">
                        <span>{formattedDate}</span>
                        <span>•</span>
                        <span className="font-bold text-slate-700">{item.qtyPurchased} {item.purchaseUnit}</span>
                        {item.supplier && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 flex items-center gap-0.5">
                              <Store size={10} /> {item.supplier}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sm md:text-base font-black text-slate-800 tabular-nums block">
                        {fmt(item.totalPrice)}
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

      {/* ── Modal Batch Restok Belanja ── */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-xl bg-white rounded-t-3xl md:rounded-3xl p-5 md:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShoppingBag size={16} />
                </div>
                <h2 className="text-base font-extrabold text-slate-800">Catat Belanja Bahan & Kemasan</h2>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Supplier & Tanggal Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Supplier / Toko</label>
                  <input
                    type="text"
                    placeholder="Pilih atau ketik nama toko/supplier..."
                    value={supplierSearch}
                    onChange={e => { setSupplierSearch(e.target.value); setSelectedSupplier(null); setShowSupplierDropdown(true); }}
                    onFocus={() => { setShowSupplierDropdown(true); setShowIngDropdown(false); }}
                    onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  {showSupplierDropdown && suppliers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-36 overflow-y-auto">
                      {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={() => { setSelectedSupplier(s); setSupplierSearch(s.name); setShowSupplierDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors border-b border-slate-50 last:border-0"
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Tanggal Belanja</label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Form Input Item */}
              <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1">
                    <Plus size={14} className="text-amber-600" /> Tambah Item Ke Daftar Nota
                  </span>

                  <div className="flex bg-white p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => { setFormCategory("bahan_baku"); resetFormItem(); }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                        formCategory === "bahan_baku" ? "bg-amber-600 text-white" : "text-slate-500"
                      }`}
                    >
                      Bahan Baku
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFormCategory("packaging"); resetFormItem(); }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                        formCategory === "packaging" ? "bg-cyan-600 text-white" : "text-slate-500"
                      }`}
                    >
                      Kemasan
                    </button>
                  </div>
                </div>

                <div className="relative" onClick={e => e.stopPropagation()}>
                  <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Pilih Item ({formCategory === "packaging" ? "Kemasan" : "Bahan"}) *</label>
                  <input
                    type="text"
                    placeholder={`Ketik nama ${formCategory === "packaging" ? "kemasan" : "bahan"}...`}
                    value={ingSearch}
                    onChange={e => { setIngSearch(e.target.value); setSelectedIngredient(null); setShowIngDropdown(true); }}
                    onFocus={() => { setShowIngDropdown(true); setShowSupplierDropdown(false); }}
                    onBlur={() => setTimeout(() => setShowIngDropdown(false), 200)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />

                  {showIngDropdown && filteredIngredients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-40 overflow-y-auto">
                      {filteredIngredients.map(ing => (
                        <button
                          key={ing.id}
                          type="button"
                          onMouseDown={() => {
                            setSelectedIngredient(ing);
                            setIngSearch(ing.name);
                            setPurchaseUnit(ing.baseUnit);
                            setShowIngDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors border-b border-slate-50 flex items-center justify-between"
                        >
                          <span>{ing.name}</span>
                          <span className="text-[10px] text-slate-400">Stok: {ing.currentStock} {ing.baseUnit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Jumlah</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={qtyPurchased}
                      onChange={e => setQtyPurchased(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Satuan</label>
                    <select
                      value={purchaseUnit}
                      onChange={e => setPurchaseUnit(e.target.value)}
                      className="w-full h-10 px-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      {availableUnits.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Total Biaya (Rp)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={totalCost}
                      onChange={e => setTotalCost(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Masukkan Ke Daftar Item Nota
                </button>
              </div>

              {/* Cart Items List */}
              {cartItems.length > 0 && (
                <div className="space-y-2">
                  <span className="font-extrabold text-slate-600 uppercase tracking-wider text-[11px] block">
                    Daftar Item Belanja ({cartItems.length})
                  </span>

                  <div className="space-y-1.5">
                    {cartItems.map((c, idx) => (
                      <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{c.ingredientName}</p>
                          <p className="text-[11px] text-slate-500">{c.qtyPurchased} {c.purchaseUnit}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-800 text-xs">{fmt(c.totalPrice)}</span>
                          <button
                            onClick={() => setCartItems(prev => prev.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex justify-between items-center text-xs font-black text-slate-800">
                    <span>TOTAL SELURUH ITEM:</span>
                    <span className="text-amber-700 text-sm">{fmt(cartItems.reduce((s, i) => s + i.totalPrice, 0))}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Metode Pembayaran</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="cash">Tunai / Cash Laci</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="qris">QRIS / E-Wallet</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Catatan Nota (Opsional)</label>
                <input
                  type="text"
                  placeholder="Catatan nomor nota / toko / keterangan..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full h-10 px-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-center">
                  {formError}
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleSaveAllPurchases}
                  disabled={saving || cartItems.length === 0}
                  className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : "Simpan Semua Nota Belanja"}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
