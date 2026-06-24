"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Plus, X, Check, Package, Layers, Beaker, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

type Tab = "produk" | "varian" | "bahan";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

interface PriceTier { minQty: number; maxQty: number | null; price: number; }
interface ProductItem { id: string; name: string; code: string; description: string; packPerBatch: number; priceTiers: PriceTier[]; }
interface VariantItem { id: string; name: string; sortOrder: number; currentStock: number; minStock: number; }
interface IngredientItem { id: string; name: string; category: string; baseUnit: string; currentStock: number; minStock: number; }

// ─── Reusable Confirm Delete Dialog ───────────────────────────────────────────
function ConfirmDelete({ label, onConfirm, onCancel, loading }: {
  label: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div style={{ background: "#FEF2F2", borderRadius: "10px", padding: "12px", border: "1px solid #FECACA", marginTop: "8px" }}>
      <p style={{ fontSize: "12px", fontWeight: "600", color: "#DC2626", marginBottom: "10px" }}>Hapus "{label}"?</p>
      <div className="flex gap-2">
        <button onClick={onConfirm} disabled={loading} data-testid="confirm-delete-btn"
          style={{ flex: 1, padding: "9px", borderRadius: "9px", background: "#DC2626", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Hapus
        </button>
        <button onClick={onCancel} style={{ flex: 1, padding: "9px", borderRadius: "9px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
          Batal
        </button>
      </div>
    </div>
  );
}

// ─── Product Form (Add & Edit) ─────────────────────────────────────────────────
function ProductForm({ initial, fetchWithAuth, onSuccess, onCancel }: {
  initial?: ProductItem;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? "", code: initial?.code ?? "",
    description: initial?.description ?? "", packPerBatch: String(initial?.packPerBatch ?? "1"),
  });
  const [tiers, setTiers] = useState<{ minQty: string; maxQty: string; price: string }[]>(
    initial?.priceTiers?.length
      ? initial.priceTiers.map(t => ({ minQty: String(t.minQty), maxQty: t.maxQty ? String(t.maxQty) : "", price: String(t.price) }))
      : [{ minQty: "1", maxQty: "", price: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) { setErr("Nama dan kode wajib diisi"); return; }
    const priceTiers = tiers.filter(t => t.price && t.minQty).map(t => ({
      minQty: parseInt(t.minQty), maxQty: t.maxQty ? parseInt(t.maxQty) : null, price: parseInt(t.price),
    }));
    setSaving(true); setErr("");
    try {
      const url = isEdit ? `/api/products/${initial!.id}` : "/api/products";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetchWithAuth(url, { method, body: JSON.stringify({ ...form, packPerBatch: parseInt(form.packPerBatch) || 1, priceTiers }) });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#F8FAFC", borderRadius: "14px", padding: "14px", border: "1px solid #E2E8F0", marginBottom: "12px" }}>
      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E", marginBottom: "12px" }}>{isEdit ? "Edit Produk" : "Tambah Produk"}</p>
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
        <p style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Harga Bertingkat</p>
        {tiers.map((tier, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <Input type="number" placeholder="Min qty" value={tier.minQty} onChange={e => setTiers(p => p.map((t, j) => j === i ? { ...t, minQty: e.target.value } : t))}
              className="w-20 h-9 rounded-xl border-slate-200 text-xs" />
            <span style={{ fontSize: "11px", color: "#94A3B8" }}>–</span>
            <Input type="number" placeholder="Max (kosong=∞)" value={tier.maxQty} onChange={e => setTiers(p => p.map((t, j) => j === i ? { ...t, maxQty: e.target.value } : t))}
              className="w-28 h-9 rounded-xl border-slate-200 text-xs" />
            <Input type="number" placeholder="Harga" value={tier.price} onChange={e => setTiers(p => p.map((t, j) => j === i ? { ...t, price: e.target.value } : t))}
              className="flex-1 h-9 rounded-xl border-slate-200 text-xs" />
            {tiers.length > 1 && (
              <button onClick={() => setTiers(p => p.filter((_, j) => j !== i))}
                style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#FEE2E2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <X size={12} style={{ color: "#DC2626" }} />
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setTiers(p => [...p, { minQty: "", maxQty: "", price: "" }])}
          style={{ fontSize: "12px", color: "#E85D8C", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontWeight: "600" }}>
          + Tambah tier harga
        </button>
        {err && <p style={{ fontSize: "12px", color: "#DC2626" }}>{err}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} data-testid="save-product-btn"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#E85D8C" }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan
          </button>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: "12px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Variant Form (Add & Edit) ─────────────────────────────────────────────────
function VariantForm({ initial, fetchWithAuth, onSuccess, onCancel }: {
  initial?: VariantItem;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? "", sortOrder: String(initial?.sortOrder ?? "99"), minStock: String(initial?.minStock ?? "10"),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim()) { setErr("Nama varian wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      const url = isEdit ? `/api/variants/${initial!.id}` : "/api/variants";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetchWithAuth(url, { method, body: JSON.stringify({ name: form.name.trim(), sortOrder: parseInt(form.sortOrder) || 99, minStock: parseInt(form.minStock) || 10 }) });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#F8FAFC", borderRadius: "14px", padding: "14px", border: "1px solid #E2E8F0", marginBottom: "12px" }}>
      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E", marginBottom: "12px" }}>{isEdit ? "Edit Varian" : "Tambah Varian"}</p>
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
          <button onClick={handleSave} disabled={saving} data-testid="save-variant-btn"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#E85D8C" }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan
          </button>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: "12px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Ingredient Form (Add & Edit) ─────────────────────────────────────────────
function IngredientForm({ initial, fetchWithAuth, onSuccess, onCancel }: {
  initial?: IngredientItem;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? "", baseUnit: initial?.baseUnit ?? "",
    minStock: String(initial?.minStock ?? "0"), category: initial?.category ?? "bahan_baku",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim() || !form.baseUnit.trim()) { setErr("Nama dan satuan wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      const url = isEdit ? `/api/ingredients/${initial!.id}` : "/api/ingredients";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetchWithAuth(url, { method, body: JSON.stringify({ name: form.name.trim(), baseUnit: form.baseUnit.trim(), category: form.category, minStock: parseFloat(form.minStock) || 0 }) });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#F8FAFC", borderRadius: "14px", padding: "14px", border: "1px solid #E2E8F0", marginBottom: "12px" }}>
      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E", marginBottom: "12px" }}>{isEdit ? "Edit Bahan Baku" : "Tambah Bahan Baku"}</p>
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
          <button onClick={handleSave} disabled={saving} data-testid="save-ingredient-btn"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#E85D8C" }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan
          </button>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: "12px", background: "#F1F5F9", color: "#64748B", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>Batal</button>
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItem, setEditItem] = useState<ProductItem | VariantItem | IngredientItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");

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

  // Reset forms when switching tab
  function switchTab(t: Tab) { setTab(t); setShowAddForm(false); setEditItem(null); setDeleteTarget(null); setSearch(""); }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const urlMap = { produk: "products", varian: "variants", bahan: "ingredients" };
      const res = await fetchWithAuth(`/api/${urlMap[tab]}/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) { setDeleteTarget(null); await loadAll(); }
    } finally { setDeleting(false); }
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "produk", label: "Produk", icon: Package },
    { key: "varian", label: "Varian", icon: Layers },
    { key: "bahan", label: "Bahan Baku", icon: Beaker },
  ];

  const tabLabel = tab === "produk" ? "Produk" : tab === "varian" ? "Varian" : "Bahan Baku";
  const q = search.toLowerCase();
  const filteredProducts = products.filter(p => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  const filteredVariants = variants.filter(v => !q || v.name.toLowerCase().includes(q));
  const filteredIngredients = ingredients.filter(i => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));

  const onSuccess = () => { setShowAddForm(false); setEditItem(null); loadAll(); };

  return (
    <div className="min-h-screen" style={{ background: "#FCABB4" }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20" style={{ background: "#fff", borderBottom: "1px solid #F1F5F9" }}>
        <div className="px-5 pt-4 pb-2">
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Master Data</h1>
        </div>
        <div className="flex">
          {TABS.map(t => {
            const Icon = t.icon; const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => switchTab(t.key)} data-testid={`tab-${t.key}`}
                className="flex-1 flex items-center justify-center gap-1.5"
                style={{ paddingTop: "8px", paddingBottom: "10px", border: "none", background: "transparent", cursor: "pointer",
                  borderBottom: active ? "2px solid #E85D8C" : "2px solid transparent",
                  fontSize: "12px", fontWeight: active ? "600" : "500", color: active ? "#E85D8C" : "#94A3B8" }}>
                <Icon size={13} />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-3 pb-24">

        {/* ── Search + Add button ── */}
        <div className="flex gap-2 mb-3">
          <Input
            placeholder={`Cari ${tabLabel.toLowerCase()}...`}
            value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 h-10 rounded-xl border-slate-200 text-sm bg-white"
            data-testid="search-input"
          />
          {!showAddForm && !editItem && (
            <button onClick={() => setShowAddForm(true)} data-testid="add-btn"
              className="flex items-center gap-1.5 px-3 rounded-xl text-white text-sm font-semibold"
              style={{ background: "#E85D8C", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
              <Plus size={15} /> Tambah
            </button>
          )}
        </div>

        {/* ── Add Forms ── */}
        {showAddForm && tab === "produk" && <ProductForm fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setShowAddForm(false)} />}
        {showAddForm && tab === "varian" && <VariantForm fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setShowAddForm(false)} />}
        {showAddForm && tab === "bahan" && <IngredientForm fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setShowAddForm(false)} />}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#E85D8C" }} /></div>
        ) : (
          <div className="flex flex-col gap-2.5">

            {/* ── PRODUK ── */}
            {tab === "produk" && (filteredProducts.length === 0 ? (
              <EmptyState label={search ? "Tidak ada hasil" : "Belum ada produk"} sub={search ? "Coba kata kunci lain" : "Tap tombol Tambah"} />
            ) : filteredProducts.map(p => (
              <div key={p.id} data-testid={`product-${p.id}`}>
                {/* Edit form inline */}
                {editItem && (editItem as ProductItem).id === p.id ? (
                  <ProductForm initial={p} fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setEditItem(null)} />
                ) : (
                  <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9" }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ padding: "2px 8px", borderRadius: "6px", background: "#FEF1F5", fontSize: "10px", fontWeight: "700", color: "#E85D8C", fontFamily: "monospace" }}>{p.code}</span>
                          <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>{p.name}</p>
                        </div>
                        {p.description && <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{p.description}</p>}
                        <p style={{ fontSize: "11px", color: "#94A3B8" }}>{p.packPerBatch} pack/batch</p>
                        {p.priceTiers?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.priceTiers.map((t, i) => (
                              <span key={i} style={{ padding: "3px 8px", borderRadius: "6px", background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: "11px", color: "#64748B" }}>
                                {t.minQty}–{t.maxQty ?? "∞"}: {fmt(t.price)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5 ml-2 flex-shrink-0">
                        <ActionBtn icon={<Pencil size={12} />} color="#E85D8C" bg="#FEF1F5" onClick={() => { setEditItem(p); setShowAddForm(false); setDeleteTarget(null); }} testId={`edit-product-${p.id}`} />
                        <ActionBtn icon={<Trash2 size={12} />} color="#DC2626" bg="#FEE2E2" onClick={() => { setDeleteTarget({ id: p.id, name: p.name }); setEditItem(null); }} testId={`delete-product-${p.id}`} />
                      </div>
                    </div>
                    {deleteTarget?.id === p.id && (
                      <ConfirmDelete label={p.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
                    )}
                  </div>
                )}
              </div>
            )))}

            {/* ── VARIAN ── */}
            {tab === "varian" && (filteredVariants.length === 0 ? (
              <EmptyState label={search ? "Tidak ada hasil" : "Belum ada varian"} sub={search ? "Coba kata kunci lain" : "Tap tombol Tambah"} />
            ) : filteredVariants.map(v => {
              const isLow = v.currentStock < v.minStock;
              return (
                <div key={v.id} data-testid={`variant-${v.id}`}>
                  {editItem && (editItem as VariantItem).id === v.id ? (
                    <VariantForm initial={v} fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setEditItem(null)} />
                  ) : (
                    <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: `1px solid ${isLow ? "#FECACA" : "#F1F5F9"}` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: isLow ? "#FEE2E2" : "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: isLow ? "#DC2626" : "#E85D8C" }}>{v.name[0]}</span>
                          </div>
                          <div>
                            <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>{v.name}</p>
                            <p style={{ fontSize: "11px", color: "#94A3B8" }}>Min: {v.minStock} · Sort: #{v.sortOrder}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-1">
                            <p style={{ fontSize: "16px", fontWeight: "700", color: isLow ? "#DC2626" : "#1C1C1E" }}>{v.currentStock}</p>
                            <p style={{ fontSize: "10px", color: "#94A3B8" }}>pcs</p>
                          </div>
                          <ActionBtn icon={<Pencil size={12} />} color="#E85D8C" bg="#FEF1F5" onClick={() => { setEditItem(v); setShowAddForm(false); setDeleteTarget(null); }} testId={`edit-variant-${v.id}`} />
                          <ActionBtn icon={<Trash2 size={12} />} color="#DC2626" bg="#FEE2E2" onClick={() => { setDeleteTarget({ id: v.id, name: v.name }); setEditItem(null); }} testId={`delete-variant-${v.id}`} />
                        </div>
                      </div>
                      {deleteTarget?.id === v.id && (
                        <ConfirmDelete label={v.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
                      )}
                    </div>
                  )}
                </div>
              );
            }))}

            {/* ── BAHAN BAKU ── */}
            {tab === "bahan" && (filteredIngredients.length === 0 ? (
              <EmptyState label={search ? "Tidak ada hasil" : "Belum ada bahan baku"} sub={search ? "Coba kata kunci lain" : "Tap tombol Tambah"} />
            ) : filteredIngredients.map(ing => {
              const isLow = ing.currentStock < ing.minStock;
              const barPct = Math.min(100, (ing.currentStock / Math.max(ing.minStock * 2, 1)) * 100);
              return (
                <div key={ing.id} data-testid={`ingredient-${ing.id}`}>
                  {editItem && (editItem as IngredientItem).id === ing.id ? (
                    <IngredientForm initial={ing} fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setEditItem(null)} />
                  ) : (
                    <div style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: `1px solid ${isLow ? "#FECACA" : "#F1F5F9"}` }}>
                      <div className="flex items-start justify-between" style={{ marginBottom: "8px" }}>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>{ing.name}</p>
                          <span style={{ padding: "2px 8px", borderRadius: "6px", background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: "10px", color: "#64748B", display: "inline-block", marginTop: "3px" }}>{CAT_LABEL[ing.category] ?? ing.category}</span>
                        </div>
                        <div className="flex items-start gap-1.5 ml-2">
                          <div className="text-right mr-1">
                            <p style={{ fontSize: "16px", fontWeight: "700", color: isLow ? "#DC2626" : "#1C1C1E" }}>{ing.currentStock.toLocaleString("id-ID")}</p>
                            <p style={{ fontSize: "10px", color: "#94A3B8" }}>{ing.baseUnit}</p>
                          </div>
                          <ActionBtn icon={<Pencil size={12} />} color="#E85D8C" bg="#FEF1F5" onClick={() => { setEditItem(ing); setShowAddForm(false); setDeleteTarget(null); }} testId={`edit-ingredient-${ing.id}`} />
                          <ActionBtn icon={<Trash2 size={12} />} color="#DC2626" bg="#FEE2E2" onClick={() => { setDeleteTarget({ id: ing.id, name: ing.name }); setEditItem(null); }} testId={`delete-ingredient-${ing.id}`} />
                        </div>
                      </div>
                      <div style={{ height: "5px", borderRadius: "3px", background: "#F1F5F9" }}>
                        <div style={{ height: "5px", borderRadius: "3px", width: `${barPct}%`, background: isLow ? "#DC2626" : "#16A34A", transition: "width 0.4s" }} />
                      </div>
                      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>Min: {ing.minStock.toLocaleString("id-ID")} {ing.baseUnit}</p>
                      {deleteTarget?.id === ing.id && (
                        <ConfirmDelete label={ing.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
                      )}
                    </div>
                  )}
                </div>
              );
            }))}
          </div>
        )}
      </div>
    </div>
  );
}

const CAT_LABEL: Record<string, string> = { bahan_baku: "Bahan Baku", packaging: "Packaging", operasional: "Operasional" };

function EmptyState({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: "14px", padding: "32px 16px", textAlign: "center", border: "1px solid #F1F5F9" }}>
      <p style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>{label}</p>
      <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>{sub}</p>
    </div>
  );
}

function ActionBtn({ icon, color, bg, onClick, testId }: {
  icon: React.ReactNode; color: string; bg: string; onClick: () => void; testId: string;
}) {
  return (
    <button onClick={onClick} data-testid={testId}
      style={{ width: "30px", height: "30px", borderRadius: "9px", background: bg, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color }}>
      {icon}
    </button>
  );
}
