"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah } from "@/lib/utils";
import { Loader2, Beaker, Receipt, Plus, X, Check, AlertTriangle, Pencil, ChevronDown } from "lucide-react";
import type { Ingredient, Expense } from "@/types";

type Tab = "bahan" | "pengeluaran";

const CHIP = (active: boolean) =>
  `min-h-[40px] px-4 py-2 rounded-full text-sm font-semibold transition-all tap-target ${
    active ? "text-white" : "text-stone-500"
  }`;

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

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadIngredients = useCallback(async () => {
    const res = await fetchWithAuth("/api/ingredients");
    if (res.ok) setIngredients(await res.json());
  }, [fetchWithAuth]);

  const loadExpenses = useCallback(async () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const res = await fetchWithAuth(`/api/expenses?month=${month}`);
    if (res.ok) setExpenses(await res.json());
  }, [fetchWithAuth]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadIngredients(), loadExpenses()]).finally(() => setLoading(false));
  }, [loadIngredients, loadExpenses]);

  async function handleStockEdit(id: string) {
    const val = parseFloat(newStockValue);
    if (isNaN(val) || val < 0) return;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/ingredients/${id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ newStock: val, note: stockNote || null }),
      });
      if (res.ok) { setEditingStock(null); setNewStockValue(""); setStockNote(""); await loadIngredients(); }
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} /></div>;

  return (
    <div className="px-5 pt-6 pb-4 max-w-md mx-auto page-enter">
      <h1 className="text-2xl font-extrabold tracking-tight mb-5" style={{ color: "#1C1C1E" }}>Inventori</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([["bahan", "Bahan Baku", Beaker], ["pengeluaran", "Pengeluaran", Receipt]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={CHIP(tab === key)} style={tab === key ? { background: "linear-gradient(135deg,#E85D8C,#C94A73)" } : { background: "#fff", border: "1px solid #E2E8F0" }} data-testid={`tab-${key}`}>
            <span className="flex items-center gap-1.5"><Icon size={14} />{label}</span>
          </button>
        ))}
      </div>

      {tab === "bahan" && (
        <div className="space-y-3">
          {ingredients.length === 0 ? <EmptyState label="Belum ada bahan baku" /> : ingredients.map((ing) => {
            const isLow = ing.currentStock < ing.minStock;
            const isEditing = editingStock === ing.id;
            return (
              <div key={ing.id} className="rounded-2xl p-4" style={{ background: "#fff", border: `1px solid ${isLow ? "#FECACA" : "#F1F5F9"}`, background: isLow ? "#FEF2F2" : "#fff" } as React.CSSProperties} data-testid={`ingredient-${ing.id}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {isLow && <AlertTriangle size={14} style={{ color: "#DC2626" }} />}
                    <span className="font-semibold text-sm" style={{ color: "#1C1C1E" }}>{ing.name}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: "#64748B", background: "#F1F5F9" }}>{ing.category}</span>
                </div>
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <Input type="number" value={newStockValue} onChange={(e) => setNewStockValue(e.target.value)} placeholder={`Stok baru (${ing.baseUnit})`} className="flex-1 h-11 rounded-xl border-stone-200" />
                      <span className="self-center text-sm" style={{ color: "#64748B" }}>{ing.baseUnit}</span>
                    </div>
                    <Input value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="Catatan (opsional)" className="h-11 rounded-xl border-stone-200" />
                    <div className="flex gap-2">
                      <button onClick={() => handleStockEdit(ing.id)} disabled={submitting} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white tap-target" style={{ background: "#E85D8C" }}>
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan
                      </button>
                      <button onClick={() => { setEditingStock(null); setNewStockValue(""); setStockNote(""); }} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "#F1F5F9", color: "#64748B" }}>
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-bold font-mono tabular-nums" style={{ color: isLow ? "#DC2626" : "#334155" }}>
                        {ing.currentStock.toLocaleString("id-ID")} {ing.baseUnit}
                      </span>
                      <span style={{ color: "#94A3B8" }}>min: {ing.minStock.toLocaleString("id-ID")}</span>
                    </div>
                    <button onClick={() => { setEditingStock(ing.id); setNewStockValue(String(ing.currentStock)); }} className="p-2 rounded-xl tap-target" style={{ background: "#F8FAFC" }}>
                      <Pencil size={14} style={{ color: "#94A3B8" }} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "pengeluaran" && (
        <div>
          <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-2xl text-sm font-bold text-white tap-target" style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)" }} data-testid="add-expense-button">
            <Plus size={16} /> Catat Pengeluaran
          </button>
          {showExpenseForm && (
            <ExpenseForm ingredients={ingredients} fetchWithAuth={fetchWithAuth}
              onSuccess={() => { setShowExpenseForm(false); loadExpenses(); loadIngredients(); }}
              onCancel={() => setShowExpenseForm(false)} />
          )}
          <div className="space-y-3 mt-2">
            {expenses.length === 0 ? <EmptyState label="Belum ada pengeluaran bulan ini" /> : expenses.map((exp) => (
              <div key={exp.id} className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm" style={{ color: "#1C1C1E" }}>{exp.itemName}</span>
                  <span className="font-bold text-sm tabular-nums" style={{ color: "#1C1C1E" }}>{formatRupiah(exp.totalPrice)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: "#64748B" }}>
                  <span className="px-2 py-0.5 rounded-full" style={{ background: "#F1F5F9" }}>{exp.category}</span>
                  {exp.qtyPurchased > 0 && <span>{exp.qtyPurchased} {exp.purchaseUnit}</span>}
                  <span>{exp.paymentMethod}</span>
                </div>
                {exp.qtyInBaseUnit > 0 && (
                  <p className="text-xs mt-1 font-medium" style={{ color: "#E85D8C" }}>
                    +{exp.qtyInBaseUnit.toLocaleString("id-ID")} unit · {formatRupiah(exp.pricePerBaseUnit)}/unit
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseForm({ ingredients, fetchWithAuth, onSuccess, onCancel }: {
  ingredients: Ingredient[];
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
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
  useEffect(() => { if (selectedIng) { setItemName(selectedIng.name); setPurchaseUnit(selectedIng.baseUnit); } }, [selectedIng]);
  const availableUnits = selectedIng ? [selectedIng.baseUnit, ...selectedIng.unitAlternatives.map((u) => u.unit)] : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/expenses", {
        method: "POST",
        body: JSON.stringify({ ingredientId: ingredientId || null, itemName, category, qtyPurchased: qtyPurchased ? parseFloat(qtyPurchased) : null, purchaseUnit: purchaseUnit || null, totalPrice: parseFloat(totalPrice), paymentMethod, supplier, notes }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
      onSuccess();
    } catch { setError("Gagal menyimpan"); } finally { setSubmitting(false); }
  }

  const categories = [{ value: "bahan_baku", label: "Bahan Baku" }, { value: "packaging", label: "Packaging" }, { value: "operasional", label: "Operasional" }, { value: "lain_lain", label: "Lainnya" }];
  const payments = [{ value: "cash", label: "Cash" }, { value: "transfer", label: "Transfer" }, { value: "qris", label: "QRIS" }];

  return (
    <div className="rounded-3xl p-5 mb-4" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Kategori</Label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {categories.map((c) => (
              <button key={c.value} type="button" onClick={() => setCategory(c.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors tap-target" style={category === c.value ? { background: "#E85D8C", color: "#fff" } : { background: "#F1F5F9", color: "#64748B" }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {(category === "bahan_baku" || category === "packaging") && (
          <div>
            <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Bahan</Label>
            <div className="relative mt-1.5">
              <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className="w-full h-11 rounded-2xl border px-4 pr-9 text-sm appearance-none" style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}>
                <option value="">Pilih bahan...</option>
                {ingredients.filter((i) => i.category === category).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
            </div>
          </div>
        )}
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Nama Item</Label>
          <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Nama item" className="mt-1.5 h-11 rounded-2xl border-stone-200" />
        </div>
        {ingredientId && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Jumlah Beli</Label>
              <Input type="number" step="any" value={qtyPurchased} onChange={(e) => setQtyPurchased(e.target.value)} placeholder="Qty" className="mt-1.5 h-11 rounded-2xl border-stone-200" />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Satuan</Label>
              <div className="relative mt-1.5">
                <select value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)} className="w-full h-11 rounded-2xl border px-3 pr-8 text-sm appearance-none" style={{ borderColor: "#E2E8F0" }}>
                  {availableUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
              </div>
            </div>
          </div>
        )}
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Total Harga (Rp)</Label>
          <Input type="number" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} placeholder="Total harga" className="mt-1.5 h-11 rounded-2xl border-stone-200" />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Metode Bayar</Label>
          <div className="flex gap-2 mt-2">
            {payments.map((p) => (
              <button key={p.value} type="button" onClick={() => setPaymentMethod(p.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold tap-target" style={paymentMethod === p.value ? { background: "#E85D8C", color: "#fff" } : { background: "#F1F5F9", color: "#64748B" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Supplier (opsional)</Label>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Nama supplier" className="mt-1.5 h-11 rounded-2xl border-stone-200" />
        </div>
        {error && <p className="text-sm font-medium" style={{ color: "#DC2626" }}>{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={submitting || !itemName || !totalPrice} className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-sm font-bold text-white tap-target disabled:opacity-60" style={{ background: "#E85D8C" }}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan
          </button>
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-2xl text-sm font-semibold tap-target" style={{ background: "#F1F5F9", color: "#64748B" }}>Batal</button>
        </div>
      </form>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed p-8 text-center" style={{ borderColor: "#E2E8F0" }}>
      <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>{label}</p>
    </div>
  );
}
