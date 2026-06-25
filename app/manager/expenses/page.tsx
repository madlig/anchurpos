"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Check, Search } from "lucide-react";
import type { Expense, Ingredient } from "@/types";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function ExpenseForm({ ingredients, fetchWithAuth, onSuccess, onCancel }: {
  ingredients: Ingredient[];
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ingredientId: "", qty: "", totalCost: "", supplier: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.ingredientId || !form.qty || !form.totalCost) return;
    setSaving(true);
    try {
      const ing = ingredients.find(i => i.id === form.ingredientId);
      const res = await fetchWithAuth("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          type: "ingredient_purchase",
          itemName: ing?.name ?? form.ingredientId,
          ingredientId: form.ingredientId,
          qty: parseFloat(form.qty),
          unit: ing?.baseUnit ?? "-",
          totalCost: parseFloat(form.totalCost),
          supplier: form.supplier || null,
          notes: form.notes || null,
        }),
      });
      if (res.ok) onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "14px", marginBottom: "12px", border: "1px solid #E2E8F0" }}>
      <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E", marginBottom: "10px" }}>Catat Pengeluaran</p>
      <div className="flex flex-col gap-2.5">
        <select
          value={form.ingredientId}
          onChange={e => setForm(p => ({ ...p, ingredientId: e.target.value }))}
          style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "13px", background: "#fff" }}
          data-testid="expense-ingredient-select"
        >
          <option value="">Pilih bahan baku...</option>
          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <div className="flex gap-2">
          <Input
            type="number" placeholder="Jumlah" value={form.qty}
            onChange={e => setForm(p => ({ ...p, qty: e.target.value }))}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm"
          />
          <Input
            type="number" placeholder="Total biaya (Rp)" value={form.totalCost}
            onChange={e => setForm(p => ({ ...p, totalCost: e.target.value }))}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm"
          />
        </div>
        <Input
          placeholder="Supplier (opsional)" value={form.supplier}
          onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
          className="h-10 rounded-xl border-slate-200 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: "#E85D8C" }}
            data-testid="save-expense-btn"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Simpan
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "#F1F5F9", color: "#64748B" }}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

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

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#FCABB4" }}>
      <div className="sticky top-0 z-20" style={{ background: "#fff", borderBottom: "1px solid #F1F5F9" }}>
        <div className="px-5 pt-4 pb-4">
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Pengeluaran</h1>

          <div
            className="flex items-center gap-2 mt-2"
            style={{ padding: "9px 12px", background: "#F8FAFC", borderRadius: "12px", border: "1px solid #F1F5F9" }}
          >
            <Search size={15} style={{ color: "#94A3B8", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Cari pengeluaran..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, background: "transparent", fontSize: "13px", color: "#1C1C1E", outline: "none" }}
              data-testid="expense-search"
            />
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-24 md:px-8 md:max-w-4xl">
        <button
          onClick={() => setShowExpenseForm(!showExpenseForm)}
          className="flex items-center gap-2 mb-4"
          style={{ padding: "10px 16px", borderRadius: "12px", background: "#E85D8C", color: "#fff", fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer" }}
          data-testid="add-expense-button"
        >
          <Plus size={15} /> Catat Pengeluaran
        </button>

        {showExpenseForm && (
          <ExpenseForm
            ingredients={ingredients}
            fetchWithAuth={fetchWithAuth}
            onSuccess={() => { setShowExpenseForm(false); loadExpenses(); loadIngredients(); }}
            onCancel={() => setShowExpenseForm(false)}
          />
        )}

        <div className="flex flex-col gap-2.5">
          {expenses
            .filter(e => !searchQuery || e.itemName.toLowerCase().includes(searchQuery.toLowerCase()))
            .length === 0 ? (
              <div className="py-16 text-center">
                <p style={{ fontSize: "14px", color: "#94A3B8" }}>
                  {searchQuery ? "Tidak ditemukan" : "Belum ada pengeluaran bulan ini"}
                </p>
              </div>
            ) : (
              expenses
                .filter(e => !searchQuery || e.itemName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((exp, i) => (
                  <div
                    key={exp.id}
                    style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }}
                    data-testid={`expense-${i}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{exp.itemName}</p>
                        <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                          {exp.qtyPurchased} {exp.purchaseUnit} {exp.supplier ? `· ${exp.supplier}` : ""}
                        </p>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "#DC2626" }}>
                        -{fmt(exp.totalPrice)}
                      </span>
                    </div>
                    {exp.notes && (
                      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>{exp.notes}</p>
                    )}
                    <p style={{ fontSize: "11px", color: "#CBD5E1", marginTop: "4px" }}>
                      {new Date(exp.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                ))
            )
          }
        </div>
      </div>
    </div>
  );
}
