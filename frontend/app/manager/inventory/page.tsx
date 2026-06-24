"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/utils";
import { Loader2, Plus, X, Check, AlertTriangle, Search } from "lucide-react";
import type { Ingredient, Expense } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "produk" | "bahan" | "pengeluaran";

interface VariantStock {
  id: string; name: string; currentStock: number; minStock: number; sortOrder: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

// ─── Expense Form Component ───────────────────────────────────────────────────
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("produk");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Produk Jadi
  const [variants, setVariants] = useState<VariantStock[]>([]);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [opnameValue, setOpnameValue] = useState("");
  const [opnameNote, setOpnameNote] = useState("");

  // Bahan Baku
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [newStockValue, setNewStockValue] = useState("");
  const [stockNote, setStockNote] = useState("");

  // Pengeluaran
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadVariants = useCallback(async () => {
    const res = await fetchWithAuth("/api/variants");
    if (res.ok) setVariants(await res.json());
  }, [fetchWithAuth]);

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
    Promise.all([loadVariants(), loadIngredients(), loadExpenses()]).finally(() => setLoading(false));
  }, [loadVariants, loadIngredients, loadExpenses]);

  // Opname produk jadi
  async function handleVariantOpname(id: string) {
    const val = parseInt(opnameValue, 10);
    if (isNaN(val) || val < 0) return;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/variants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ currentStock: val, note: opnameNote || null }),
      });
      if (res.ok) {
        setEditingVariantId(null); setOpnameValue(""); setOpnameNote("");
        await loadVariants();
      }
    } finally { setSubmitting(false); }
  }

  // Update bahan baku stock
  async function handleStockEdit(id: string) {
    const val = parseFloat(newStockValue);
    if (isNaN(val) || val < 0) return;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/ingredients/${id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ newStock: val, note: stockNote || null }),
      });
      if (res.ok) {
        setEditingStock(null); setNewStockValue(""); setStockNote("");
        await loadIngredients();
      }
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
    </div>
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: "produk", label: "Produk Jadi" },
    { key: "bahan", label: "Bahan Baku" },
    { key: "pengeluaran", label: "Pengeluaran" },
  ];

  const lowVariants = variants.filter(v => v.currentStock < v.minStock);
  const lowIngredients = ingredients.filter(i => i.currentStock < i.minStock);

  return (
    <div className="min-h-screen" style={{ background: "#FCABB4" }}>

      {/* ── Header (white, sticky) ── */}
      <div className="sticky top-0 z-20" style={{ background: "#fff", borderBottom: "1px solid #F1F5F9" }}>
        <div className="px-5 pt-4 pb-2">
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Inventori</h1>

          {/* Search bar */}
          <div
            className="flex items-center gap-2 mt-2"
            style={{ padding: "9px 12px", background: "#F8FAFC", borderRadius: "12px", border: "1px solid #F1F5F9" }}
          >
            <Search size={15} style={{ color: "#94A3B8", flexShrink: 0 }} />
            <input
              type="text"
              placeholder={tab === "produk" ? "Cari varian..." : tab === "bahan" ? "Cari bahan baku..." : "Cari pengeluaran..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, background: "transparent", fontSize: "13px", color: "#1C1C1E", outline: "none" }}
              data-testid="inventory-search"
            />
          </div>
        </div>

        {/* Tabs — underline style */}
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearchQuery(""); }}
              data-testid={`tab-${t.key}`}
              className="flex-1"
              style={{
                paddingTop: "8px", paddingBottom: "10px",
                border: "none",
                borderBottom: tab === t.key ? "2px solid #E85D8C" : "2px solid transparent",
                fontSize: "12px", fontWeight: tab === t.key ? "600" : "500",
                color: tab === t.key ? "#E85D8C" : "#94A3B8",
                background: "transparent", cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-24 md:px-8 md:max-w-4xl">

        {/* ── TAB: Produk Jadi ── */}
        {tab === "produk" && (
          <>
            {lowVariants.length > 0 && (
              <div
                style={{ padding: "10px 14px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}
              >
                <AlertTriangle size={15} style={{ color: "#DC2626", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", fontWeight: "500", color: "#DC2626" }}>
                  {lowVariants.length} varian stok rendah
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {variants
                .filter(v => !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .length === 0 ? (
                  <div className="py-16 text-center">
                    <p style={{ fontSize: "14px", color: "#94A3B8" }}>
                      {searchQuery ? "Tidak ditemukan" : "Belum ada data varian"}
                    </p>
                  </div>
                ) : (
                  variants
                    .filter(v => !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(v => {
                      const isLow = v.currentStock < v.minStock;
                      const barPct = Math.min(100, (v.currentStock / Math.max(v.minStock * 2, 1)) * 100);
                      const barColor = isLow ? "#DC2626" : v.currentStock < v.minStock * 1.5 ? "#D97706" : "#16A34A";
                      const isEditing = editingVariantId === v.id;
                      return (
                        <div
                          key={v.id}
                          style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: `1px solid ${isLow ? "#FECACA" : "#F1F5F9"}` }}
                          data-testid={`variant-stock-${v.id}`}
                        >
                          <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
                            <div className="flex items-center gap-2">
                              <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: isLow ? "#FEE2E2" : "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: "14px", fontWeight: "700", color: isLow ? "#DC2626" : "#E85D8C" }}>
                                  {v.name[0].toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{v.name}</p>
                                <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Min: {v.minStock} pcs</p>
                              </div>
                            </div>
                            <span style={{ fontSize: "16px", fontWeight: "700", color: isLow ? "#DC2626" : "#1C1C1E" }}>
                              {v.currentStock} <span style={{ fontSize: "11px", fontWeight: "500", color: "#94A3B8" }}>pcs</span>
                            </span>
                          </div>

                          {!isEditing && (
                            <>
                              <div style={{ height: "6px", borderRadius: "3px", background: "#F1F5F9", marginBottom: "6px" }}>
                                <div style={{ height: "6px", borderRadius: "3px", background: barColor, width: `${barPct}%`, transition: "width 0.4s" }} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                                  {isLow ? "⚠ Stok di bawah minimum" : "Stok aman"}
                                </span>
                                <button
                                  onClick={() => { setEditingVariantId(v.id); setOpnameValue(String(v.currentStock)); }}
                                  style={{ fontSize: "11px", color: "#E85D8C", fontWeight: "600", background: "none", border: "none", cursor: "pointer" }}
                                >
                                  Stock Opname
                                </button>
                              </div>
                            </>
                          )}

                          {isEditing && (
                            <div className="flex flex-col gap-2 mt-2">
                              <div className="flex gap-2 items-center">
                                <Input
                                  type="number"
                                  value={opnameValue}
                                  onChange={e => setOpnameValue(e.target.value)}
                                  placeholder="Jumlah aktual (pcs)"
                                  className="flex-1 h-10 rounded-xl border-slate-200 text-sm"
                                  data-testid={`opname-input-${v.id}`}
                                />
                                <span style={{ fontSize: "12px", color: "#64748B" }}>pcs</span>
                              </div>
                              <Input
                                value={opnameNote}
                                onChange={e => setOpnameNote(e.target.value)}
                                placeholder="Catatan opname (opsional)"
                                className="h-10 rounded-xl border-slate-200 text-sm"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleVariantOpname(v.id)}
                                  disabled={submitting}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
                                  style={{ background: "#E85D8C" }}
                                  data-testid={`save-opname-${v.id}`}
                                >
                                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                  Simpan
                                </button>
                                <button
                                  onClick={() => { setEditingVariantId(null); setOpnameValue(""); setOpnameNote(""); }}
                                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                                  style={{ background: "#F1F5F9", color: "#64748B" }}
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                )
              }
            </div>
          </>
        )}

        {/* ── TAB: Bahan Baku ── */}
        {tab === "bahan" && (
          <>
            {lowIngredients.length > 0 && (
              <div
                style={{ padding: "10px 14px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}
              >
                <AlertTriangle size={15} style={{ color: "#DC2626", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", fontWeight: "500", color: "#DC2626" }}>
                  {lowIngredients.length} bahan stok rendah
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {ingredients
                .filter(i => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .length === 0 ? (
                  <div className="py-16 text-center">
                    <p style={{ fontSize: "14px", color: "#94A3B8" }}>
                      {searchQuery ? "Tidak ditemukan" : "Belum ada bahan baku"}
                    </p>
                  </div>
                ) : (
                  ingredients
                    .filter(i => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(ing => {
                      const isLow = ing.currentStock < ing.minStock;
                      const barPct = Math.min(100, (ing.currentStock / Math.max(ing.minStock * 2, 1)) * 100);
                      const barColor = isLow ? "#DC2626" : ing.currentStock < ing.minStock * 1.5 ? "#D97706" : "#16A34A";
                      const isEditing = editingStock === ing.id;
                      return (
                        <div
                          key={ing.id}
                          style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: `1px solid ${isLow ? "#FECACA" : "#F1F5F9"}` }}
                          data-testid={`ingredient-${ing.id}`}
                        >
                          <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{ing.name}</span>
                            <span style={{ fontSize: "16px", fontWeight: "700", color: isLow ? "#DC2626" : "#1C1C1E" }}>
                              {ing.currentStock.toLocaleString("id-ID")} <span style={{ fontSize: "11px", fontWeight: "500", color: "#94A3B8" }}>{ing.baseUnit}</span>
                            </span>
                          </div>

                          {!isEditing && (
                            <>
                              <div style={{ height: "6px", borderRadius: "3px", background: "#F1F5F9", marginBottom: "6px" }}>
                                <div style={{ height: "6px", borderRadius: "3px", background: barColor, width: `${barPct}%`, transition: "width 0.4s" }} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span style={{ fontSize: "11px", color: "#94A3B8" }}>Min: {ing.minStock.toLocaleString("id-ID")} {ing.baseUnit}</span>
                                <button
                                  onClick={() => { setEditingStock(ing.id); setNewStockValue(String(ing.currentStock)); }}
                                  style={{ fontSize: "11px", color: "#E85D8C", fontWeight: "600", background: "none", border: "none", cursor: "pointer" }}
                                >
                                  Edit stok
                                </button>
                              </div>
                            </>
                          )}

                          {isEditing && (
                            <div className="flex flex-col gap-2 mt-2">
                              <div className="flex gap-2 items-center">
                                <Input
                                  type="number"
                                  value={newStockValue}
                                  onChange={e => setNewStockValue(e.target.value)}
                                  placeholder={`Stok baru (${ing.baseUnit})`}
                                  className="flex-1 h-10 rounded-xl border-slate-200 text-sm"
                                />
                                <span style={{ fontSize: "12px", color: "#64748B" }}>{ing.baseUnit}</span>
                              </div>
                              <Input
                                value={stockNote}
                                onChange={e => setStockNote(e.target.value)}
                                placeholder="Catatan (opsional)"
                                className="h-10 rounded-xl border-slate-200 text-sm"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleStockEdit(ing.id)}
                                  disabled={submitting}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
                                  style={{ background: "#E85D8C" }}
                                >
                                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                  Simpan
                                </button>
                                <button
                                  onClick={() => { setEditingStock(null); setNewStockValue(""); setStockNote(""); }}
                                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                                  style={{ background: "#F1F5F9", color: "#64748B" }}
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                )
              }
            </div>
          </>
        )}

        {/* ── TAB: Pengeluaran ── */}
        {tab === "pengeluaran" && (
          <>
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
          </>
        )}

      </div>
    </div>
  );
}
