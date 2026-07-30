"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { 
  Loader2, Plus, X, Check, Package, Layers, Beaker, Pencil, Trash2, Users, Search, 
  Store, Phone, MapPin, MessageCircle, Building2, UserCheck, Tag, CreditCard,
  SlidersHorizontal, ChevronRight, CheckCircle2, ShieldCheck, Sparkles, Filter,
  ArrowLeft
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/formatters";

type Tab = "produk" | "varian" | "bahan" | "pelanggan" | "addons" | "suppliers";

function fmt(n: number) {
  return formatNumber(n);
}

interface PriceTier { minQty: number; maxQty: number | null; price: number; }
interface ProductItem { id: string; name: string; code: string; description: string; packPerBatch: number; priceTiers: PriceTier[]; channels?: string[]; freeSauceAllowance?: number; }
interface VariantItem { id: string; name: string; sortOrder: number; currentStock: number; minStock: number; freeSauceAllowance?: number; }
interface IngredientItem { id: string; name: string; category: string; baseUnit: string; currentStock: number; minStock: number; channels?: string[]; unitAlternatives?: { unit: string; conversionToBase: number }[]; defaultCostPerBaseUnit?: number; }
interface AddonItem { id: string; name: string; price: number; currentStock: number; minStock: number; channels?: string[]; }
interface SupplierItem { id: string; name: string; contactPerson?: string; phoneNumber?: string; }
interface CustomerItem { id: string; name: string; customerType: string; channel: string; phoneNumber: string | null; address: string | null; notes: string; discountPerUnit: number; }

// ─── Reusable Confirm Delete Overlay ───────────────────────────────────────────
function ConfirmDelete({ label, onConfirm, onCancel, loading }: {
  label: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="absolute inset-0 bg-red-50/95 backdrop-blur-sm rounded-2xl p-4 flex flex-col justify-center items-center z-20 text-center animate-in fade-in zoom-in-95 border-2 border-red-200 shadow-md">
      <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-2 shadow-sm">
        <Trash2 size={20} />
      </div>
      <p className="text-xs font-black text-slate-800 uppercase tracking-wider mb-1">Hapus Data</p>
      <p className="text-xs font-bold text-red-600 mb-3 px-2 line-clamp-2">
        Hapus "{label}" secara permanen?
      </p>
      <div className="flex gap-2 w-full max-w-xs">
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Hapus
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors"
        >
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
  const [form, setForm] = useState<{
    name: string; code: string; description: string; packPerBatch: string; channels: string[];
    freeSauceAllowance: string;
  }>({
    name: initial?.name ?? "", code: initial?.code ?? "",
    description: initial?.description ?? "", packPerBatch: String(initial?.packPerBatch ?? "1"),
    channels: initial?.channels ?? [],
    freeSauceAllowance: String(initial?.freeSauceAllowance ?? "0"),
  });
  const hasMultipleTiers = initial?.priceTiers && (initial.priceTiers.length > 1 || initial.priceTiers.some(t => t.minQty > 1 || t.maxQty !== null));
  const [hasTiering, setHasTiering] = useState<boolean>(hasMultipleTiers || false);
  const [singlePrice, setSinglePrice] = useState<string>(
    initial?.priceTiers?.length ? String(initial.priceTiers[0].price) : ""
  );
  const [tiers, setTiers] = useState<{ minQty: string; maxQty: string; price: string }[]>(
    initial?.priceTiers?.length && hasMultipleTiers
      ? initial.priceTiers.map(t => ({ minQty: String(t.minQty), maxQty: t.maxQty ? String(t.maxQty) : "", price: String(t.price) }))
      : [{ minQty: "1", maxQty: "", price: "" }, { minQty: "", maxQty: "", price: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) { setErr("Nama dan kode wajib diisi"); return; }
    let priceTiers: any[] = [];
    if (!hasTiering) {
      if (!singlePrice) { setErr("Harga wajib diisi"); return; }
      priceTiers = [{ minQty: 1, maxQty: null, price: parseInt(singlePrice) }];
    } else {
      priceTiers = tiers.filter(t => t.price && t.minQty).map(t => ({
        minQty: parseInt(t.minQty), maxQty: t.maxQty ? parseInt(t.maxQty) : null, price: parseInt(t.price),
      }));
      if (priceTiers.length === 0) { setErr("Minimal 1 tier harga harus diisi"); return; }
    }
    setSaving(true); setErr("");
    try {
      const url = isEdit ? `/api/products/${initial!.id}` : "/api/products";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          name: form.name.trim(), code: form.code.trim().toUpperCase(),
          description: form.description.trim(), packPerBatch: parseInt(form.packPerBatch) || 1,
          priceTiers, channels: form.channels, freeSauceAllowance: parseInt(form.freeSauceAllowance) || 0
        })
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4 mb-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-extrabold text-slate-800">{isEdit ? "Edit Produk Jualan" : "Tambah Produk Jualan Baru"}</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="product-name" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Nama Produk *</label>
            <Input id="product-name" name="product-name" placeholder="Contoh: Mozzarella Stick" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-10 text-xs font-semibold" />
          </div>
          <div>
            <label htmlFor="product-code" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Kode Produk *</label>
            <Input id="product-code" name="product-code" placeholder="Contoh: MOZ-01" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} className="h-10 text-xs font-semibold" />
          </div>
        </div>

        <div>
          <label htmlFor="product-desc" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Deskripsi Produk</label>
          <Input id="product-desc" name="product-desc" placeholder="Keterangan rincian produk..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="h-10 text-xs" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pack-per-batch" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Hasil Output (Pack/Batch)</label>
            <Input id="pack-per-batch" name="pack-per-batch" type="number" value={form.packPerBatch} onChange={e => setForm(p => ({ ...p, packPerBatch: e.target.value }))} className="h-10 text-xs font-bold" />
          </div>
          <div>
            <label htmlFor="free-sauce-allowance" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Jatah Saos Gratis (Pouch)</label>
            <Input id="free-sauce-allowance" name="free-sauce-allowance" type="number" value={form.freeSauceAllowance} onChange={e => setForm(p => ({ ...p, freeSauceAllowance: e.target.value }))} className="h-10 text-xs font-bold" />
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">Skema Harga Jual</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hasTiering} onChange={e => setHasTiering(e.target.checked)} className="rounded text-indigo-600" />
              <span className="font-bold text-slate-600">Gunakan Tiering Harga (Grosir)</span>
            </label>
          </div>

          {!hasTiering ? (
            <Input id="single-price" name="single-price" type="number" placeholder="Harga Satuan (Rp)" value={singlePrice} onChange={e => setSinglePrice(e.target.value)} className="h-10 text-xs font-black text-slate-800 bg-white" />
          ) : (
            <div className="space-y-2">
              {tiers.map((t, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input name={`minQty-${idx}`} placeholder="Min Qty" value={t.minQty} onChange={e => { const n = [...tiers]; n[idx].minQty = e.target.value; setTiers(n); }} className="h-9 text-xs bg-white w-20" />
                  <Input name={`maxQty-${idx}`} placeholder="Max Qty" value={t.maxQty} onChange={e => { const n = [...tiers]; n[idx].maxQty = e.target.value; setTiers(n); }} className="h-9 text-xs bg-white w-20" />
                  <Input name={`price-${idx}`} placeholder="Harga per Pack (Rp)" value={t.price} onChange={e => { const n = [...tiers]; n[idx].price = e.target.value; setTiers(n); }} className="h-9 text-xs bg-white flex-1 font-bold" />
                </div>
              ))}
              <button type="button" onClick={() => setTiers(p => [...p, { minQty: "", maxQty: "", price: "" }])} className="text-xs font-bold text-indigo-600 hover:underline">+ Tambah Tiering</button>
            </div>
          )}
        </div>

        {err && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-center">{err}</div>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Produk
          </button>
          <button type="button" onClick={onCancel} className="px-5 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Variant Form (Flavor Master Data) ─────────────────────────────────────────
function VariantForm({ initial, fetchWithAuth, onSuccess, onCancel }: {
  initial?: VariantItem;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? "99"));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!name.trim()) { setErr("Nama varian perisa wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      const url = isEdit ? `/api/variants/${initial!.id}` : "/api/variants";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({ name: name.trim(), sortOrder: parseInt(sortOrder) || 99 })
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4 mb-4 animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-extrabold text-slate-800">{isEdit ? `Edit Varian: ${initial.name}` : "Tambah Varian Perisa Baru"}</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <label htmlFor="variant-name" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Nama Varian Perisa *</label>
          <Input id="variant-name" name="variant-name" placeholder="Contoh: Original, Keju Lumer, Cokelat Melt" value={name} onChange={e => setName(e.target.value)} className="h-10 text-xs font-semibold" />
        </div>

        <div>
          <label htmlFor="sort-order" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Urutan Tampilan (Sort Order)</label>
          <Input id="sort-order" name="sort-order" type="number" placeholder="99" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="h-10 text-xs font-bold" />
        </div>

        {err && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-center">{err}</div>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Varian Perisa
          </button>
          <button type="button" onClick={onCancel} className="px-5 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Ingredient Form ───────────────────────────────────────────────────────────
function IngredientForm({ initial, fetchWithAuth, onSuccess, onCancel }: {
  initial?: IngredientItem;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    baseUnit: initial?.baseUnit ?? "",
    minStock: String(initial?.minStock ?? "10"),
    category: initial?.category ?? "bahan_baku",
    defaultCostPerBaseUnit: String(initial?.defaultCostPerBaseUnit ?? "0"),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim() || !form.baseUnit.trim()) { setErr("Nama dan satuan dasar wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      const url = isEdit ? `/api/ingredients/${initial!.id}` : "/api/ingredients";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          name: form.name.trim(),
          baseUnit: form.baseUnit.trim(),
          category: form.category,
          minStock: parseFloat(form.minStock) || 0,
          defaultCostPerBaseUnit: parseFloat(form.defaultCostPerBaseUnit) || 0
        })
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4 mb-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-extrabold text-slate-800">{isEdit ? "Edit Bahan Baku / Packaging" : "Tambah Bahan Baku Baru"}</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ing-name" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Nama Item *</label>
            <Input id="ing-name" name="ing-name" placeholder="Contoh: Tepung Terigu / Pouch 250gr" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-10 text-xs font-semibold" />
          </div>
          <div>
            <label htmlFor="ing-unit" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Satuan Dasar (kg, gr, pcs) *</label>
            <Input id="ing-unit" name="ing-unit" placeholder="Contoh: kg / pcs" value={form.baseUnit} onChange={e => setForm(p => ({ ...p, baseUnit: e.target.value }))} className="h-10 text-xs font-semibold" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="ing-cat" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Kategori Item</label>
            <select id="ing-cat" name="ing-cat" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs">
              <option value="bahan_baku">Bahan Baku</option>
              <option value="packaging">Kemasan / Packaging</option>
              <option value="operasional">Operasional</option>
            </select>
          </div>
          <div>
            <label htmlFor="ing-min" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Stok Minimal</label>
            <Input id="ing-min" name="ing-min" type="number" value={form.minStock} onChange={e => setForm(p => ({ ...p, minStock: e.target.value }))} className="h-10 text-xs font-bold" />
          </div>
          <div>
            <label htmlFor="ing-hpp" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">HPP Dasar (Rp)</label>
            <Input id="ing-hpp" name="ing-hpp" type="number" value={form.defaultCostPerBaseUnit} onChange={e => setForm(p => ({ ...p, defaultCostPerBaseUnit: e.target.value }))} className="h-10 text-xs font-bold" />
          </div>
        </div>

        {err && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-center">{err}</div>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Bahan Baku
          </button>
          <button type="button" onClick={onCancel} className="px-5 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content Wrapper ──────────────────────────────────────────────────────
function MasterDataContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;

  const [tab, setTab] = useState<Tab>("produk");

  useEffect(() => {
    if (tabParam && ["produk", "varian", "bahan", "pelanggan", "addons", "suppliers"].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);

  // Customer Edit/Delete States
  const [customerForm, setCustomerForm] = useState({ name: "", customerType: "reguler", channel: "walk_in", phoneNumber: "", address: "", notes: "", discountPerUnit: "0" });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerDeleteTarget, setCustomerDeleteTarget] = useState<CustomerItem | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, v, i, c] = await Promise.all([
        fetchWithAuth("/api/products").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/variants").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/ingredients").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/customers").then(r => r.ok ? r.json() : []),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
      setIngredients(Array.isArray(i) ? i : []);
      setCustomers(Array.isArray(c) ? c : []);
    } finally { setLoading(false); }
  }, [fetchWithAuth]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function switchTab(t: Tab) {
    setTab(t);
    setShowAddForm(false);
    setEditItem(null);
    setDeleteTarget(null);
    setSearch("");
    setCustomerDeleteTarget(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", t);
      window.history.replaceState(null, "", url.toString());
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const urlMap: Record<string, string> = { produk: "products", varian: "variants", bahan: "ingredients" };
      const res = await fetchWithAuth(`/api/${urlMap[tab]}/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) { setDeleteTarget(null); await loadAll(); }
    } finally { setDeleting(false); }
  }

  async function handleSaveCustomer() {
    if (!customerForm.name.trim()) return;
    setSavingCustomer(true);
    try {
      const res = await fetchWithAuth("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: customerForm.name,
          customerType: customerForm.customerType,
          channel: customerForm.channel,
          phoneNumber: customerForm.phoneNumber || null,
          address: customerForm.address || null,
          notes: customerForm.notes,
          discountPerUnit: parseFloat(customerForm.discountPerUnit) || 0
        })
      });
      if (res.ok) {
        setShowAddForm(false);
        setCustomerForm({ name: "", customerType: "reguler", channel: "walk_in", phoneNumber: "", address: "", notes: "", discountPerUnit: "0" });
        await loadAll();
      }
    } finally { setSavingCustomer(false); }
  }

  async function handleDeleteCustomer() {
    if (!customerDeleteTarget) return;
    setDeletingCustomer(true);
    try {
      const res = await fetchWithAuth(`/api/customers/${customerDeleteTarget.id}`, { method: "DELETE" });
      if (res.ok) { setCustomerDeleteTarget(null); await loadAll(); }
    } finally { setDeletingCustomer(false); }
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "produk", label: "Produk", icon: Package },
    { key: "varian", label: "Varian Perisa", icon: Layers },
    { key: "bahan", label: "Bahan & Packaging", icon: Beaker },
    { key: "pelanggan", label: "Pelanggan", icon: Users },
  ];

  const q = search.toLowerCase();
  const filteredProducts = products.filter(p => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  const filteredVariants = variants.filter(v => !q || v.name.toLowerCase().includes(q));
  const filteredIngredients = ingredients.filter(i => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  const filteredCustomers = customers.filter(c => !q || c.name.toLowerCase().includes(q) || (c.customerType ?? "").toLowerCase().includes(q));

  const onSuccess = () => { setShowAddForm(false); setEditItem(null); loadAll(); };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      
      {/* Native App Header */}
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto space-y-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                <SlidersHorizontal size={20} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">
                  Master Data Outlet
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  Manajemen Data Produk, Varian Rasa, Bahan Baku & Pelanggan
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setShowAddForm(prev => !prev); setEditItem(null); }}
              className="px-3.5 md:px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Plus size={16} /> Tambah Data
            </button>
          </div>

          {/* Horizontal Scroll Tabs (Gojek / Grab Style) */}
          <div className="overflow-x-auto hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pt-1">
            <div className="flex items-center gap-1.5 min-w-max">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => switchTab(t.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                      isActive 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                        : 'bg-slate-100/80 text-slate-600 border-slate-200/80 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 md:px-8 max-w-6xl mx-auto space-y-4 pt-5">
        
        {/* Search Bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="master-search-input"
            name="master-search-input"
            type="text"
            placeholder={`Cari master data ${tab}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        {/* Global Loading */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
          </div>
        ) : (
          <div>
            
            {/* ── TAB: PRODUK ── */}
            {tab === "produk" && (
              <div className="space-y-4">
                {(showAddForm || editItem) && (
                  <ProductForm 
                    initial={editItem || undefined} 
                    fetchWithAuth={fetchWithAuth} 
                    onSuccess={onSuccess} 
                    onCancel={() => { setShowAddForm(false); setEditItem(null); }} 
                  />
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all relative overflow-hidden space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">
                            {p.code}
                          </span>
                          <h3 className="text-base font-extrabold text-slate-800 mt-1">{p.name}</h3>
                        </div>

                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={() => { setEditItem(p); setShowAddForm(false); }} 
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setDeleteTarget({ id: p.id, name: p.name })} 
                            className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {p.description && <p className="text-xs text-slate-500 font-medium line-clamp-2">{p.description}</p>}

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>Output: {p.packPerBatch} Pack/Batch</span>
                        <span className="text-indigo-600">{p.priceTiers.length} Tiering Harga</span>
                      </div>

                      {deleteTarget?.id === p.id && (
                        <ConfirmDelete label={p.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB: VARIAN PERISA (RASA) ── */}
            {tab === "varian" && (
              <div className="space-y-4">
                {(showAddForm || editItem) && (
                  <VariantForm 
                    initial={editItem || undefined} 
                    fetchWithAuth={fetchWithAuth} 
                    onSuccess={onSuccess} 
                    onCancel={() => { setShowAddForm(false); setEditItem(null); }} 
                  />
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {filteredVariants.map(v => (
                    <div key={v.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm relative overflow-hidden space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-black text-sm shadow-sm">
                          {v.name[0]}
                        </div>

                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={() => { setEditItem(v); setShowAddForm(false); }} 
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setDeleteTarget({ id: v.id, name: v.name })} 
                            className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-slate-800">{v.name}</h3>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">Varian Perisa / Rasa Produk</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500">Urutan Tampil: #{v.sortOrder}</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Aktif POS
                        </span>
                      </div>

                      {deleteTarget?.id === v.id && (
                        <ConfirmDelete label={v.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB: BAHAN BAKU & PACKAGING ── */}
            {tab === "bahan" && (
              <div className="space-y-4">
                {(showAddForm || editItem) && (
                  <IngredientForm 
                    initial={editItem || undefined} 
                    fetchWithAuth={fetchWithAuth} 
                    onSuccess={onSuccess} 
                    onCancel={() => { setShowAddForm(false); setEditItem(null); }} 
                  />
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {filteredIngredients.map(ing => (
                    <div key={ing.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm relative overflow-hidden space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {ing.category.replace('_', ' ')}
                        </span>

                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={() => { setEditItem(ing); setShowAddForm(false); }} 
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                          >
                            <Pencil size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setDeleteTarget({ id: ing.id, name: ing.name })} 
                            className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-slate-800">{ing.name}</h3>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">
                          Stok Gudang: <span className="text-slate-800 font-black">{ing.currentStock} {ing.baseUnit}</span>
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-400">
                        <span>Min Stok: {ing.minStock} {ing.baseUnit}</span>
                        {ing.defaultCostPerBaseUnit ? (
                          <span className="text-slate-700 font-bold">HPP: Rp {fmt(ing.defaultCostPerBaseUnit)}/{ing.baseUnit}</span>
                        ) : null}
                      </div>

                      {deleteTarget?.id === ing.id && (
                        <ConfirmDelete label={ing.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB: PELANGGAN ── */}
            {tab === "pelanggan" && (
              <div className="space-y-4">
                {showAddForm && (
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-3 mb-4">
                    <h3 className="text-sm font-extrabold text-slate-800">Tambah Data Pelanggan Baru</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <Input id="cust-name" name="cust-name" placeholder="Nama Pelanggan *" value={customerForm.name} onChange={e => setCustomerForm(p => ({ ...p, name: e.target.value }))} className="h-10" />
                      <Input id="cust-phone" name="cust-phone" placeholder="Nomor WhatsApp (628...)" value={customerForm.phoneNumber} onChange={e => setCustomerForm(p => ({ ...p, phoneNumber: e.target.value }))} className="h-10" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={handleSaveCustomer} disabled={savingCustomer} className="px-5 h-10 bg-slate-900 text-white rounded-xl font-extrabold text-xs">Simpan Pelanggan</button>
                      <button type="button" onClick={() => setShowAddForm(false)} className="px-4 h-10 bg-slate-100 font-bold text-xs rounded-xl">Batal</button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {filteredCustomers.map(c => (
                    <div key={c.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm relative overflow-hidden space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-sm">
                          {c.name[0]}
                        </div>

                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setCustomerDeleteTarget(c)} className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-slate-800">{c.name}</h3>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">{c.phoneNumber || "No Telp -"}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">
                          {c.customerType || "Reguler"}
                        </span>
                        {c.discountPerUnit > 0 && (
                          <span className="font-bold text-emerald-600">Diskon: Rp {fmt(c.discountPerUnit)}/pack</span>
                        )}
                      </div>

                      {customerDeleteTarget?.id === c.id && (
                        <ConfirmDelete label={c.name} onConfirm={handleDeleteCustomer} onCancel={() => setCustomerDeleteTarget(null)} loading={deletingCustomer} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}

export default function MasterDataPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
      </div>
    }>
      <MasterDataContent />
    </Suspense>
  );
}
