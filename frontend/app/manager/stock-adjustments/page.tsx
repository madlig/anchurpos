"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  name: string;
}

interface Adjustment {
  id: string;
  date: string;
  productId: string;
  variantId: string;
  qty: number;
  reasonCategory: string;
  reasonCustom: string | null;
  recipientName: string | null;
  totalCost: number;
  createdAt: string;
}

const REASON_OPTIONS = [
  { value: "sample_affiliate", label: "Sample Affiliate" },
  { value: "hadiah_bonus", label: "Hadiah / Bonus" },
  { value: "rusak_reject", label: "Rusak / Reject" },
  { value: "konsumsi_internal", label: "Konsumsi Internal" },
  { value: "lainnya", label: "Lainnya" },
];

export default function StockAdjustmentsPage() {
  const { role, getToken } = useAuth();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [form, setForm] = useState({
    productId: "",
    variantId: "",
    qty: "",
    reasonCategory: "",
    reasonCustom: "",
    recipientName: "",
  });

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [adjRes, prodRes] = await Promise.all([
        fetchWithAuth(`/api/stock-adjustments?month=${month}`),
        fetchWithAuth("/api/products"),
      ]);
      const adjData = await adjRes.json();
      const prodData = await prodRes.json();
      setAdjustments(Array.isArray(adjData) ? adjData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
    } finally {
      setLoading(false);
    }
  }, [month, fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function loadVariants(productId: string) {
    if (!productId) {
      setVariants([]);
      return;
    }
    const res = await fetchWithAuth(`/api/products/${productId}/variants`);
    const data = await res.json();
    setVariants(Array.isArray(data) ? data : []);
  }

  async function handleSubmit() {
    if (!form.productId || !form.variantId || !form.qty || !form.reasonCategory) {
      setError("Lengkapi semua field wajib");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetchWithAuth("/api/stock-adjustments", {
        method: "POST",
        body: JSON.stringify({
          productId: form.productId,
          variantId: form.variantId,
          qty: parseInt(form.qty),
          reasonCategory: form.reasonCategory,
          reasonCustom: form.reasonCustom || null,
          recipientName: form.recipientName || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Gagal menyimpan");
        return;
      }
      setShowForm(false);
      setForm({ productId: "", variantId: "", qty: "", reasonCategory: "", reasonCustom: "", recipientName: "" });
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus pengeluaran ini?")) return;
    await fetchWithAuth(`/api/stock-adjustments/${id}`, { method: "DELETE" });
    await loadData();
  }

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function formatMonth(m: string) {
    const [y, mo] = m.split("-").map(Number);
    const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${names[mo - 1]} ${y}`;
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }

  function reasonLabel(cat: string) {
    return REASON_OPTIONS.find((r) => r.value === cat)?.label ?? cat;
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Pengeluaran Stok</h1>
          <p className="text-xs text-stone-500">Non-penjualan (sample, hadiah, dll)</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1">
          <Plus size={14} /> Catat
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-4 border-emerald-200">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-stone-900">Pengeluaran Baru</h2>
            <button onClick={() => setShowForm(false)} className="text-stone-400">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-stone-500">Produk</label>
              <select
                value={form.productId}
                onChange={(e) => {
                  setForm({ ...form, productId: e.target.value, variantId: "" });
                  loadVariants(e.target.value);
                }}
                className="w-full mt-1 rounded-md border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="">Pilih produk...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {form.productId && (
              <div>
                <label className="text-xs text-stone-500">Varian</label>
                <select
                  value={form.variantId}
                  onChange={(e) => setForm({ ...form, variantId: e.target.value })}
                  className="w-full mt-1 rounded-md border border-stone-200 px-3 py-2 text-sm"
                >
                  <option value="">Pilih varian...</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs text-stone-500">Jumlah (pack)</label>
              <Input
                type="number"
                min="1"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                placeholder="0"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs text-stone-500">Kategori Alasan</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {REASON_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setForm({ ...form, reasonCategory: r.value })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      form.reasonCategory === r.value
                        ? "bg-emerald-600 text-white"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {form.reasonCategory === "lainnya" && (
              <div>
                <label className="text-xs text-stone-500">Catatan</label>
                <Input
                  value={form.reasonCustom}
                  onChange={(e) => setForm({ ...form, reasonCustom: e.target.value })}
                  placeholder="Alasan lainnya..."
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-stone-500">Nama Penerima (opsional)</label>
              <Input
                value={form.recipientName}
                onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                placeholder="Nama affiliate / teman"
                className="mt-1"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Simpan
            </Button>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)}>
          <ChevronLeft size={18} />
        </Button>
        <span className="text-sm font-semibold text-stone-900">{formatMonth(month)}</span>
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)}>
          <ChevronRight size={18} />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : adjustments.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-10">Belum ada pengeluaran bulan ini</p>
      ) : (
        <div className="space-y-2">
          {adjustments.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {a.variantId} &middot; {a.qty} pack
                  </p>
                  <p className="text-xs text-stone-500">
                    {reasonLabel(a.reasonCategory)}
                    {a.recipientName && ` — ${a.recipientName}`}
                  </p>
                  {a.reasonCustom && (
                    <p className="text-xs text-stone-400 italic">{a.reasonCustom}</p>
                  )}
                  <p className="text-xs text-stone-400 mt-1">{formatDate(a.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {role === "owner" && (
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-stone-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
