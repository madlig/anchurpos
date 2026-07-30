"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { 
  Loader2, Plus, X, Check, Package, Layers, Beaker, Pencil, Trash2, Users, Search, 
  Store, Phone, MapPin, MessageCircle, Building2, UserCheck, Tag, CreditCard,
  SlidersHorizontal, ChevronRight, CheckCircle2, ShieldCheck, Sparkles, Filter,
  ChevronDown, ChevronUp, Table, LayoutGrid
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/formatters";

type Tab = "produk" | "bahan" | "pelanggan" | "pemasok";

function fmt(n: number) {
  return formatNumber(n);
}

interface PriceTier { minQty: number; maxQty: number | null; price: number; }
interface ProductItem { id: string; name: string; code: string; category?: string; description: string; packPerBatch: number; priceTiers: PriceTier[]; channels?: string[]; freeSauceAllowance?: number; }
interface VariantItem { id: string; productId: string; name: string; sortOrder: number; currentStock: number; minStock: number; freeSauceAllowance?: number; }
interface IngredientItem { id: string; name: string; category: string; baseUnit: string; currentStock: number; minStock: number; channels?: string[]; unitAlternatives?: { unit: string; conversionToBase: number }[]; defaultCostPerBaseUnit?: number; price?: number; }
interface CustomerItem { id: string; code?: string; name: string; customerType: string; channel: string; phoneNumber: string | null; email?: string | null; address: string | null; notes: string; discountPerUnit: number; creditLimit?: number; }
interface SupplierItem { id: string; name: string; category?: string; phoneNumber?: string | null; address?: string | null; contactPerson?: string | null; notes?: string; }

const PRODUCT_CATEGORIES = [
  { id: "frozen", label: "Frozen Food" },
  { id: "ready_to_eat", label: "Ready to Eat (Siap Saji)" },
  { id: "beverage", label: "Beverage (Minuman)" },
  { id: "bakery", label: "Pastry / Roti" },
  { id: "other", label: "Lain-lain" },
];

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

// ─── Product Form (Parent Product Template) ──────────────────────────────────
function ProductForm({ initial, fetchWithAuth, onSuccess, onCancel }: {
  initial?: ProductItem;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<{
    name: string; code: string; category: string; description: string; packPerBatch: string; channels: string[];
    freeSauceAllowance: string;
  }>({
    name: initial?.name ?? "", code: initial?.code ?? "",
    category: initial?.category ?? "frozen",
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
          name: form.name.trim(), 
          code: form.code.trim().toUpperCase(),
          category: form.category,
          description: form.description.trim(), 
          packPerBatch: parseInt(form.packPerBatch) || 1,
          priceTiers, channels: form.channels, freeSauceAllowance: parseInt(form.freeSauceAllowance) || 0
        })
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4 mb-4 animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-extrabold text-slate-800">{isEdit ? `Edit Produk Induk: ${initial.name}` : "Tambah Produk Induk Baru (Product Template)"}</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label htmlFor="product-name" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Nama Produk Induk *</label>
            <Input id="product-name" name="product-name" placeholder="Contoh: Mozzarella Stick / Kopi Susu Espresso" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-10 text-xs font-semibold" />
          </div>
          <div>
            <label htmlFor="product-code" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Kode Produk *</label>
            <Input id="product-code" name="product-code" placeholder="Contoh: MOZ-01" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} className="h-10 text-xs font-semibold" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="product-category" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Kategori Produk</label>
            <select id="product-category" name="product-category" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs">
              {PRODUCT_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="product-desc" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Deskripsi Produk</label>
            <Input id="product-desc" name="product-desc" placeholder="Keterangan rincian produk..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="h-10 text-xs" />
          </div>
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
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Produk Induk
          </button>
          <button type="button" onClick={onCancel} className="px-5 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Variant Form (Child Variant Attached to Product) ─────────────────────────
function VariantForm({ products, defaultProductId, initial, fetchWithAuth, onSuccess, onCancel }: {
  products: ProductItem[];
  defaultProductId?: string;
  initial?: VariantItem;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
  onSuccess: () => void; onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [productId, setProductId] = useState(initial?.productId || defaultProductId || (products[0]?.id ?? ""));
  const [name, setName] = useState(initial?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? "99"));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!name.trim()) { setErr("Nama varian perisa wajib diisi"); return; }
    if (!productId) { setErr("Pilih Produk Induk wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      const url = isEdit ? `/api/variants/${initial!.id}` : "/api/variants";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({ name: name.trim(), productId, sortOrder: parseInt(sortOrder) || 99 })
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4 mb-4 animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-extrabold text-slate-800">{isEdit ? `Edit Varian Rasa: ${initial.name}` : "Tambah Varian Rasa Produk Baru"}</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <label htmlFor="variant-product-id" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Produk Induk (Parent Product) *</label>
          <select id="variant-product-id" name="variant-product-id" value={productId} onChange={e => setProductId(e.target.value)} className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs">
            <option value="">-- Pilih Produk Induk --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="variant-name" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Nama Varian Rasa / Perisa *</label>
          <Input id="variant-name" name="variant-name" placeholder="Contoh: Original, Keju Lumer, Cokelat Melt" value={name} onChange={e => setName(e.target.value)} className="h-10 text-xs font-semibold" />
        </div>

        <div>
          <label htmlFor="sort-order" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Urutan Tampilan (Sort Order)</label>
          <Input id="sort-order" name="sort-order" type="number" placeholder="99" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="h-10 text-xs font-bold" />
        </div>

        {err && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-center">{err}</div>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Varian Rasa
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
    baseUnit: initial?.baseUnit ?? "pcs",
    minStock: String(initial?.minStock ?? "10"),
    category: initial?.category ?? "bahan_baku",
    defaultCostPerBaseUnit: String(initial?.defaultCostPerBaseUnit ?? "0"),
    price: String(initial?.price ?? "0"),
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
          defaultCostPerBaseUnit: parseFloat(form.defaultCostPerBaseUnit) || 0,
          price: parseFloat(form.price) || 0
        })
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4 mb-4 animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-extrabold text-slate-800">{isEdit ? `Edit Item: ${initial?.name}` : "Tambah Bahan Baku / Packaging / Add-On Baru"}</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ing-name" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Nama Item *</label>
            <Input id="ing-name" name="ing-name" placeholder="Contoh: Gula Bubuk YOA / Pouch 250gr" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="h-10 text-xs font-semibold" />
          </div>
          <div>
            <label htmlFor="ing-unit" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Satuan Dasar (kg, gr, pcs, pouch) *</label>
            <Input id="ing-unit" name="ing-unit" placeholder="Contoh: kg / pcs / gr" value={form.baseUnit} onChange={e => setForm(p => ({ ...p, baseUnit: e.target.value }))} className="h-10 text-xs font-semibold" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label htmlFor="ing-cat" className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Kategori Master Data *</label>
            <select id="ing-cat" name="ing-cat" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs">
              <option value="bahan_baku">🥘 Bahan Baku</option>
              <option value="packaging">📦 Kemasan / Packaging</option>
              <option value="operasional">⚙️ Operasional Outlet</option>
              <option value="add_on">➕ Add-On / Extra POS</option>
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

        {form.category === "add_on" && (
          <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100">
            <label htmlFor="ing-price" className="font-bold text-indigo-900 uppercase tracking-wider block mb-1">Harga Jual Add-On POS (Rp) *</label>
            <Input id="ing-price" name="ing-price" type="number" placeholder="Contoh: 3000" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className="h-10 text-xs font-black text-indigo-900 bg-white" />
          </div>
        )}

        {err && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-center">{err}</div>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Item
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
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("semua");

  useEffect(() => {
    if (tabParam && ["produk", "bahan", "pelanggan"].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editVariantItem, setEditVariantItem] = useState<VariantItem | null>(null);
  const [addVariantForProductId, setAddVariantForProductId] = useState<string | null>(null);
  
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: "product" | "variant" | "ingredient" } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);

  // Customer Edit/Delete/View States (ERP CRM Standard)
  const [customerForm, setCustomerForm] = useState({ 
    code: "", 
    name: "", 
    customerType: "reguler", 
    channel: "walk_in", 
    phoneNumber: "", 
    email: "", 
    address: "", 
    notes: "", 
    discountPerUnit: "0",
    creditLimit: "0"
  });
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("semua");
  const [editCustomerItem, setEditCustomerItem] = useState<CustomerItem | null>(null);
  const [viewCustomerItem, setViewCustomerItem] = useState<CustomerItem | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerDeleteTarget, setCustomerDeleteTarget] = useState<CustomerItem | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  // Supplier Edit/Delete States
  const [supplierForm, setSupplierForm] = useState({ name: "", category: "Bahan Baku", phoneNumber: "", address: "", contactPerson: "", notes: "" });
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierDeleteTarget, setSupplierDeleteTarget] = useState<SupplierItem | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState(false);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, v, i, c, s] = await Promise.all([
        fetchWithAuth("/api/products").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/variants").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/ingredients").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/customers").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/suppliers").then(r => r.ok ? r.json() : []),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
      setIngredients(Array.isArray(i) ? i : []);
      setCustomers(Array.isArray(c) ? c : []);
      setSuppliers(Array.isArray(s) ? s : []);
    } finally { setLoading(false); }
  }, [fetchWithAuth]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function switchTab(t: Tab) {
    setTab(t);
    setShowAddForm(false);
    setEditItem(null);
    setEditVariantItem(null);
    setAddVariantForProductId(null);
    setEditCustomerItem(null);
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
      const endpoint = deleteTarget.type === "variant" ? "variants" : deleteTarget.type === "ingredient" ? "ingredients" : "products";
      const res = await fetchWithAuth(`/api/${endpoint}/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) { setDeleteTarget(null); await loadAll(); }
    } finally { setDeleting(false); }
  }

  async function handleSaveCustomer() {
    if (!customerForm.name.trim()) return;
    setSavingCustomer(true);
    try {
      const isEdit = !!editCustomerItem;
      const url = isEdit ? `/api/customers/${editCustomerItem.id}` : "/api/customers";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          name: customerForm.name.trim(),
          code: customerForm.code.trim() || undefined,
          customerType: customerForm.customerType,
          channel: customerForm.channel,
          phoneNumber: customerForm.phoneNumber || null,
          email: customerForm.email || null,
          address: customerForm.address || null,
          notes: customerForm.notes || "",
          discountPerUnit: parseFloat(customerForm.discountPerUnit) || 0,
          creditLimit: parseFloat(customerForm.creditLimit) || 0
        })
      });
      if (res.ok) {
        setShowAddForm(false);
        setEditCustomerItem(null);
        setCustomerForm({ code: "", name: "", customerType: "reguler", channel: "walk_in", phoneNumber: "", email: "", address: "", notes: "", discountPerUnit: "0", creditLimit: "0" });
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

  async function handleSaveSupplier() {
    if (!supplierForm.name.trim()) return;
    setSavingSupplier(true);
    try {
      const res = await fetchWithAuth("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: supplierForm.name.trim(),
          category: supplierForm.category,
          phoneNumber: supplierForm.phoneNumber || null,
          address: supplierForm.address || null,
          contactPerson: supplierForm.contactPerson || null,
          notes: supplierForm.notes || ""
        })
      });
      if (res.ok) {
        setShowAddForm(false);
        setSupplierForm({ name: "", category: "Bahan Baku", phoneNumber: "", address: "", contactPerson: "", notes: "" });
        await loadAll();
      }
    } finally { setSavingSupplier(false); }
  }

  async function handleDeleteSupplier() {
    if (!supplierDeleteTarget) return;
    setDeletingSupplier(true);
    try {
      const res = await fetchWithAuth(`/api/suppliers/${supplierDeleteTarget.id}`, { method: "DELETE" });
      if (res.ok) { setSupplierDeleteTarget(null); await loadAll(); }
    } finally { setDeletingSupplier(false); }
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "produk", label: "Produk & Varian Rasa", icon: Package },
    { key: "bahan", label: "Bahan, Packaging & Add-On", icon: Beaker },
    { key: "pelanggan", label: "Pelanggan", icon: Users },
    { key: "pemasok", label: "Pemasok (Supplier)", icon: Store },
  ];

  const q = search.toLowerCase();
  const filteredProducts = products.filter(p => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));

  const filteredIngredients = useMemo(() => {
    return ingredients.filter(i => {
      const matchSearch = !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
      const matchSubCat = subCategoryFilter === "semua" || i.category === subCategoryFilter;
      return matchSearch && matchSubCat;
    });
  }, [ingredients, q, subCategoryFilter]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.phoneNumber ?? "").includes(q) || (c.customerType ?? "").toLowerCase().includes(q);
      const matchType = customerTypeFilter === "semua" || (c.customerType || "reguler") === customerTypeFilter;
      return matchSearch && matchType;
    });
  }, [customers, q, customerTypeFilter]);
  const filteredSuppliers = suppliers.filter(s => !q || s.name.toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q));

  const onSuccess = () => { 
    setShowAddForm(false); 
    setEditItem(null); 
    setEditVariantItem(null); 
    setAddVariantForProductId(null);
    loadAll(); 
  };

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
                  Katalog Resmi Produk, Varian Rasa, Bahan Baku & Pelanggan (ERP Standard)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setShowAddForm(prev => !prev); setEditItem(null); setEditVariantItem(null); }}
              className="px-3.5 md:px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Plus size={16} /> Tambah Data
            </button>
          </div>

          {/* Horizontal Scroll Tabs */}
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
        
        {/* Search Bar & ERP View Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="master-search-input"
              name="master-search-input"
              type="text"
              placeholder={`Cari master data ${tab}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20 shadow-2xs"
            />
          </div>

          {/* ERP View Switcher Toggle (Table ERP vs Kartu) */}
          <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                viewMode === "table" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-500 hover:bg-slate-100"
              }`}
              title="Tampilan Tabel ERP (List View)"
            >
              <Table size={14} /> <span className="hidden md:inline">Tabel ERP</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                viewMode === "grid" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-500 hover:bg-slate-100"
              }`}
              title="Tampilan Kartu (Grid View)"
            >
              <LayoutGrid size={14} /> <span className="hidden md:inline">Kartu</span>
            </button>
          </div>
        </div>

        {/* Global Loading */}
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-28 bg-white rounded-3xl border border-slate-200/80 p-4" />
            <div className="h-28 bg-white rounded-3xl border border-slate-200/80 p-4" />
            <div className="h-28 bg-white rounded-3xl border border-slate-200/80 p-4" />
          </div>
        ) : (
          <div>
            
            {/* ── TAB: PRODUK & VARIAN RASA (NESTED PARENT-CHILD VIEW) ── */}
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

                {(editVariantItem || addVariantForProductId) && (
                  <VariantForm
                    products={products}
                    defaultProductId={addVariantForProductId || undefined}
                    initial={editVariantItem || undefined}
                    fetchWithAuth={fetchWithAuth}
                    onSuccess={onSuccess}
                    onCancel={() => { setEditVariantItem(null); setAddVariantForProductId(null); }}
                  />
                )}
                
                <div className="space-y-4">
                  {filteredProducts.map(p => {
                    const productVariants = variants.filter(v => v.productId === p.id || !v.productId); // attach linked or unassigned

                    return (
                      <div key={p.id} className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm relative space-y-4">
                        
                        {/* Parent Product Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100 uppercase tracking-wider">
                                {p.code}
                              </span>
                              <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
                                {PRODUCT_CATEGORIES.find(c => c.id === (p.category || "frozen"))?.label || "Frozen Food"}
                              </span>
                            </div>

                            <h2 className="text-lg font-black text-slate-800 tracking-tight mt-1.5">{p.name}</h2>
                            {p.description && <p className="text-xs text-slate-500 font-medium mt-0.5">{p.description}</p>}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button 
                              type="button"
                              onClick={() => { setEditItem(p); setShowAddForm(false); setEditVariantItem(null); }} 
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs flex items-center gap-1 transition-colors"
                            >
                              <Pencil size={13} /> Edit Produk
                            </button>
                            <button 
                              type="button"
                              onClick={() => setDeleteTarget({ id: p.id, name: p.name, type: "product" })} 
                              className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Product Specs Bar */}
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600">
                          <span>Output: <strong className="text-slate-800">{p.packPerBatch} Pack/Batch</strong></span>
                          <span>Jatah Saos: <strong className="text-slate-800">{p.freeSauceAllowance || 0} Pouch</strong></span>
                          <span className="text-indigo-600 font-extrabold">{p.priceTiers.length} Tiering Harga Grosir</span>
                        </div>

                        {/* Child Variants List Attached to Product */}
                        <div className="pt-2 border-t border-slate-100 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                              <Layers size={14} className="text-amber-500" /> Varian Rasa / Option ({productVariants.length})
                            </span>
                            
                            <button
                              type="button"
                              onClick={() => { setAddVariantForProductId(p.id); setEditVariantItem(null); setShowAddForm(false); }}
                              className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <Plus size={14} /> Tambah Varian Rasa
                            </button>
                          </div>

                          {productVariants.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-slate-50 text-center border border-dashed border-slate-200">
                              <p className="text-xs font-bold text-slate-400">Belum ada varian rasa yang terikat pada produk ini.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              {productVariants.map(v => (
                                <div key={v.id} className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 hover:border-slate-300 transition-colors">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-black text-xs shrink-0">
                                      {v.name[0]}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-extrabold text-xs text-slate-800 truncate">{v.name}</p>
                                      <p className="text-[10px] font-semibold text-slate-400">Urutan: #{v.sortOrder}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => { setEditVariantItem(v); setAddVariantForProductId(null); setShowAddForm(false); }}
                                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteTarget({ id: v.id, name: v.name, type: "variant" })}
                                      className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {deleteTarget?.id === p.id && (
                          <ConfirmDelete label={p.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TAB: BAHAN BAKU, PACKAGING & ADD-ON ── */}
            {tab === "bahan" && (
              <div className="space-y-4">
                
                {/* Sub Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {[
                    { key: "semua", label: "Semua Items" },
                    { key: "bahan_baku", label: "Bahan Baku" },
                    { key: "packaging", label: "Packaging" },
                    { key: "operasional", label: "Operasional" },
                    { key: "add_on", label: "Add-On POS" },
                  ].map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setSubCategoryFilter(f.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        subCategoryFilter === f.key
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

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
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                          ing.category === "add_on" 
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
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
                            onClick={() => setDeleteTarget({ id: ing.id, name: ing.name, type: "ingredient" })} 
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
                        {ing.category === "add_on" && ing.price ? (
                          <span className="text-indigo-600 font-black">Harga Jual: Rp {fmt(ing.price)}</span>
                        ) : ing.defaultCostPerBaseUnit ? (
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

            {/* ── TAB: PELANGGAN (CRM CUSTOMER MASTER DATA) ── */}
            {tab === "pelanggan" && (
              <div className="space-y-4">
                {/* Executive CRM Banner Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black shrink-0">
                      <Users size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Pelanggan</span>
                      <p className="text-xl font-black text-slate-800 tabular-nums">{customers.length} Pelanggan</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center font-black shrink-0">
                      <Tag size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Mitra VIP / Reseller</span>
                      <p className="text-xl font-black text-slate-800 tabular-nums">
                        {customers.filter(c => (c.customerType || "reguler") !== "reguler").length} Mitra
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-black shrink-0">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Diskon Khusus Aktif</span>
                      <p className="text-xl font-black text-slate-800 tabular-nums">
                        {customers.filter(c => c.discountPerUnit > 0).length} Tiers
                      </p>
                    </div>
                  </div>
                </div>

                {/* Gojek / Grab Style Horizontal Scroll Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                  {[
                    { key: "semua", label: "Semua Pelanggan" },
                    { key: "reguler", label: "Reguler" },
                    { key: "reseller", label: "Reseller VIP" },
                    { key: "grosir", label: "Grosir" },
                    { key: "mitra", label: "Mitra Outlet" },
                  ].map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setCustomerTypeFilter(f.key)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all border shrink-0 ${
                        customerTypeFilter === f.key
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Add / Edit Form Drawer Card (ERP CRM Standard) */}
                {(showAddForm || editCustomerItem) && (
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-4 animate-in fade-in zoom-in-95 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-amber-500 to-emerald-500" />
                    
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                          <Users size={20} className="text-indigo-600" />
                          {editCustomerItem ? `Edit Master Data Pelanggan: ${editCustomerItem.name}` : "Registrasi Master Data Pelanggan (SAP & Odoo Standard)"}
                        </h3>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">Kelola profil pelanggan, limit piutang, dan skema diskon khusus tiering</p>
                      </div>
                      <button type="button" onClick={() => { setShowAddForm(false); setEditCustomerItem(null); }} className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Kode Pelanggan (Cust ID)</label>
                          <Input
                            placeholder="Otomatis (e.g. CUST-1042)"
                            value={customerForm.code}
                            onChange={(e) => setCustomerForm(p => ({ ...p, code: e.target.value }))}
                            className="h-10 text-xs font-mono font-bold bg-slate-50"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Nama Pelanggan / Badan Usaha *</label>
                          <Input
                            placeholder="Contoh: Ibu Rina Reseller / PT Kopi Toko Djawa"
                            value={customerForm.name}
                            onChange={(e) => setCustomerForm(p => ({ ...p, name: e.target.value }))}
                            className="h-10 text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Tipe Pelanggan (Tier)</label>
                          <select
                            value={customerForm.customerType}
                            onChange={(e) => setCustomerForm(p => ({ ...p, customerType: e.target.value }))}
                            className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-extrabold text-xs text-slate-800"
                          >
                            <option value="reguler">Reguler</option>
                            <option value="reseller">Reseller VIP</option>
                            <option value="grosir">Grosir</option>
                            <option value="mitra">Mitra Outlet</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">No. WhatsApp / HP</label>
                          <Input
                            placeholder="Contoh: 08123456789"
                            value={customerForm.phoneNumber}
                            onChange={(e) => setCustomerForm(p => ({ ...p, phoneNumber: e.target.value }))}
                            className="h-10 text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Email Pelanggan (Opsional)</label>
                          <Input
                            type="email"
                            placeholder="Contoh: rina@gmail.com"
                            value={customerForm.email}
                            onChange={(e) => setCustomerForm(p => ({ ...p, email: e.target.value }))}
                            className="h-10 text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Channel Utama</label>
                          <select
                            value={customerForm.channel}
                            onChange={(e) => setCustomerForm(p => ({ ...p, channel: e.target.value }))}
                            className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-extrabold text-xs text-slate-800"
                          >
                            <option value="walk_in">Walk-in Outlet</option>
                            <option value="whatsapp">WhatsApp Order</option>
                            <option value="tiktok">TikTok Shop</option>
                            <option value="shopee">Shopee</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Diskon Khusus (Rp/pack)</label>
                          <Input
                            type="number"
                            placeholder="Contoh: 1000"
                            value={customerForm.discountPerUnit}
                            onChange={(e) => setCustomerForm(p => ({ ...p, discountPerUnit: e.target.value }))}
                            className="h-10 text-xs font-bold text-emerald-700"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Alamat Lengkap Pengiriman</label>
                          <Input
                            placeholder="Alamat domisili / lokasi pengiriman utama..."
                            value={customerForm.address}
                            onChange={(e) => setCustomerForm(p => ({ ...p, address: e.target.value }))}
                            className="h-10 text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Limit Piutang / Plafon (Rp)</label>
                          <Input
                            type="number"
                            placeholder="Contoh: 5000000 (Maks Rp 5jt)"
                            value={customerForm.creditLimit}
                            onChange={(e) => setCustomerForm(p => ({ ...p, creditLimit: e.target.value }))}
                            className="h-10 text-xs font-bold text-indigo-700"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleSaveCustomer}
                          disabled={savingCustomer}
                          className="px-6 h-11 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                        >
                          {savingCustomer ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                          {editCustomerItem ? "Simpan Perubahan Master Data" : "Simpan Master Data Pelanggan"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowAddForm(false); setEditCustomerItem(null); }}
                          className="px-5 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 font-extrabold text-slate-600 text-xs"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enterprise ERP Data Table View (SAP & Odoo Standard) */}
                {viewMode === "table" ? (
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden animate-in fade-in">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-extrabold">
                            <th className="py-3.5 px-4 font-extrabold">Kode ID</th>
                            <th className="py-3.5 px-4 font-extrabold">Nama Pelanggan / Toko</th>
                            <th className="py-3.5 px-4 font-extrabold">Tipe Tier</th>
                            <th className="py-3.5 px-4 font-extrabold">Channel Utama</th>
                            <th className="py-3.5 px-4 font-extrabold">Kontak WA</th>
                            <th className="py-3.5 px-4 font-extrabold text-right">Diskon Khusus</th>
                            <th className="py-3.5 px-4 font-extrabold text-right">Limit Piutang</th>
                            <th className="py-3.5 px-4 font-extrabold text-center">Aksi ERP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {filteredCustomers.map((c) => {
                            const cleanPhone = (c.phoneNumber || "").replace(/[^0-9]/g, "");
                            const formattedWa = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
                            const custCode = c.code || `CUST-${c.id.slice(0, 4).toUpperCase()}`;

                            return (
                              <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="py-3.5 px-4 font-mono font-extrabold text-slate-500 whitespace-nowrap">
                                  {custCode}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                    {c.name}
                                  </div>
                                  {c.address && <div className="text-[10px] text-slate-400 font-medium truncate max-w-xs">{c.address}</div>}
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                    c.customerType === "reseller" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    c.customerType === "grosir" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                    c.customerType === "mitra" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                    "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  }`}>
                                    {c.customerType || "Reguler"}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60 uppercase">
                                    {c.channel ? c.channel.replace("_", "-") : "WALK-IN"}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  {formattedWa ? (
                                    <a
                                      href={`https://wa.me/${formattedWa}?text=Halo%20${encodeURIComponent(c.name)},%20salam%20dari%20AnchurPOS!`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-700 font-extrabold hover:underline flex items-center gap-1"
                                    >
                                      <MessageCircle size={14} className="text-emerald-600 shrink-0" />
                                      {c.phoneNumber}
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 font-medium">-</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  {c.discountPerUnit > 0 ? (
                                    <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                      Rp {fmt(c.discountPerUnit)}/pk
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium">-</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  {c.creditLimit && c.creditLimit > 0 ? (
                                    <span className="font-extrabold text-indigo-600">Rp {fmt(c.creditLimit)}</span>
                                  ) : (
                                    <span className="text-slate-400 font-medium">Cash</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setViewCustomerItem(c)}
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                      title="Detail Rekam ERP"
                                    >
                                      <Building2 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditCustomerItem(c);
                                        setCustomerForm({
                                          code: c.code || "",
                                          name: c.name,
                                          customerType: c.customerType || "reguler",
                                          channel: c.channel || "walk_in",
                                          phoneNumber: c.phoneNumber || "",
                                          email: c.email || "",
                                          address: c.address || "",
                                          notes: c.notes || "",
                                          discountPerUnit: String(c.discountPerUnit || 0),
                                          creditLimit: String(c.creditLimit || 0)
                                        });
                                        setShowAddForm(false);
                                      }}
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                      title="Edit"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCustomerDeleteTarget(c)}
                                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                                      title="Hapus"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {filteredCustomers.length === 0 && (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                                Tidak ada data pelanggan ditemukan.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* Professional Clean Grid View (Non-Crowded Kanban) */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {filteredCustomers.map(c => {
                      const isVip = (c.customerType || "reguler") !== "reguler";
                      const cleanPhone = (c.phoneNumber || "").replace(/[^0-9]/g, "");
                      const formattedWa = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
                      const custCode = c.code || `CUST-${c.id.slice(0, 4).toUpperCase()}`;

                      return (
                        <div key={c.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4 hover:shadow-md hover:border-slate-300 transition-all group">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-extrabold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/60">
                                {custCode}
                              </span>
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                c.customerType === "reseller" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                c.customerType === "grosir" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                c.customerType === "mitra" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                "bg-indigo-50 text-indigo-700 border-indigo-200"
                              }`}>
                                {c.customerType || "Reguler"}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 pt-1">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border ${
                                isVip ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-indigo-50 text-indigo-800 border-indigo-200"
                              }`}>
                                {c.name[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-base font-black text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                                  {c.name}
                                </h3>
                                <p className="text-xs font-semibold text-slate-400 flex items-center gap-1 truncate">
                                  <Phone size={12} className="text-slate-400 shrink-0" />
                                  {c.phoneNumber || "-"}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                              {c.address && (
                                <div className="flex items-start gap-1.5 text-slate-500 font-semibold line-clamp-1">
                                  <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                                  <span className="truncate">{c.address}</span>
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-2 pt-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Channel: <strong className="text-slate-700 font-black">{c.channel ? c.channel.replace("_", "-").toUpperCase() : "WALK-IN"}</strong>
                                </span>

                                {c.discountPerUnit > 0 && (
                                  <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px]">
                                    Diskon Rp {fmt(c.discountPerUnit)}/pk
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewCustomerItem(c)}
                              className="flex-1 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                            >
                              <Building2 size={13} /> Detail
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditCustomerItem(c);
                                setCustomerForm({
                                  code: c.code || "",
                                  name: c.name,
                                  customerType: c.customerType || "reguler",
                                  channel: c.channel || "walk_in",
                                  phoneNumber: c.phoneNumber || "",
                                  email: c.email || "",
                                  address: c.address || "",
                                  notes: c.notes || "",
                                  discountPerUnit: String(c.discountPerUnit || 0),
                                  creditLimit: String(c.creditLimit || 0)
                                });
                                setShowAddForm(false);
                              }}
                              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shrink-0"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>

                            {formattedWa && (
                              <a
                                href={`https://wa.me/${formattedWa}?text=Halo%20${encodeURIComponent(c.name)},%20salam%20dari%20AnchurPOS!`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 transition-colors shrink-0"
                                title="WhatsApp"
                              >
                                <MessageCircle size={14} />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => setCustomerDeleteTarget(c)}
                              className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 transition-colors shrink-0"
                              title="Hapus"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {customerDeleteTarget?.id === c.id && (
                            <ConfirmDelete label={c.name} onConfirm={handleDeleteCustomer} onCancel={() => setCustomerDeleteTarget(null)} loading={deletingCustomer} />
                          )}
                        </div>
                      );
                    })}

                    {filteredCustomers.length === 0 && (
                      <div className="col-span-full bg-white rounded-3xl p-10 text-center border border-slate-200/80 space-y-2">
                        <Users size={36} className="text-slate-300 mx-auto" />
                        <p className="text-sm font-bold text-slate-700">Tidak ada pelanggan ditemukan.</p>
                        <p className="text-xs text-slate-400">Klik "+ Tambah Data" untuk mendaftarkan pelanggan baru.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Profile Record View ERP (SAP & Odoo Standard) */}
                {viewCustomerItem && (
                  <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-5 relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-600 via-amber-500 to-emerald-500" />

                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-black">
                            <Building2 size={20} />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono font-extrabold text-slate-400 block">
                              {viewCustomerItem.code || `CUST-${viewCustomerItem.id.slice(0, 4).toUpperCase()}`}
                            </span>
                            <h3 className="text-base font-extrabold text-slate-800">{viewCustomerItem.name}</h3>
                          </div>
                        </div>

                        <button type="button" onClick={() => setViewCustomerItem(null)} className="text-slate-400 hover:text-slate-600">
                          <X size={20} />
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tipe Pelanggan</span>
                            <span className="font-extrabold text-slate-800 uppercase">{viewCustomerItem.customerType || "Reguler"}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Channel Penjualan</span>
                            <span className="font-extrabold text-slate-800 uppercase">{viewCustomerItem.channel ? viewCustomerItem.channel.replace("_", "-") : "WALK-IN"}</span>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                            <span className="font-bold text-slate-500 flex items-center gap-1.5"><Phone size={14} /> No. Telepon / WA</span>
                            <span className="font-extrabold text-slate-800">{viewCustomerItem.phoneNumber || "-"}</span>
                          </div>

                          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                            <span className="font-bold text-slate-500 flex items-center gap-1.5"><Tag size={14} /> Diskon Khusus</span>
                            <span className="font-extrabold text-emerald-600">
                              {viewCustomerItem.discountPerUnit > 0 ? `Rp ${fmt(viewCustomerItem.discountPerUnit)} / pack` : "Tidak ada"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                            <span className="font-bold text-slate-500 flex items-center gap-1.5"><CreditCard size={14} /> Plafon Piutang / Limit</span>
                            <span className="font-extrabold text-indigo-600">
                              {viewCustomerItem.creditLimit && viewCustomerItem.creditLimit > 0 ? `Rp ${fmt(viewCustomerItem.creditLimit)}` : "Tanpa Limit (Cash)"}
                            </span>
                          </div>

                          <div className="py-1.5">
                            <span className="font-bold text-slate-500 block mb-1 flex items-center gap-1.5"><MapPin size={14} /> Alamat Lengkap Pengiriman</span>
                            <p className="font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                              {viewCustomerItem.address || "Belum ada alamat pengiriman terdaftar."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setViewCustomerItem(null)}
                          className="px-5 h-10 rounded-xl bg-slate-900 text-white font-extrabold text-xs shadow-sm"
                        >
                          Tutup Record
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: PEMASOK / SUPPLIER (VENDOR MASTER DATA) ── */}
            {tab === "pemasok" && (
              <div className="space-y-4">
                {showAddForm && (
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                        <Store size={18} className="text-amber-600" /> Tambah Pemasok / Supplier Baru
                      </h3>
                      <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Nama Toko / Supplier *</label>
                          <Input
                            placeholder="Contoh: Toko Bahan Kue Harapan / PT Packaging Jaya"
                            value={supplierForm.name}
                            onChange={(e) => setSupplierForm(p => ({ ...p, name: e.target.value }))}
                            className="h-10 text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Kategori Pemasok</label>
                          <select
                            value={supplierForm.category}
                            onChange={(e) => setSupplierForm(p => ({ ...p, category: e.target.value }))}
                            className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs"
                          >
                            <option value="Bahan Baku">Bahan Baku (Ingredients)</option>
                            <option value="Packaging">Kemasan / Packaging</option>
                            <option value="Operasional">Peralatan Operasional</option>
                            <option value="Lainnya">Lain-lain</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">No. WhatsApp / Telepon</label>
                          <Input
                            placeholder="Contoh: 08123456789"
                            value={supplierForm.phoneNumber}
                            onChange={(e) => setSupplierForm(p => ({ ...p, phoneNumber: e.target.value }))}
                            className="h-10 text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Contact Person (Sales / Admin)</label>
                          <Input
                            placeholder="Contoh: Pak Budi Sales"
                            value={supplierForm.contactPerson}
                            onChange={(e) => setSupplierForm(p => ({ ...p, contactPerson: e.target.value }))}
                            className="h-10 text-xs font-semibold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 uppercase tracking-wider block mb-1">Alamat Pemasok</label>
                        <Input
                          placeholder="Alamat lengkap toko / gudang supplier..."
                          value={supplierForm.address}
                          onChange={(e) => setSupplierForm(p => ({ ...p, address: e.target.value }))}
                          className="h-10 text-xs font-semibold"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleSaveSupplier}
                          disabled={savingSupplier}
                          className="px-5 h-10 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          {savingSupplier ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan Supplier
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddForm(false)}
                          className="px-5 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 text-xs"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {filteredSuppliers.map(s => (
                    <div key={s.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm relative overflow-hidden space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center font-extrabold text-sm">
                          <Store size={18} />
                        </div>

                        <button
                          type="button"
                          onClick={() => setSupplierDeleteTarget(s)}
                          className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-slate-800">{s.name}</h3>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">{s.phoneNumber || "No Telp -"}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase">
                          {s.category || "Bahan Baku"}
                        </span>
                        {s.contactPerson && (
                          <span className="font-semibold text-slate-500">Contact: {s.contactPerson}</span>
                        )}
                      </div>

                      {supplierDeleteTarget?.id === s.id && (
                        <ConfirmDelete label={s.name} onConfirm={handleDeleteSupplier} onCancel={() => setSupplierDeleteTarget(null)} loading={deletingSupplier} />
                      )}
                    </div>
                  ))}

                  {filteredSuppliers.length === 0 && (
                    <div className="col-span-full bg-white rounded-3xl p-10 text-center border border-slate-200/80 space-y-2">
                      <Store size={32} className="text-slate-400 mx-auto" />
                      <p className="text-sm font-bold text-slate-700">Belum ada Pemasok / Supplier terdaftar.</p>
                      <p className="text-xs text-slate-400">Klik "+ Tambah Item Baru" untuk mendaftarkan toko langganan belanja Anda.</p>
                    </div>
                  )}
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
      <div className="min-h-screen bg-slate-50/70 pb-28 animate-pulse">
        <div className="bg-white px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100 space-y-3">
          <div className="max-w-6xl mx-auto space-y-3">
            <div className="h-10 w-48 bg-slate-200 rounded-2xl" />
            <div className="h-8 w-full max-w-md bg-slate-100 rounded-xl" />
          </div>
        </div>
        <div className="px-4 md:px-8 max-w-6xl mx-auto space-y-4 pt-5">
          <div className="h-10 w-full bg-white rounded-2xl border border-slate-200/80" />
          <div className="space-y-3">
            <div className="h-28 bg-white rounded-3xl border border-slate-200/80" />
            <div className="h-28 bg-white rounded-3xl border border-slate-200/80" />
            <div className="h-28 bg-white rounded-3xl border border-slate-200/80" />
          </div>
        </div>
      </div>
    }>
      <MasterDataContent />
    </Suspense>
  );
}
