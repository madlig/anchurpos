"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Plus, X, Check, Package, Layers, Beaker } from "lucide-react";
import { Input } from "@/components/ui/input";

type Tab = "produk" | "varian" | "bahan";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PriceTier { minQty: number; maxQty: number | null; price: number; }
interface ProductItem {
  id: string; name: string; code: string; description: string; packPerBatch: number;
  priceTiers: PriceTier[];
}
interface VariantItem {
  id: string; name: string; sortOrder: number; currentStock: number; minStock: number;
}
interface IngredientItem {
  id: string; name: string; category: string; baseUnit: string; currentStock: number; minStock: number;
}

// ─── Add Product Form ──────────────────────────────────────────────────────────
function AddProductForm({ fetchWithAuth, onSuccess, onCancel }: {
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ name: "", code: "", description: "", packPerBatch: "1" });
  const [tiers, setTiers] = useState<{ minQty: string; maxQty: string; price: string }[]>([
    { minQty: "1", maxQty: "", price: "" }
  ]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) { setErr("Nama dan kode wajib diisi"); return; }
    const priceTiers = tiers
      .filter(t => t.price && t.minQty)
      .map(t => ({ minQty: parseInt(t.minQty), maxQty: t.maxQty ? parseInt(t.maxQty) : null, price: parseInt(t.price) }));
    setSaving(true); setErr("");
    try {
      const res = await fetchWithAuth("/api/products", {
        method: "POST",
        body: JSON.stringify({ ...form, packPerBatch: parseInt(form.packPerBatch) || 1, priceTiers }),
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#F8FAFC", borderRadius: "14px", padding: "14px", border: "1px solid #E2E8F0", marginBottom: "12px" }}>
      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E", marginBottom: "12px" }}>Tambah Produk</p>
      <div className="flex flex-col gap-2.5">
        <div className="flex gap-2">
          <Input placeholder="Nama produk *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm" data-testid="product-name-input" />
          <Input placeholder="Kode" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
            className="w-24 h-10 rounded-xl border-slate-200 text-sm" data-testid="product-code-input" />
        </div>
        <div className="flex gap-2">
          <Input placeholder="Deskripsi" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm" />
          <Input type="number" placeholder="Pack/batch" value={form.packPerBatch} onChange={e => setForm(p => ({ ...p, packPerBatch: e.target.value }))}
            className="w-28 h-10 rounded-xl border-slate-200 text-sm" />
        </div>

        {/* Price Tiers */}
        <p style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Harga Bertingkat</p>
        {tiers.map((tier, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <Input type="number" placeholder="Min qty" value={tier.minQty} onChange={e => setTiers(prev => prev.map((t, j) => j === i ? { ...t, minQty: e.target.value } : t))}
              className="w-20 h-9 rounded-xl border-slate-200 text-xs" />
            <span style={{ fontSize: "11px", color: "#94A3B8" }}>–</span>
            <Input type="number" placeholder="Max (kosong=∞)" value={tier.maxQty} onChange={e => setTiers(prev => prev.map((t, j) => j === i ? { ...t, maxQty: e.target.value } : t))}
              className="w-28 h-9 rounded-xl border-slate-200 text-xs" />
            <Input type="number" placeholder="Harga" value={tier.price} onChange={e => setTiers(prev => prev.map((t, j) => j === i ? { ...t, price: e.target.value } : t))}
              className="flex-1 h-9 rounded-xl border-slate-200 text-xs" />
            {tiers.length > 1 && (
              <button onClick={() => setTiers(prev => prev.filter((_, j) => j !== i))}
                style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#FEE2E2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <X size={12} style={{ color: "#DC2626" }} />
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setTiers(prev => [...prev, { minQty: "", maxQty: "", price: "" }])}
          style={{ fontSize: "12px", color: "#E85D8C", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontWeight: "600" }}>
          + Tambah tier harga
        </button>

        {err && <p style={{ fontSize: "12px", color: "#DC2626" }}>{err}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: "#E85D8C" }} data-testid="save-product-btn">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan
          </button>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: "12px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Variant Form ──────────────────────────────────────────────────────────
function AddVariantForm({ fetchWithAuth, onSuccess, onCancel }: {
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ name: "", sortOrder: "99", minStock: "10" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim()) { setErr("Nama varian wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetchWithAuth("/api/variants", {
        method: "POST",
        body: JSON.stringify({ name: form.name.trim(), sortOrder: parseInt(form.sortOrder) || 99, minStock: parseInt(form.minStock) || 10 }),
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#F8FAFC", borderRadius: "14px", padding: "14px", border: "1px solid #E2E8F0", marginBottom: "12px" }}>
      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E", marginBottom: "12px" }}>Tambah Varian</p>
      <div className="flex flex-col gap-2.5">
        <Input placeholder="Nama varian *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          className="h-10 rounded-xl border-slate-200 text-sm" data-testid="variant-name-input" />
        <div className="flex gap-2">
          <Input type="number" placeholder="Urutan sort" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm" />
          <Input type="number" placeholder="Stok minimum" value={form.minStock} onChange={e => setForm(p => ({ ...p, minStock: e.target.value }))}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm" />
        </div>
        {err && <p style={{ fontSize: "12px", color: "#DC2626" }}>{err}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: "#E85D8C" }} data-testid="save-variant-btn">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan
          </button>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: "12px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Ingredient Form ───────────────────────────────────────────────────────
function AddIngredientForm({ fetchWithAuth, onSuccess, onCancel }: {
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ name: "", baseUnit: "", minStock: "0", category: "bahan_baku" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim() || !form.baseUnit.trim()) { setErr("Nama dan satuan wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetchWithAuth("/api/ingredients", {
        method: "POST",
        body: JSON.stringify({ name: form.name.trim(), baseUnit: form.baseUnit.trim(), category: form.category, minStock: parseFloat(form.minStock) || 0 }),
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#F8FAFC", borderRadius: "14px", padding: "14px", border: "1px solid #E2E8F0", marginBottom: "12px" }}>
      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E", marginBottom: "12px" }}>Tambah Bahan Baku</p>
      <div className="flex flex-col gap-2.5">
        <div className="flex gap-2">
          <Input placeholder="Nama bahan *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm" data-testid="ingredient-name-input" />
          <Input placeholder="Satuan *" value={form.baseUnit} onChange={e => setForm(p => ({ ...p, baseUnit: e.target.value }))}
            className="w-24 h-10 rounded-xl border-slate-200 text-sm" />
        </div>
        <div className="flex gap-2">
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            style={{ flex: 1, padding: "9px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "13px", background: "#fff" }}>
            <option value="bahan_baku">Bahan Baku</option>
            <option value="packaging">Packaging</option>
            <option value="operasional">Operasional</option>
          </select>
          <Input type="number" placeholder="Stok minimum" value={form.minStock} onChange={e => setForm(p => ({ ...p, minStock: e.target.value }))}
            className="w-32 h-10 rounded-xl border-slate-200 text-sm" />
        </div>
        {err && <p style={{ fontSize: "12px", color: "#DC2626" }}>{err}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: "#E85D8C" }} data-testid="save-ingredient-btn">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan
          </button>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: "12px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MasterDataPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("produk");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, v, i] = await Promise.all([
        fetchWithAuth("/api/products").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/variants").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/ingredients").then(r => r.ok ? r.json() : []),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
      setIngredients(Array.isArray(i) ? i : []);
    } finally { setLoading(false); }
  }, [fetchWithAuth]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "produk", label: "Produk", icon: Package },
    { key: "varian", label: "Varian", icon: Layers },
    { key: "bahan", label: "Bahan Baku", icon: Beaker },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#FCABB4" }}>

      {/* ── Header (white, sticky) ── */}
      <div className="sticky top-0 z-20" style={{ background: "#fff", borderBottom: "1px solid #F1F5F9" }}>
        <div className="px-5 pt-4 pb-2">
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Master Data</h1>
        </div>
        {/* Tabs */}
        <div className="flex">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false); }}
                data-testid={`tab-${t.key}`}
                className="flex-1 flex items-center justify-center gap-1.5"
                style={{ paddingTop: "8px", paddingBottom: "10px", border: "none", background: "transparent", cursor: "pointer",
                  borderBottom: active ? "2px solid #E85D8C" : "2px solid transparent",
                  fontSize: "12px", fontWeight: active ? "600" : "500",
                  color: active ? "#E85D8C" : "#94A3B8" }}>
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-3 pb-24">

        {/* ── Add Button ── */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            data-testid="add-btn"
            className="flex items-center gap-2 mb-3"
            style={{ padding: "10px 16px", borderRadius: "12px", background: "#E85D8C", color: "#fff", fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer" }}>
            <Plus size={15} />
            Tambah {tab === "produk" ? "Produk" : tab === "varian" ? "Varian" : "Bahan Baku"}
          </button>
        )}

        {/* ── Forms ── */}
        {showForm && tab === "produk" && (
          <AddProductForm fetchWithAuth={fetchWithAuth} onSuccess={() => { setShowForm(false); loadAll(); }} onCancel={() => setShowForm(false)} />
        )}
        {showForm && tab === "varian" && (
          <AddVariantForm fetchWithAuth={fetchWithAuth} onSuccess={() => { setShowForm(false); loadAll(); }} onCancel={() => setShowForm(false)} />
        )}
        {showForm && tab === "bahan" && (
          <AddIngredientForm fetchWithAuth={fetchWithAuth} onSuccess={() => { setShowForm(false); loadAll(); }} onCancel={() => setShowForm(false)} />
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#E85D8C" }} />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">

            {/* ── Produk Tab ── */}
            {tab === "produk" && (products.length === 0 ? (
              <EmptyState label="Belum ada produk" sub="Tap tombol di atas untuk menambah" />
            ) : products.map(p => (
              <div key={p.id} style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }} data-testid={`product-${p.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span style={{ padding: "2px 8px", borderRadius: "6px", background: "#FEF1F5", fontSize: "10px", fontWeight: "700", color: "#E85D8C", fontFamily: "monospace" }}>{p.code}</span>
                      <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>{p.name}</p>
                    </div>
                    {p.description && <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{p.description}</p>}
                    <p style={{ fontSize: "11px", color: "#94A3B8" }}>{p.packPerBatch} pack/batch</p>
                  </div>
                </div>
                {p.priceTiers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.priceTiers.map((t, i) => (
                      <span key={i} style={{ padding: "3px 8px", borderRadius: "6px", background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: "11px", color: "#64748B" }}>
                        {t.minQty}–{t.maxQty ?? "∞"}: {fmt(t.price)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )))}

            {/* ── Varian Tab ── */}
            {tab === "varian" && (variants.length === 0 ? (
              <EmptyState label="Belum ada varian" sub="Tap tombol di atas untuk menambah" />
            ) : variants.map(v => {
              const isLow = v.currentStock < v.minStock;
              return (
                <div key={v.id} style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: `1px solid ${isLow ? "#FECACA" : "#F1F5F9"}` }} data-testid={`variant-${v.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: isLow ? "#FEE2E2" : "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: isLow ? "#DC2626" : "#E85D8C" }}>{v.name[0]}</span>
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>{v.name}</p>
                        <p style={{ fontSize: "11px", color: "#94A3B8" }}>Min: {v.minStock} pcs · Urutan: #{v.sortOrder}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p style={{ fontSize: "16px", fontWeight: "700", color: isLow ? "#DC2626" : "#1C1C1E" }}>{v.currentStock}</p>
                      <p style={{ fontSize: "10px", color: "#94A3B8" }}>pcs</p>
                    </div>
                  </div>
                </div>
              );
            }))}

            {/* ── Bahan Tab ── */}
            {tab === "bahan" && (ingredients.length === 0 ? (
              <EmptyState label="Belum ada bahan baku" sub="Tap tombol di atas untuk menambah" />
            ) : ingredients.map(ing => {
              const isLow = ing.currentStock < ing.minStock;
              const barPct = Math.min(100, (ing.currentStock / Math.max(ing.minStock * 2, 1)) * 100);
              return (
                <div key={ing.id} style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: `1px solid ${isLow ? "#FECACA" : "#F1F5F9"}` }} data-testid={`ingredient-${ing.id}`}>
                  <div className="flex items-start justify-between" style={{ marginBottom: "8px" }}>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>{ing.name}</p>
                      <span style={{ padding: "2px 8px", borderRadius: "6px", background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: "10px", color: "#64748B", display: "inline-block", marginTop: "3px" }}>
                        {ing.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <p style={{ fontSize: "16px", fontWeight: "700", color: isLow ? "#DC2626" : "#1C1C1E" }}>{ing.currentStock.toLocaleString("id-ID")}</p>
                      <p style={{ fontSize: "10px", color: "#94A3B8" }}>{ing.baseUnit}</p>
                    </div>
                  </div>
                  <div style={{ height: "5px", borderRadius: "3px", background: "#F1F5F9" }}>
                    <div style={{ height: "5px", borderRadius: "3px", width: `${barPct}%`, background: isLow ? "#DC2626" : "#16A34A", transition: "width 0.4s" }} />
                  </div>
                  <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>Min: {ing.minStock.toLocaleString("id-ID")} {ing.baseUnit}</p>
                </div>
              );
            }))}

          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: "14px", padding: "32px 16px", textAlign: "center", border: "1px solid #F1F5F9" }}>
      <p style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>{label}</p>
      <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>{sub}</p>
    </div>
  );
}
