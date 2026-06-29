"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Plus,
  Check,
  Search,
  Calendar,
  Trash2,
  ArrowRight,
  TrendingDown,
  Inbox,
} from "lucide-react";
import type { Expense, Ingredient } from "@/types";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const CATEGORY_ICONS: Record<string, string> = {
  bahan_baku: "🧈",
  packaging: "📦",
  operasional: "🔌",
  lain_lain: "🏷️",
};

const CATEGORY_LABELS: Record<string, string> = {
  bahan_baku: "Bahan Baku",
  packaging: "Packaging",
  operasional: "Operasional",
  lain_lain: "Lain-lain",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "💵 Tunai",
  transfer: "🏦 Transfer",
  qris: "📱 QRIS",
};

// Form pencatatan pengeluaran premium
function clientGetSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;

  // Simple Levenshtein inline
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) tmp[i] = [i];
  for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = a[i - 1] === b[j - 1] 
        ? tmp[i - 1][j - 1] 
        : Math.min(tmp[i - 1][j] + 1, tmp[i][j - 1] + 1, tmp[i - 1][j - 1] + 1);
    }
  }
  const distance = tmp[a.length][b.length];
  return (longer.length - distance) / longer.length;
}

// Form pencatatan pengeluaran premium
function ExpenseForm({
  ingredients,
  fetchWithAuth,
  onSuccess,
  onCancel,
}: {
  ingredients: Ingredient[];
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<"bahan_baku" | "packaging" | "operasional" | "lain_lain">("bahan_baku");
  const [ingredientId, setIngredientId] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "qris">("cash");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  // Toggle input manual untuk bahan baku / packaging
  const [isManualInput, setIsManualInput] = useState(false);

  // Auto-fill nama barang jika memilih bahan baku
  const handleIngredientChange = (id: string) => {
    setIngredientId(id);
    const ing = ingredients.find((i) => i.id === id);
    if (ing) {
      setItemName(ing.name);
      setPurchaseUnit(ing.baseUnit);
    } else {
      setItemName("");
      setPurchaseUnit("");
    }
  };

  async function handleSubmit() {
    setError("");
    const isProductCategory = category === "bahan_baku" || category === "packaging";

    if (isProductCategory && !isManualInput) {
      if (!ingredientId) {
        setError("Pilih bahan baku/kemasan terlebih dahulu");
        return;
      }
      if (!qty || parseFloat(qty) <= 0) {
        setError("Jumlah pembelian harus lebih dari 0");
        return;
      }
    } else if (isProductCategory && isManualInput) {
      if (!itemName.trim()) {
        setError("Nama bahan baru wajib diisi");
        return;
      }
      if (!qty || parseFloat(qty) <= 0) {
        setError("Jumlah pembelian harus lebih dari 0");
        return;
      }
      if (!purchaseUnit.trim()) {
        setError("Satuan pembelian wajib diisi (misal: kg, gram, pcs)");
        return;
      }
    } else {
      if (!itemName.trim()) {
        setError("Nama pengeluaran wajib diisi");
        return;
      }
    }

    if (!totalCost || parseFloat(totalCost) <= 0) {
      setError("Total biaya harus lebih dari 0");
      return;
    }

    // Resolving fuzzy matches interactively if manually entered
    let postIngredientId: string | null = (isProductCategory && !isManualInput) ? ingredientId : null;
    let postItemName = (isProductCategory && !isManualInput)
      ? (ingredients.find((i) => i.id === ingredientId)?.name ?? itemName)
      : itemName.trim();
    let forceCreateNew = false;

    if (isProductCategory && isManualInput) {
      let highestSim = 0;
      let closestMatch: Ingredient | null = null;

      ingredients
        .filter((i) => i.category === category)
        .forEach((i) => {
          const sim = clientGetSimilarity(itemName, i.name);
          if (sim > highestSim) {
            highestSim = sim;
            closestMatch = i;
          }
        });

      if (highestSim >= 0.85 && closestMatch) {
        const confirmUseExisting = window.confirm(
          `Apakah Anda bermaksud menginput barang berikut yang sudah ada di database?\n- Nama: "${(closestMatch as Ingredient).name}"\n\nKlik "OK" untuk menggunakan "${(closestMatch as Ingredient).name}"\nKlik "Batal/Cancel" jika Anda ingin membuat bahan baru.`
        );

        if (confirmUseExisting) {
          postIngredientId = (closestMatch as Ingredient).id;
          postItemName = (closestMatch as Ingredient).name;
          forceCreateNew = false;
        } else {
          postIngredientId = null;
          forceCreateNew = true;
        }
      } else {
        forceCreateNew = true;
      }
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          ingredientId: postIngredientId,
          itemName: postItemName,
          category,
          qtyPurchased: isProductCategory ? parseFloat(qty) : null,
          purchaseUnit: isProductCategory ? purchaseUnit.trim() : null,
          totalPrice: parseFloat(totalCost),
          paymentMethod,
          supplier: supplier.trim() || null,
          notes: notes.trim() || null,
          customDate: customDate || null,
          forceCreateNew,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan pengeluaran");
      } else {
        onSuccess();
      }
    } catch (err) {
      setError("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 border border-pink-100 bg-white shadow-lg space-y-4 rounded-3xl">
      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
        <p className="text-sm font-bold text-slate-800">Catat Pengeluaran Baru</p>
        <span style={{ fontSize: "18px" }}>📝</span>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600">
          ⚠ {error}
        </div>
      )}

      {/* Kategori Selector Pills */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
          Kategori Pengeluaran
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {(["bahan_baku", "packaging", "operasional", "lain_lain"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategory(cat);
                setIngredientId("");
                setItemName("");
                setQty("");
                setPurchaseUnit("");
                setIsManualInput(false);
              }}
              style={{
                padding: "8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: "700",
                border: "none",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
                color: category === cat ? "#fff" : "#64748B",
                background: category === cat ? "#E85D8C" : "#F1F5F9",
              }}
            >
              <span className="mr-1">{CATEGORY_ICONS[cat]}</span>
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Fields berdasarkan Kategori */}
      <div className="space-y-3">
        {(category === "bahan_baku" || category === "packaging") ? (
          <>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {isManualInput ? "Nama Bahan Baru (Manual)" : "Pilih Bahan / Kemasan"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualInput(!isManualInput);
                    setIngredientId("");
                    setItemName("");
                    setPurchaseUnit("");
                  }}
                  className="text-[10px] font-bold text-pink-600 hover:text-pink-700 underline"
                >
                  {isManualInput ? "Pilih dari database" : "✍ Tulis manual bahan baru"}
                </button>
              </div>

              {isManualInput ? (
                <div>
                  <Input
                    type="text"
                    placeholder="Contoh: Gula Halus Super"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="h-10 rounded-xl text-xs border-slate-200"
                    data-testid="expense-manual-item-name"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">
                    * Sistem akan mencocokkan kemiripan nama secara otomatis. Jika tidak ada yang mirip, akan dibuatkan master data bahan baku baru di database.
                  </p>
                </div>
              ) : (
                <select
                  value={ingredientId}
                  onChange={(e) => handleIngredientChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs bg-white outline-none focus:border-pink-300"
                  data-testid="expense-ingredient-select"
                >
                  <option value="">-- Pilih dari database --</option>
                  {ingredients
                    .filter((i) => i.category === category && (i as any).isActive !== false)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.baseUnit})
                      </option>
                    ))}
                </select>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                  Jumlah (Qty)
                </label>
                <Input
                  type="number"
                  placeholder="Contoh: 10"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="h-10 rounded-xl text-xs border-slate-200"
                />
              </div>
              <div className="w-1/3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                  Satuan
                </label>
                <Input
                  type="text"
                  placeholder="kg / gram / pcs"
                  value={purchaseUnit}
                  onChange={(e) => setPurchaseUnit(e.target.value)}
                  disabled={!isManualInput && !!ingredientId}
                  className={`h-10 rounded-xl text-xs border-slate-200 ${(!isManualInput && !!ingredientId) ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white"}`}
                />
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Nama Pengeluaran / Deskripsi
            </label>
            <Input
              type="text"
              placeholder="Contoh: Bayar Listrik Toko Juni"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="h-10 rounded-xl text-xs border-slate-200"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Total Biaya (Rp)
            </label>
            <Input
              type="number"
              placeholder="Contoh: 250000"
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              className="h-10 rounded-xl text-xs border-slate-200 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Tanggal Transaksi
            </label>
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-10 rounded-xl text-xs border-slate-200"
            />
          </div>
        </div>

        {/* Metode Pembayaran */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
            Metode Pembayaran
          </label>
          <div className="flex gap-2">
            {(["cash", "transfer", "qris"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "700",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  color: paymentMethod === method ? "#fff" : "#64748B",
                  background: paymentMethod === method ? "#E85D8C" : "#F1F5F9",
                }}
              >
                {PAYMENT_METHOD_LABELS[method]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Supplier / Toko (Opsional)
            </label>
            <Input
              type="text"
              placeholder="Nama Supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="h-10 rounded-xl text-xs border-slate-200"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Catatan Keterangan (Opsional)
            </label>
            <Input
              type="text"
              placeholder="Catatan tambahan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10 rounded-xl text-xs border-slate-200"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2.5 pt-2">
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 h-11 rounded-xl text-xs font-bold text-white"
          style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)" }}
          data-testid="save-expense-btn"
        >
          {saving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
          Simpan Transaksi
        </Button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "0 18px",
            borderRadius: "12px",
            background: "#F1F5F9",
            color: "#64748B",
            fontSize: "12px",
            fontWeight: "700",
            border: "none",
            cursor: "pointer",
          }}
        >
          Batal
        </button>
      </div>
    </Card>
  );
}

export default function ExpensesPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  // States data
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Filter Tanggal Range (Default: Tanggal 15 bulan ini s.d Hari ini)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${year}-${String(month).padStart(2, "0")}-15`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const token = await getToken();
      return fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
    },
    [getToken]
  );

  const loadIngredients = useCallback(async () => {
    const res = await fetchWithAuth("/api/ingredients");
    if (res.ok) setIngredients(await res.json());
  }, [fetchWithAuth]);

  // Load all expenses between date range
  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/expenses`);
      if (res.ok) {
        const allData: Expense[] = await res.json();
        // Filter di client berdasarkan start & end date kustom
        const filtered = allData.filter((e) => {
          const expDate = e.date.split("T")[0];
          return expDate >= startDate && expDate <= endDate;
        });
        setExpenses(filtered);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, startDate, endDate]);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Delete transaction with stock reversion
  const handleDeleteExpense = async (id: string, itemName: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan pengeluaran "${itemName}"? Tindakan ini akan mengembalikan stok bahan baku terkait.`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/api/expenses/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadExpenses();
        loadIngredients();
      } else {
        const d = await res.json();
        alert(d.error ?? "Gagal membatalkan transaksi");
      }
    } catch {
      alert("Kesalahan jaringan");
    }
  };

  // Kalkulasi total pengeluaran secara interaktif
  const summaryTotals = useMemo(() => {
    let totalAll = 0;
    let totalBahanBaku = 0;
    let totalPackaging = 0;
    let totalOperasional = 0;
    let totalLainLain = 0;

    expenses.forEach((e) => {
      totalAll += e.totalPrice;
      if (e.category === "bahan_baku") totalBahanBaku += e.totalPrice;
      else if (e.category === "packaging") totalPackaging += e.totalPrice;
      else if (e.category === "operasional") totalOperasional += e.totalPrice;
      else totalLainLain += e.totalPrice;
    });

    return { totalAll, totalBahanBaku, totalPackaging, totalOperasional, totalLainLain };
  }, [expenses]);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#FCABB4" }}>
      {/* ── Header Premium ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-pink-100 border-opacity-40">
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Catatan Pengeluaran</h1>
              <p className="text-xxs font-bold text-slate-400 mt-0.5">SINKRONISASI STOK & OPERASIONAL</p>
            </div>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </div>

          {/* Filter Tanggal Range */}
          <div className="mt-3 flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-2xl">
            <Calendar size={13} className="text-slate-400 flex-shrink-0" />
            <div className="flex-1 flex items-center gap-1.5 text-xxs font-bold text-slate-600">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent outline-none w-[92px]"
              />
              <ArrowRight size={10} className="text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent outline-none w-[92px]"
              />
            </div>
            <button
              onClick={loadExpenses}
              className="text-[9px] font-extrabold text-white bg-pink-500 hover:bg-pink-600 px-2 py-1 rounded-lg active:scale-95 transition-all"
            >
              Terapkan
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4 md:px-8 md:max-w-4xl">
        {/* ── Dashboard Ringkasan Kategori ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="p-3 bg-white border-none rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Bahan Baku</span>
              <span className="text-[14px]">🧈</span>
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-2">{fmt(summaryTotals.totalBahanBaku)}</p>
          </Card>

          <Card className="p-3 bg-white border-none rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Packaging</span>
              <span className="text-[14px]">📦</span>
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-2">{fmt(summaryTotals.totalPackaging)}</p>
          </Card>

          <Card className="p-3 bg-white border-none rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Operasional</span>
              <span className="text-[14px]">🔌</span>
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-2">{fmt(summaryTotals.totalOperasional)}</p>
          </Card>

          <Card className="p-3 bg-white border-none rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Lain-lain</span>
              <span className="text-[14px]">🏷️</span>
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-2">{fmt(summaryTotals.totalLainLain)}</p>
          </Card>
        </div>

        {/* ── Total Pengeluaran Banner ── */}
        <div
          className="p-4 rounded-3xl flex items-center justify-between shadow-sm text-white"
          style={{
            background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
            boxShadow: "0 8px 24px rgba(232,93,140,0.25)",
          }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-pink-100">Total Pengeluaran Periode Ini</p>
            <h2 className="text-lg font-black mt-1">{fmt(summaryTotals.totalAll)}</h2>
          </div>
          <TrendingDown className="h-6 w-6 text-pink-100 opacity-80" />
        </div>

        {/* ── Tombol Tambah ── */}
        {!showExpenseForm && (
          <button
            onClick={() => setShowExpenseForm(true)}
            className="flex items-center justify-center gap-2 h-11 w-full bg-white text-slate-800 text-xs font-extrabold rounded-2xl border border-pink-100 border-opacity-40 active:scale-[0.98] transition-all hover:bg-slate-50"
            data-testid="add-expense-button"
          >
            <Plus size={14} className="text-pink-500" /> Catat Pengeluaran Baru
          </button>
        )}

        {/* ── Form Modal/Sheet ── */}
        {showExpenseForm && (
          <ExpenseForm
            ingredients={ingredients}
            fetchWithAuth={fetchWithAuth}
            onSuccess={() => {
              setShowExpenseForm(false);
              loadExpenses();
              loadIngredients();
            }}
            onCancel={() => setShowExpenseForm(false)}
          />
        )}

        {/* ── Search Bar ── */}
        <div className="flex items-center gap-2 p-3 bg-white border border-pink-100 border-opacity-40 rounded-2xl">
          <Search size={13} className="text-slate-400" />
          <input
            type="text"
            placeholder="Cari transaksi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-xs outline-none bg-transparent"
            data-testid="expense-search"
          />
        </div>

        {/* ── Daftar Feed Transaksi ── */}
        <div className="flex flex-col gap-2.5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-pink-50 border-opacity-30">
              <Inbox className="mx-auto text-slate-300 mb-2" size={32} />
              <p className="text-xs text-slate-400 font-semibold">Tidak ada transaksi pengeluaran pada periode ini</p>
            </div>
          ) : (
            expenses
              .filter((e) => !searchQuery || e.itemName.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((exp) => (
                <div
                  key={exp.id}
                  className="bg-white p-4 rounded-3xl border border-slate-50 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs">{CATEGORY_ICONS[exp.category]}</span>
                        <p className="text-xs font-bold text-slate-800">{exp.itemName}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">
                        {exp.qtyPurchased ? `${exp.qtyPurchased} ${exp.purchaseUnit}` : ""}
                        {exp.supplier ? ` · Supplier: ${exp.supplier}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-red-500">-{fmt(exp.totalPrice)}</p>
                      <span className="text-[9px] font-bold bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                        {PAYMENT_METHOD_LABELS[exp.paymentMethod] || exp.paymentMethod}
                      </span>
                    </div>
                  </div>

                  {exp.notes && (
                    <div className="mt-2.5 p-2 bg-slate-50 rounded-xl text-[10px] text-slate-500 font-medium border border-slate-100">
                      📝 {exp.notes}
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-50">
                    <span className="text-[9px] font-bold text-slate-400">
                      📅 {new Date(exp.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <button
                      onClick={() => handleDeleteExpense(exp.id, exp.itemName)}
                      className="text-[9px] text-red-500 hover:text-red-700 font-bold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg"
                    >
                      <Trash2 size={10} /> Batalkan
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
