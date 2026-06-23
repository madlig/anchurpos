"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah } from "@/lib/utils";
import {
  Loader2, Beaker, Receipt, Plus, X, Check, AlertTriangle, Pencil,
} from "lucide-react";
import type { Ingredient, Expense } from "@/types";

type Tab = "bahan" | "pengeluaran";

export default function InventoryPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("bahan");
  const [loading, setLoading] = useState(false);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [newStockValue, setNewStockValue] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const token = await getToken();
      return fetch(url, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
      });
    },
    [getToken]
  );

  const loadIngredients = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/ingredients");
      if (res.ok) setIngredients(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, [fetchWithAuth]);

  const loadExpenses = useCallback(async () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    try {
      const res = await fetchWithAuth(`/api/expenses?month=${month}`);
      if (res.ok) setExpenses(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadIngredients(), loadExpenses()]).finally(() => setLoading(false));
  }, [loadIngredients, loadExpenses]);

  async function handleStockEdit(ingredientId: string) {
    const val = parseFloat(newStockValue);
    if (isNaN(val) || val < 0) return;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/ingredients/${ingredientId}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ newStock: val, note: stockNote || null }),
      });
      if (res.ok) {
        setEditingStock(null);
        setNewStockValue("");
        setStockNote("");
        await loadIngredients();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-4">Inventori</h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("bahan")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            tab === "bahan" ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
          }`}
        >
          <Beaker size={14} /> Bahan Baku
        </button>
        <button
          onClick={() => setTab("pengeluaran")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            tab === "pengeluaran" ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
          }`}
        >
          <Receipt size={14} /> Pengeluaran
        </button>
      </div>

      {tab === "bahan" && (
        <div className="space-y-3">
          {ingredients.length === 0 ? (
            <EmptyState label="Belum ada bahan baku" />
          ) : (
            ingredients.map((ing) => {
              const isLow = ing.currentStock < ing.minStock;
              const isEditing = editingStock === ing.id;
              return (
                <Card key={ing.id} className={`p-4 ${isLow ? "border-amber-300 bg-amber-50/30" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {isLow && <AlertTriangle size={14} className="text-amber-600" />}
                      <span className="font-semibold text-stone-900">{ing.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{ing.category}</Badge>
                  </div>
                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={newStockValue}
                          onChange={(e) => setNewStockValue(e.target.value)}
                          placeholder={`Stok baru (${ing.baseUnit})`}
                          className="flex-1"
                        />
                        <span className="self-center text-sm text-stone-500">{ing.baseUnit}</span>
                      </div>
                      <Input
                        value={stockNote}
                        onChange={(e) => setStockNote(e.target.value)}
                        placeholder="Catatan (opsional)"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleStockEdit(ing.id)}
                          disabled={submitting}
                          className="gap-1"
                        >
                          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Simpan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditingStock(null); setNewStockValue(""); setStockNote(""); }}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-4 text-sm">
                        <span className={`font-mono ${isLow ? "text-red-600 font-bold" : "text-stone-700"}`}>
                          {ing.currentStock.toLocaleString("id-ID")} {ing.baseUnit}
                        </span>
                        <span className="text-stone-400">min: {ing.minStock.toLocaleString("id-ID")}</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditingStock(ing.id);
                          setNewStockValue(String(ing.currentStock));
                        }}
                        className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "pengeluaran" && (
        <div>
          <Button
            onClick={() => setShowExpenseForm(!showExpenseForm)}
            className="mb-4 gap-1.5"
          >
            <Plus size={16} /> Catat Pengeluaran
          </Button>

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

          <div className="space-y-3 mt-4">
            {expenses.length === 0 ? (
              <EmptyState label="Belum ada pengeluaran bulan ini" />
            ) : (
              expenses.map((exp) => (
                <Card key={exp.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-stone-900">{exp.itemName}</span>
                    <span className="font-mono text-sm font-bold text-stone-900">
                      {formatRupiah(exp.totalPrice)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-500">
                    <Badge variant="outline" className="text-xs">{exp.category}</Badge>
                    {exp.qtyPurchased > 0 && (
                      <span>{exp.qtyPurchased} {exp.purchaseUnit}</span>
                    )}
                    <span>{exp.paymentMethod}</span>
                    {exp.supplier && <span>· {exp.supplier}</span>}
                  </div>
                  {exp.qtyInBaseUnit > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">
                      +{exp.qtyInBaseUnit.toLocaleString("id-ID")} (base unit) · {formatRupiah(exp.pricePerBaseUnit)}/unit
                    </p>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseForm({
  ingredients,
  fetchWithAuth,
  onSuccess,
  onCancel,
}: {
  ingredients: Ingredient[];
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [ingredientId, setIngredientId] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("bahan_baku");
  const [qtyPurchased, setQtyPurchased] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedIng = ingredients.find((i) => i.id === ingredientId);

  useEffect(() => {
    if (selectedIng) {
      setItemName(selectedIng.name);
      setPurchaseUnit(selectedIng.baseUnit);
    }
  }, [selectedIng]);

  const availableUnits = selectedIng
    ? [selectedIng.baseUnit, ...selectedIng.unitAlternatives.map((u) => u.unit)]
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetchWithAuth("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          ingredientId: ingredientId || null,
          itemName,
          category,
          qtyPurchased: qtyPurchased ? parseFloat(qtyPurchased) : null,
          purchaseUnit: purchaseUnit || null,
          totalPrice: parseFloat(totalPrice),
          paymentMethod,
          supplier,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan");
        return;
      }

      onSuccess();
    } catch {
      setError("Gagal menyimpan pengeluaran");
    } finally {
      setSubmitting(false);
    }
  }

  const categories = [
    { value: "bahan_baku", label: "Bahan Baku" },
    { value: "packaging", label: "Packaging" },
    { value: "operasional", label: "Operasional" },
    { value: "lain_lain", label: "Lainnya" },
  ];

  const payments = [
    { value: "cash", label: "Cash" },
    { value: "transfer", label: "Transfer" },
    { value: "qris", label: "QRIS" },
  ];

  return (
    <Card className="p-4 mb-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label className="text-xs">Kategori</Label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {categories.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  category === c.value
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {(category === "bahan_baku" || category === "packaging") && (
          <div>
            <Label className="text-xs">Bahan</Label>
            <select
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">Pilih bahan...</option>
              {ingredients
                .filter((i) => i.category === category)
                .map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
            </select>
          </div>
        )}

        <div>
          <Label className="text-xs">Nama Item</Label>
          <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Nama item" />
        </div>

        {ingredientId && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Jumlah Beli</Label>
              <Input
                type="number"
                step="any"
                value={qtyPurchased}
                onChange={(e) => setQtyPurchased(e.target.value)}
                placeholder="Qty"
              />
            </div>
            <div>
              <Label className="text-xs">Satuan</Label>
              <select
                value={purchaseUnit}
                onChange={(e) => setPurchaseUnit(e.target.value)}
                className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
              >
                {availableUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Total Harga (Rp)</Label>
          <Input
            type="number"
            value={totalPrice}
            onChange={(e) => setTotalPrice(e.target.value)}
            placeholder="Total harga"
          />
        </div>

        <div>
          <Label className="text-xs">Metode Bayar</Label>
          <div className="flex gap-2 mt-1">
            {payments.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPaymentMethod(p.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  paymentMethod === p.value
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs">Supplier (opsional)</Label>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Nama supplier" />
        </div>

        <div>
          <Label className="text-xs">Catatan (opsional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={submitting || !itemName || !totalPrice} className="gap-1">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Simpan
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Batal
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-400">
      {label}
    </div>
  );
}
