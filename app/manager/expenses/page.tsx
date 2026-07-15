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
  ShoppingBag,
  Box,
  Zap,
  Tag,
  Banknote,
  Building2,
  QrCode,
  FileText,
} from "lucide-react";
import type { Expense, Ingredient } from "@/types";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function getCategoryIcon(category: string, size = 16, active = false) {
  const color = active ? "text-white" : {
    bahan_baku: "text-pink-500",
    packaging: "text-blue-500",
    operasional: "text-amber-500",
    lain_lain: "text-slate-500",
  }[category] || "text-slate-500";

  switch (category) {
    case "bahan_baku":
      return <ShoppingBag size={size} className={color} />;
    case "packaging":
      return <Box size={size} className={color} />;
    case "operasional":
      return <Zap size={size} className={color} />;
    case "lain_lain":
    default:
      return <Tag size={size} className={color} />;
  }
}

function getPaymentMethodLabel(method: string, iconSize = 14, active = false) {
  const iconColor = active ? "text-white" : {
    cash: "text-emerald-600",
    transfer: "text-blue-600",
    qris: "text-indigo-600",
  }[method] || "text-slate-500";

  switch (method) {
    case "cash":
      return (
        <span className="flex items-center justify-center gap-1.5">
          <Banknote size={iconSize} className={iconColor} />
          <span>Tunai</span>
        </span>
      );
    case "transfer":
      return (
        <span className="flex items-center justify-center gap-1.5">
          <Building2 size={iconSize} className={iconColor} />
          <span>Transfer</span>
        </span>
      );
    case "qris":
      return (
        <span className="flex items-center justify-center gap-1.5">
          <QrCode size={iconSize} className={iconColor} />
          <span>QRIS</span>
        </span>
      );
    default:
      return <span>{method}</span>;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  bahan_baku: "Bahan Baku",
  packaging: "Packaging",
  operasional: "Operasional",
  lain_lain: "Lain-lain",
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
interface ExpenseItem {
  id: string;
  ingredientId: string | null;
  itemName: string;
  qty: string;
  purchaseUnit: string;
  totalCost: string;
  forceCreateNew?: boolean;
}

function ExpenseForm({
  ingredients,
  suppliers,
  loadSuppliers,
  fetchWithAuth,
  onSuccess,
  onCancel,
}: {
  ingredients: Ingredient[];
  suppliers: Supplier[];
  loadSuppliers: () => Promise<void>;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { alert, confirm } = useAlertConfirm();
  const [category, setCategory] = useState<"bahan_baku" | "packaging" | "operasional" | "lain_lain">("bahan_baku");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "qris">("cash");
  const [notes, setNotes] = useState("");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // States untuk input item aktif saat ini
  const [ingredientId, setIngredientId] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [showIngredientDropdown, setShowIngredientDropdown] = useState(false);

  // Keranjang belanja item untuk pengeluaran bulk
  const [itemsList, setItemsList] = useState<ExpenseItem[]>([]);

  // Autocomplete Supplier States
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [saveNewSupplier, setSaveNewSupplier] = useState(false);

  // Filter supplier untuk dropdown pencarian
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.toLowerCase().trim();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [suppliers, supplierSearch]);

  const isNewSupplier = useMemo(() => {
    const q = supplierSearch.toLowerCase().trim();
    return q && !selectedSupplier && !suppliers.some((s) => s.name.toLowerCase() === q);
  }, [suppliers, supplierSearch, selectedSupplier]);

  // Filter bahan baku untuk dropdown pencarian
  const filteredIngredients = useMemo(() => {
    const q = itemName.toLowerCase().trim();
    const catFiltered = ingredients.filter((i) => i.category === category && (i as any).isActive !== false);
    if (!q) return catFiltered.slice(0, 8);
    return catFiltered.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [ingredients, itemName, category]);

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
    setShowIngredientDropdown(false);
  };

  const isProductCategory = category === "bahan_baku" || category === "packaging" || category === "operasional";

  // Tambah item aktif ke keranjang belanja
  async function handleAddItem() {
    setError("");

    if (isProductCategory) {
      if (!itemName.trim()) {
        setError("Nama bahan baku/kemasan wajib diisi");
        return;
      }
      if (!qty || parseFloat(qty) <= 0) {
        setError("Jumlah pembelian (Qty) harus lebih dari 0");
        return;
      }
      if (!purchaseUnit.trim()) {
        setError("Satuan wajib diisi (misal: kg, gram, pcs)");
        return;
      }
    } else {
      if (!itemName.trim()) {
        setError("Deskripsi pengeluaran wajib diisi");
        return;
      }
    }

    if (!totalCost || parseFloat(totalCost) <= 0) {
      setError("Biaya item harus lebih dari 0");
      return;
    }

    // Resolving fuzzy matches interactively if manually entered
    // Resolving fuzzy matches interactively if manually entered
    let postIngredientId: string | null = ingredientId || null;
    let postItemName = ingredientId
      ? (ingredients.find((i) => i.id === ingredientId)?.name ?? itemName)
      : itemName.trim();
    let forceCreateNew = false;

    if (isProductCategory && !ingredientId) {
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
        const confirmUseExisting = await confirm(
          `Apakah Anda bermaksud menginput barang berikut yang sudah ada di database?\n- Nama: "${(closestMatch as Ingredient).name}"\n\nKlik "Konfirmasi" untuk menggunakan "${(closestMatch as Ingredient).name}"\nKlik "Batal" jika Anda ingin membuat bahan baru.`,
          "Gunakan Bahan Terdaftar?"
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

    const newItem: ExpenseItem = {
      id: Math.random().toString(),
      ingredientId: postIngredientId,
      itemName: postItemName,
      qty: isProductCategory ? qty : "1",
      purchaseUnit: isProductCategory ? purchaseUnit.trim() : "",
      totalCost,
      forceCreateNew,
    };

    setItemsList([...itemsList, newItem]);
    
    // Reset Form Input Item Aktif
    setIngredientId("");
    setItemName("");
    setQty("");
    setPurchaseUnit("");
    setTotalCost("");
  }

  // Hapus item dari keranjang belanja
  function handleRemoveItem(idToRemove: string) {
    setItemsList(itemsList.filter((item) => item.id !== idToRemove));
  }

  // Hitung total akumulasi pengeluaran
  const computedTotalCost = useMemo(() => {
    if (isProductCategory) {
      return itemsList.reduce((acc, item) => acc + (parseFloat(item.totalCost) || 0), 0);
    }
    return parseFloat(totalCost) || 0;
  }, [itemsList, totalCost, isProductCategory]);

  async function handleSubmit() {
    setError("");

    if (isProductCategory && itemsList.length === 0) {
      setError("Silakan tambah minimal 1 bahan/item belanja terlebih dahulu");
      return;
    }

    if (!isProductCategory && (!itemName.trim() || !totalCost || parseFloat(totalCost) <= 0)) {
      setError("Nama pengeluaran dan total biaya wajib diisi dengan benar");
      return;
    }

    setSaving(true);
    try {
      // 1. Simpan supplier baru terlebih dahulu jika dicentang dan di-input baru
      let finalSupplierName = selectedSupplier ? selectedSupplier.name : supplierSearch.trim();
      if (isNewSupplier && saveNewSupplier && supplierSearch.trim()) {
        const supRes = await fetchWithAuth("/api/suppliers", {
          method: "POST",
          body: JSON.stringify({ name: supplierSearch.trim() }),
        });
        if (supRes.ok) {
          const newSup = await supRes.json();
          finalSupplierName = newSup.name;
          await loadSuppliers();
        }
      }

      if (isProductCategory) {
        // Simpan semua item bahan baku / packaging secara bulk menggunakan Promise.all
        const promises = itemsList.map((item) => {
          return fetchWithAuth("/api/expenses", {
            method: "POST",
            body: JSON.stringify({
              ingredientId: item.ingredientId,
              itemName: item.itemName,
              category,
              qtyPurchased: parseFloat(item.qty),
              purchaseUnit: item.purchaseUnit,
              totalPrice: parseFloat(item.totalCost),
              paymentMethod,
              supplier: finalSupplierName || null,
              notes: notes.trim() || null,
              customDate: customDate || null,
              forceCreateNew: item.forceCreateNew ?? false,
            }),
          });
        });

        const results = await Promise.all(promises);
        const allOk = results.every((r) => r.ok);
        if (!allOk) {
          setError("Beberapa item belanja gagal disimpan. Periksa koneksi internet Anda.");
          setSaving(false);
          return;
        }
      } else {
        // Simpan single item operasional / lain-lain
        const res = await fetchWithAuth("/api/expenses", {
          method: "POST",
          body: JSON.stringify({
            ingredientId: null,
            itemName: itemName.trim(),
            category,
            qtyPurchased: null,
            purchaseUnit: null,
            totalPrice: parseFloat(totalCost),
            paymentMethod,
            supplier: finalSupplierName || null,
            notes: notes.trim() || null,
            customDate: customDate || null,
            forceCreateNew: false,
          }),
        });

        if (!res.ok) {
          const resData = await res.json();
          setError(resData.error ?? "Gagal menyimpan pengeluaran");
          setSaving(false);
          return;
        }
      }

      onSuccess();
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
                setTotalCost("");
                setPurchaseUnit("");
                setTotalCost("");
                setShowIngredientDropdown(false);
                setItemsList([]);
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
              <span className="mr-1.5 inline-flex items-center">{getCategoryIcon(cat, 14, category === cat)}</span>
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Detail Global / Nota */}
      <div className="grid grid-cols-2 gap-3">
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
        <div style={{ position: "relative" }}>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Supplier / Toko (Opsional)
          </label>
          {selectedSupplier ? (
            <div className="flex items-center justify-between h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
              <span className="font-semibold text-slate-700">{selectedSupplier.name}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedSupplier(null);
                  setSupplierSearch("");
                }}
                className="text-slate-400 hover:text-red-500 font-bold"
              >
                ✕
              </button>
            </div>
          ) : (
            <div>
              <Input
                type="text"
                placeholder="Cari atau ketik nama supplier..."
                value={supplierSearch}
                onChange={(e) => {
                  setSupplierSearch(e.target.value);
                  setShowSupplierDropdown(true);
                }}
                onFocus={() => setShowSupplierDropdown(true)}
                className="h-10 rounded-xl text-xs border-slate-200"
              />
              {showSupplierDropdown && supplierSearch.trim() && (
                <div 
                  className="absolute left-0 right-0 mt-1 z-30 max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-xl"
                  onMouseLeave={() => setShowSupplierDropdown(false)}
                >
                  {filteredSuppliers.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedSupplier(s);
                        setSupplierSearch(s.name);
                        setShowSupplierDropdown(false);
                      }}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      🏢 {s.name}
                    </div>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-400 italic">
                      Supplier tidak ditemukan
                    </div>
                  )}
                </div>
              )}
              {isNewSupplier && (
                <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveNewSupplier}
                    onChange={(e) => setSaveNewSupplier(e.target.checked)}
                    className="accent-pink-600 rounded"
                  />
                  <span className="text-[10px] font-bold text-pink-600">
                    Simpan & Daftarkan Master Supplier Baru
                  </span>
                </label>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Form Input Item/Bahan */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
        <p className="text-xxs font-extrabold text-slate-400 uppercase tracking-widest">
          {isProductCategory ? "Input Bahan / Kemasan Belanja" : "Detail Pengeluaran"}
        </p>

        {isProductCategory ? (
          <>
            <div style={{ position: "relative" }}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Cari atau Ketik Bahan Baku / Kemasan
              </label>
              <Input
                type="text"
                placeholder="Contoh: Gula Halus Super"
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  setIngredientId(""); // Reset ID jika user mengubah manual
                  setShowIngredientDropdown(true);
                }}
                onFocus={() => setShowIngredientDropdown(true)}
                className="h-10 rounded-xl text-xs border-slate-200 bg-white"
              />
              
              {showIngredientDropdown && itemName.trim() && (
                <div 
                  className="absolute left-0 right-0 mt-1 z-40 max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-xl"
                  onMouseLeave={() => setShowIngredientDropdown(false)}
                >
                  {filteredIngredients.map((ing) => (
                    <div
                      key={ing.id}
                      onClick={() => handleIngredientChange(ing.id)}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      📦 {ing.name} <span className="text-[9px] text-slate-400 font-normal">({ing.baseUnit})</span>
                    </div>
                  ))}
                  {filteredIngredients.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-400 italic">
                      Bahan tidak ditemukan. Sistem akan membuatkan master data baru saat disimpan.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                  Jumlah (Qty) & Satuan
                </label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    placeholder="Contoh: 10"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="h-10 rounded-xl text-xs border-slate-200 bg-white flex-1"
                  />
                  {(() => {
                    const selectedIng = ingredientId ? ingredients.find(i => i.id === ingredientId) : null;
                    const hasAlts = selectedIng && selectedIng.unitAlternatives && selectedIng.unitAlternatives.length > 0;
                    
                    if (hasAlts) {
                      return (
                        <select
                          value={purchaseUnit}
                          onChange={(e) => setPurchaseUnit(e.target.value)}
                          className="h-10 rounded-xl text-xs border border-slate-200 w-28 bg-white outline-none focus:border-pink-300 px-2"
                        >
                          <option value={selectedIng.baseUnit}>{selectedIng.baseUnit}</option>
                          {selectedIng.unitAlternatives!.map(alt => (
                            <option key={alt.unit} value={alt.unit}>{alt.unit}</option>
                          ))}
                        </select>
                      );
                    }
                    
                    return (
                      <Input
                        type="text"
                        placeholder="kg/gram"
                        value={purchaseUnit}
                        onChange={(e) => setPurchaseUnit(e.target.value)}
                        disabled={!!ingredientId}
                        className={`h-10 rounded-xl text-xs border-slate-200 w-20 ${!!ingredientId ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white"}`}
                      />
                    );
                  })()}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                  Harga (Rp)
                </label>
                <Input
                  type="number"
                  placeholder="25000"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  className="h-10 rounded-xl text-xs border-slate-200 bg-white"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleAddItem}
              className="w-full h-9 rounded-xl text-xxs font-bold bg-slate-800 text-white flex items-center justify-center gap-1 active:scale-[0.99] transition-all"
            >
              ➕ Tambah Bahan ke Daftar Nota
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Nama Pengeluaran / Deskripsi
              </label>
              <Input
                type="text"
                placeholder="Contoh: Bayar Listrik Toko Juni"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="h-10 rounded-xl text-xs border-slate-200 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                Total Biaya (Rp)
              </label>
              <Input
                type="number"
                placeholder="Contoh: 250000"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                className="h-10 rounded-xl text-xs border-slate-200 font-semibold bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Daftar Item / Cart (Hanya tampil untuk bahan baku / packaging) */}
      {isProductCategory && itemsList.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daftar Bahan Yang Akan Disimpan ({itemsList.length})</p>
          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
            {itemsList.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-semibold text-slate-800 truncate">{item.itemName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.qty} {item.purchaseUnit}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-bold text-slate-700">{fmt(parseFloat(item.totalCost))}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 active:scale-90 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              {getPaymentMethodLabel(method, 14, paymentMethod === method)}
            </button>
          ))}
        </div>
      </div>

      {/* Keterangan & Total Ringkasan Biaya */}
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Catatan Tambahan (Opsional)
          </label>
          <Input
            type="text"
            placeholder="Catatan tambahan nota"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-10 rounded-xl text-xs border-slate-200"
          />
        </div>

        {/* Total Keseluruhan Ringkasan */}
        <div className="p-3.5 rounded-2xl bg-pink-50/70 border border-pink-100 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-600">Total Pengeluaran Nota:</span>
          <span className="text-base font-extrabold text-pink-600 tabular-nums">{fmt(computedTotalCost)}</span>
        </div>
      </div>

      {/* Button Submit / Cancel */}
      <div className="flex gap-2.5 pt-2">
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 h-11 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)" }}
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin mr-1.5" />
              Menyimpan ({itemsList.length || 1} Item)...
            </>
          ) : (
            <>
              <Check size={14} className="mr-1.5" />
              Simpan Transaksi
            </>
          )}
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

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phoneNumber?: string;
}

export default function ExpensesPage() {
  const { getToken } = useAuth();
  const { alert, confirm } = useAlertConfirm();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  // States data
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/expenses?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) setExpenses(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, startDate, endDate]);

  const loadIngredients = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/ingredients");
      if (res.ok) setIngredients(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, [fetchWithAuth]);

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/suppliers");
      if (res.ok) setSuppliers(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, [fetchWithAuth]);

  // Initial load
  useEffect(() => {
    loadIngredients();
    loadSuppliers();
  }, [loadIngredients, loadSuppliers]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Delete transaction with stock reversion
  const handleDeleteExpense = async (id: string, itemName: string) => {
    const confirmed = await confirm(
      `Apakah Anda yakin ingin membatalkan pengeluaran "${itemName}"? Tindakan ini akan mengembalikan stok bahan baku terkait.`,
      "Batalkan Pengeluaran",
      { destructive: true, confirmLabel: "Ya, Batalkan", cancelLabel: "Batal" }
    );
    if (!confirmed) return;

    try {
      const res = await fetchWithAuth(`/api/expenses/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadExpenses();
        loadIngredients();
      } else {
        const d = await res.json();
        await alert(d.error ?? "Gagal membatalkan transaksi", "Gagal", "danger");
      }
    } catch {
      await alert("Kesalahan jaringan", "Kesalahan", "danger");
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
              <ShoppingBag size={14} className="text-pink-500" />
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-2">{fmt(summaryTotals.totalBahanBaku)}</p>
          </Card>

          <Card className="p-3 bg-white border-none rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Packaging</span>
              <Box size={14} className="text-blue-500" />
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-2">{fmt(summaryTotals.totalPackaging)}</p>
          </Card>

          <Card className="p-3 bg-white border-none rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Operasional</span>
              <Zap size={14} className="text-amber-500" />
            </div>
            <p className="text-xs font-extrabold text-slate-800 mt-2">{fmt(summaryTotals.totalOperasional)}</p>
          </Card>

          <Card className="p-3 bg-white border-none rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Lain-lain</span>
              <Tag size={14} className="text-slate-500" />
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
            suppliers={suppliers}
            loadSuppliers={loadSuppliers}
            fetchWithAuth={fetchWithAuth}
            onSuccess={() => {
              setShowExpenseForm(false);
              loadExpenses();
              loadIngredients();
              loadSuppliers();
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
                        <span className="inline-flex items-center">{getCategoryIcon(exp.category, 14)}</span>
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
                        {getPaymentMethodLabel(exp.paymentMethod)}
                      </span>
                    </div>
                  </div>

                  {exp.notes && (
                    <div className="mt-2.5 p-2 bg-slate-50 rounded-xl text-[10px] text-slate-500 font-medium border border-slate-100 flex items-start gap-1">
                      <FileText size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                      <span>{exp.notes}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-50">
                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                      <Calendar size={10} className="text-slate-400" />
                      <span>{new Date(exp.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
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
