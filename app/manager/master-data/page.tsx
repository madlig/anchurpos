"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Plus, X, Check, Package, Layers, Beaker, Pencil, Trash2, Users, Search, Store, Phone, MapPin, MessageCircle, Building2, UserCheck, Tag, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/formatters";

type Tab = "produk" | "varian" | "bahan" | "pelanggan" | "addons" | "suppliers" | "configs";

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
    <div className="absolute inset-0 bg-red-50/95 backdrop-blur-sm rounded-[20px] p-4 flex flex-col justify-center items-center z-20 text-center animate-in fade-in zoom-in-95 border-2 border-red-200 shadow-md">
      <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-2 shadow-sm">
        <Trash2 size={20} />
      </div>
      <p className="text-xs font-black text-slate-800 uppercase tracking-wider mb-1">Hapus Data</p>
      <p className="text-xs font-bold text-red-600 mb-3 px-2 line-clamp-2">
        Hapus "{label}" secara permanen?
      </p>
      <div className="flex gap-2 w-full max-w-xs">
        <button
          onClick={onConfirm}
          disabled={loading}
          data-testid="confirm-delete-btn"
          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Hapus
        </button>
        <button
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
      const res = await fetchWithAuth(url, { method, body: JSON.stringify({ ...form, packPerBatch: parseInt(form.packPerBatch) || 1, freeSauceAllowance: parseInt(form.freeSauceAllowance) || 0, priceTiers, channels: form.channels }) });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #E2E8F0", marginBottom: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
      <p style={{ fontSize: "16px", fontWeight: "800", color: "#0F172A", marginBottom: "16px" }}>{isEdit ? "Edit Produk" : "Tambah Produk Baru"}</p>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Input placeholder="Nama produk *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="flex-1 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" data-testid="product-name-input" />
          <Input placeholder="Kode" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
            className="w-28 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" data-testid="product-code-input" />
        </div>
        <div className="flex gap-3">
          <Input placeholder="Deskripsi (Opsional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="flex-1 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" />
          <Input type="number" placeholder="Pack/batch" value={form.packPerBatch} onChange={e => setForm(p => ({ ...p, packPerBatch: e.target.value }))}
            className="w-24 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" title="Jumlah pack yang dihasilkan dari 1 batch produksi" />
          <Input type="number" placeholder="Jatah Saus/Pack" value={form.freeSauceAllowance} onChange={e => setForm(p => ({ ...p, freeSauceAllowance: e.target.value }))}
            className="w-32 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" title="Jatah saus gratis per pack (Contoh: 2)" />
        </div>
        
        <div className="mt-2 p-4 bg-brand-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Harga Produk</p>
              <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>Aktifkan tiering jika harga berubah berdasarkan jumlah beli.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Ada Tiering?</span>
              <input type="checkbox" checked={hasTiering} onChange={e => setHasTiering(e.target.checked)} className="accent-[#E85D8C] w-4 h-4" />
            </label>
          </div>

          {!hasTiering ? (
            <div className="flex items-center gap-2">
              <Input type="number" placeholder="Harga Produk" value={singlePrice} onChange={e => setSinglePrice(e.target.value)}
                className="w-full h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {tiers.map((tier, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input type="number" placeholder="Min qty" value={tier.minQty} onChange={e => setTiers(p => p.map((t, j) => j === i ? { ...t, minQty: e.target.value } : t))}
                      className="w-24 h-10 rounded-lg border-slate-200 text-sm focus-visible:ring-[#E85D8C]" />
                    <span style={{ fontSize: "12px", color: "#94A3B8" }}>–</span>
                    <Input type="number" placeholder="Max (∞)" value={tier.maxQty} onChange={e => setTiers(p => p.map((t, j) => j === i ? { ...t, maxQty: e.target.value } : t))}
                      className="w-24 h-10 rounded-lg border-slate-200 text-sm focus-visible:ring-[#E85D8C]" />
                    <Input type="number" placeholder="Harga" value={tier.price} onChange={e => setTiers(p => p.map((t, j) => j === i ? { ...t, price: e.target.value } : t))}
                      className="flex-1 h-10 rounded-lg border-slate-200 text-sm focus-visible:ring-[#E85D8C]" />
                    {tiers.length > 1 && (
                      <button onClick={() => setTiers(p => p.filter((_, j) => j !== i))}
                        style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#FEF2F2", border: "1px solid #FECACA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                        <X size={14} style={{ color: "#DC2626" }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setTiers(p => [...p, { minQty: "", maxQty: "", price: "" }])}
                style={{ fontSize: "13px", color: "#E85D8C", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontWeight: "700", marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Plus size={16} /> Tambah Tier Harga
              </button>
            </>
          )}
        </div>

        <div className="mt-2 p-4 bg-brand-50 border border-slate-200 rounded-xl">
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Afiliasi Channel</p>
          <p style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "12px" }}>Biarkan kosong jika produk ini tersedia di semua channel.</p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "walkin", label: "Walk-in" },
              { id: "whatsapp", label: "WhatsApp" },
              { id: "tiktok", label: "TikTok" },
              { id: "shopee", label: "Shopee" }
            ].map(ch => {
              const checked = form.channels.includes(ch.id);
              return (
                <label key={ch.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${checked ? 'border-[#E85D8C] bg-primary/10' : 'border-slate-200 bg-white'} cursor-pointer transition-colors`}>
                  <input type="checkbox" checked={checked} className="accent-[#E85D8C]"
                    onChange={(e) => {
                      setForm(p => ({
                        ...p,
                        channels: e.target.checked ? [...p.channels, ch.id] : p.channels.filter(c => c !== ch.id)
                      }));
                    }} />
                  <span style={{ fontSize: "12px", fontWeight: checked ? "600" : "500", color: checked ? "#831843" : "#64748B" }}>{ch.label}</span>
                </label>
              );
            })}
          </div>
        </div>
        
        {err && <p style={{ fontSize: "13px", color: "#DC2626", fontWeight: "500" }}>{err}</p>}
        <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} data-testid="save-product-btn"
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold text-white transition-all shadow-md hover:shadow-lg" style={{ background: "#E85D8C" }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Produk
          </button>
          <button onClick={onCancel} style={{ padding: "0 32px", borderRadius: "12px", background: "#F1F5F9", color: "#475569", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "700", transition: "all 0.2s" }}>Batal</button>
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
    freeSauceAllowance: initial?.freeSauceAllowance !== undefined ? String(initial.freeSauceAllowance) : "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim()) { setErr("Nama varian wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      const url = isEdit ? `/api/variants/${initial!.id}` : "/api/variants";
      const method = isEdit ? "PATCH" : "POST";
      const payload = { 
        name: form.name.trim(), 
        sortOrder: parseInt(form.sortOrder) || 99, 
        minStock: parseInt(form.minStock) || 10,
        freeSauceAllowance: form.freeSauceAllowance !== "" ? parseInt(form.freeSauceAllowance) || 0 : undefined
      };
      const res = await fetchWithAuth(url, { method, body: JSON.stringify(payload) });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #E2E8F0", marginBottom: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
      <p style={{ fontSize: "16px", fontWeight: "800", color: "#0F172A", marginBottom: "16px" }}>{isEdit ? "Edit Varian" : "Tambah Varian Baru"}</p>
      <div className="flex flex-col gap-4">
        <Input placeholder="Nama varian *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          className="h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" data-testid="variant-name-input" />
        <div className="flex gap-3">
          <Input type="number" placeholder="Urutan (contoh: 1)" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))}
            className="w-24 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" />
          <Input type="number" placeholder="Stok min" value={form.minStock} onChange={e => setForm(p => ({ ...p, minStock: e.target.value }))}
            className="flex-1 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" />
          <Input type="number" placeholder="Override Jatah Saus" value={form.freeSauceAllowance} onChange={e => setForm(p => ({ ...p, freeSauceAllowance: e.target.value }))}
            className="flex-1 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" title="Kosongkan jika ingin mengikuti jatah Produk" />
        </div>
        {err && <p style={{ fontSize: "13px", color: "#DC2626", fontWeight: "500" }}>{err}</p>}
        <div className="flex gap-3 mt-2 pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} data-testid="save-variant-btn"
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold text-white transition-all shadow-md hover:shadow-lg" style={{ background: "#E85D8C" }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Varian
          </button>
          <button onClick={onCancel} style={{ padding: "0 32px", borderRadius: "12px", background: "#F1F5F9", color: "#475569", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "700", transition: "all 0.2s" }}>Batal</button>
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
  const [form, setForm] = useState<{
    name: string; baseUnit: string; minStock: string; category: string; channels: string[];
    unitAlternatives: { unit: string; conversionToBase: string }[];
    defaultCostPerBaseUnit: string;
  }>({
    name: initial?.name ?? "", baseUnit: initial?.baseUnit ?? "",
    minStock: String(initial?.minStock ?? "0"), category: initial?.category ?? "bahan_baku",
    channels: initial?.channels ?? [],
    unitAlternatives: initial?.unitAlternatives?.map(u => ({ unit: u.unit, conversionToBase: String(u.conversionToBase) })) ?? [],
    defaultCostPerBaseUnit: String(initial?.defaultCostPerBaseUnit ?? "0"),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!form.name.trim() || !form.baseUnit.trim()) { setErr("Nama dan satuan wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      const url = isEdit ? `/api/ingredients/${initial!.id}` : "/api/ingredients";
      const method = isEdit ? "PATCH" : "POST";
      const parsedAlternatives = form.unitAlternatives
        .filter(u => u.unit.trim() && parseFloat(u.conversionToBase) > 0)
        .map(u => ({ unit: u.unit.trim(), conversionToBase: parseFloat(u.conversionToBase) }));
      
      const res = await fetchWithAuth(url, { 
        method, 
        body: JSON.stringify({ 
          name: form.name.trim(), 
          baseUnit: form.baseUnit.trim(), 
          category: form.category, 
          minStock: parseFloat(form.minStock) || 0, 
          channels: form.channels,
          unitAlternatives: parsedAlternatives,
          defaultCostPerBaseUnit: parseFloat(form.defaultCostPerBaseUnit) || 0
        }) 
      });
      if (!res.ok) { setErr((await res.json()).error ?? "Gagal"); return; }
      onSuccess();
    } finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #E2E8F0", marginBottom: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
      <p style={{ fontSize: "16px", fontWeight: "800", color: "#0F172A", marginBottom: "16px" }}>{isEdit ? "Edit Bahan Baku" : "Tambah Bahan Baku Baru"}</p>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Input placeholder="Nama bahan *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="flex-1 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" data-testid="ingredient-name-input" />
          <Input placeholder="Satuan (kg, gr) *" value={form.baseUnit} onChange={e => setForm(p => ({ ...p, baseUnit: e.target.value }))}
            className="w-32 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" />
        </div>
        <div className="flex gap-3">
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            style={{ flex: 1, padding: "0 16px", height: "48px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "14px", background: "#fff", outline: "none" }}>
            <option value="bahan_baku">Bahan Baku</option>
            <option value="packaging">Packaging</option>
            <option value="operasional">Operasional</option>
          </select>
          <Input type="number" placeholder="Stok min" value={form.minStock} onChange={e => setForm(p => ({ ...p, minStock: e.target.value }))}
            className="w-24 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" />
          <Input type="number" placeholder="HPP Dasar" value={form.defaultCostPerBaseUnit} onChange={e => setForm(p => ({ ...p, defaultCostPerBaseUnit: e.target.value }))}
            className="flex-1 h-12 rounded-xl border-slate-200 text-sm focus-visible:ring-[#E85D8C]" />
        </div>

        <div className="mt-2 p-4 bg-brand-50 border border-slate-200 rounded-xl space-y-3">
          <div>
            <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Satuan Alternatif (Opsional)</p>
            <p style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "8px" }}>Tambahkan satuan pembelian lain beserta rasio konversinya ke satuan dasar ({form.baseUnit || "..."}). Contoh: 1 botol = 55 ml</p>
          </div>
          
          {form.unitAlternatives.map((alt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">1</span>
              <Input 
                placeholder="mis. botol" 
                value={alt.unit} 
                onChange={e => {
                  const newAlts = [...form.unitAlternatives];
                  newAlts[idx].unit = e.target.value;
                  setForm(p => ({ ...p, unitAlternatives: newAlts }));
                }}
                className="w-24 h-9 rounded-lg border-slate-200 text-xs focus-visible:ring-[#E85D8C]" 
              />
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">=</span>
              <Input 
                type="number"
                placeholder="mis. 55" 
                value={alt.conversionToBase} 
                onChange={e => {
                  const newAlts = [...form.unitAlternatives];
                  newAlts[idx].conversionToBase = e.target.value;
                  setForm(p => ({ ...p, unitAlternatives: newAlts }));
                }}
                className="w-20 h-9 rounded-lg border-slate-200 text-xs focus-visible:ring-[#E85D8C]" 
              />
              <span className="text-xs font-bold text-slate-500">{form.baseUnit || "dasar"}</span>
              <button 
                type="button" 
                onClick={() => setForm(p => ({ ...p, unitAlternatives: p.unitAlternatives.filter((_, i) => i !== idx) }))}
                className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, unitAlternatives: [...p.unitAlternatives, { unit: "", conversionToBase: "" }] }))}
            className="flex items-center gap-1.5 text-xs font-bold text-[#E85D8C] hover:text-primary active:scale-95 transition-transform"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20">+</span>
            Tambah Satuan Alternatif
          </button>
        </div>

        <div className="p-4 bg-brand-50 border border-slate-200 rounded-xl">
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Afiliasi Channel</p>
          <p style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "12px" }}>Biarkan kosong jika bahan ini tersedia di semua channel.</p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "walkin", label: "Walk-in" },
              { id: "whatsapp", label: "WhatsApp" },
              { id: "tiktok", label: "TikTok" },
              { id: "shopee", label: "Shopee" }
            ].map(ch => {
              const checked = form.channels.includes(ch.id);
              return (
                <label key={ch.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${checked ? 'border-[#E85D8C] bg-primary/10' : 'border-slate-200 bg-white'} cursor-pointer transition-colors`}>
                  <input type="checkbox" checked={checked} className="accent-[#E85D8C]"
                    onChange={(e) => {
                      setForm(p => ({
                        ...p,
                        channels: e.target.checked ? [...p.channels, ch.id] : p.channels.filter(c => c !== ch.id)
                      }));
                    }} />
                  <span style={{ fontSize: "12px", fontWeight: checked ? "600" : "500", color: checked ? "#831843" : "#64748B" }}>{ch.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {err && <p style={{ fontSize: "13px", color: "#DC2626", fontWeight: "500" }}>{err}</p>}
        <div className="flex gap-3 mt-2 pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} data-testid="save-ingredient-btn"
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold text-white transition-all shadow-md hover:shadow-lg" style={{ background: "#E85D8C" }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Bahan
          </button>
          <button onClick={onCancel} style={{ padding: "0 32px", borderRadius: "12px", background: "#F1F5F9", color: "#475569", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "700", transition: "all 0.2s" }}>Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
function MasterDataContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(() => {
    if (tabParam && ["produk", "varian", "bahan", "pelanggan", "addons", "suppliers", "configs"].includes(tabParam)) {
      return tabParam;
    }
    return "produk";
  });

  useEffect(() => {
    if (tabParam && ["produk", "varian", "bahan", "pelanggan", "addons", "suppliers", "configs"].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);

  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Generic states for Products, Variants, Ingredients
  const [editItem, setEditItem] = useState<ProductItem | VariantItem | IngredientItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);

  // ── Pelanggan state ──
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: "", customerType: "reguler", channel: "walk_in", phoneNumber: "", address: "", notes: "", discountPerUnit: "0" });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerDeleteTarget, setCustomerDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  // ── Add-on & Supplier states ──
  const [addOns, setAddOns] = useState<AddonItem[]>([]);
  const [editingAddon, setEditingAddon] = useState<AddonItem | null>(null);
  const [addonForm, setAddonForm] = useState<{ name: string; price: string; minStock: string; channels: string[] }>({ name: "", price: "", minStock: "10", channels: [] });
  const [savingAddon, setSavingAddon] = useState(false);
  const [addonDeleteTarget, setAddonDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingAddon, setDeletingAddon] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", contactPerson: "", phoneNumber: "" });
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierDeleteTarget, setSupplierDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState(false);

  // ── Configs state ──
  const [configs, setConfigs] = useState<{ paymentMethods: string[], deliveryMethods: string[], shippingBorneBy: string[] }>({ paymentMethods: [], deliveryMethods: [], shippingBorneBy: [] });
  const [savingConfigs, setSavingConfigs] = useState(false);

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, v, i, c, a, s, configsRes] = await Promise.all([
        fetchWithAuth("/api/products").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/variants").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/ingredients").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/customers").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/addons").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/suppliers").then(r => r.ok ? r.json() : []),
        fetchWithAuth("/api/system-configs").then(r => r.ok ? r.json() : null),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
      setIngredients(Array.isArray(i) ? i : []);
      setCustomers(Array.isArray(c) ? c : []);
      setAddOns(Array.isArray(a) ? a : []);
      setSuppliers(Array.isArray(s) ? s : []);
      if (configsRes) {
        setConfigs({
          paymentMethods: configsRes.paymentMethods || [],
          deliveryMethods: configsRes.deliveryMethods || [],
          shippingBorneBy: configsRes.shippingBorneBy || [],
        });
      }
    } finally { setLoading(false); }
  }, [fetchWithAuth]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function switchTab(t: Tab) {
    setTab(t);
    setShowAddForm(false);
    setEditItem(null);
    setDeleteTarget(null);
    setSearch("");
    setEditingCustomer(null);
    setCustomerDeleteTarget(null);
    setEditingAddon(null);
    setAddonDeleteTarget(null);
    setEditingSupplier(null);
    setSupplierDeleteTarget(null);
  }

  // General Generic Delete
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const urlMap: Record<string, string> = { produk: "products", varian: "variants", bahan: "ingredients" };
      const res = await fetchWithAuth(`/api/${urlMap[tab]}/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) { setDeleteTarget(null); await loadAll(); }
    } finally { setDeleting(false); }
  }

  // Customer Handlers
  async function handleSaveCustomer() {
    if (!customerForm.name.trim()) return;
    setSavingCustomer(true);
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers";
      const method = editingCustomer ? "PATCH" : "POST";
      const res = await fetchWithAuth(url, {
        method,
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
        setEditingCustomer(null);
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

  // Addon Handlers
  async function handleSaveAddon() {
    if (!addonForm.name.trim() || !addonForm.price) return;
    setSavingAddon(true);
    try {
      const url = editingAddon ? `/api/addons/${editingAddon.id}` : "/api/addons";
      const method = editingAddon ? "PATCH" : "POST";
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          name: addonForm.name,
          price: Number(addonForm.price),
          minStock: Number(addonForm.minStock || 10),
          channels: addonForm.channels
        })
      });
      if (res.ok) {
        setShowAddForm(false);
        setEditingAddon(null);
        setAddonForm({ name: "", price: "", minStock: "10", channels: [] });
        await loadAll();
      }
    } finally { setSavingAddon(false); }
  }

  async function handleDeleteAddon() {
    if (!addonDeleteTarget) return;
    setDeletingAddon(true);
    try {
      const res = await fetchWithAuth(`/api/addons/${addonDeleteTarget.id}`, { method: "DELETE" });
      if (res.ok) { setAddonDeleteTarget(null); await loadAll(); }
    } finally { setDeletingAddon(false); }
  }

  // Supplier Handlers
  async function handleSaveSupplier() {
    if (!supplierForm.name.trim()) return;
    setSavingSupplier(true);
    try {
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : "/api/suppliers";
      const method = editingSupplier ? "PATCH" : "POST";
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          name: supplierForm.name,
          contactPerson: supplierForm.contactPerson || null,
          phoneNumber: supplierForm.phoneNumber || null
        })
      });
      if (res.ok) {
        setShowAddForm(false);
        setEditingSupplier(null);
        setSupplierForm({ name: "", contactPerson: "", phoneNumber: "" });
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

  // Configs Handlers
  async function handleSaveConfigs() {
    setSavingConfigs(true);
    try {
      const res = await fetchWithAuth("/api/system-configs", {
        method: "POST",
        body: JSON.stringify({
          paymentMethods: configs.paymentMethods,
          expenseCategories: ["bahan_baku", "packaging", "operasional", "lain_lain"], // Keep existing defaults for now
          deliveryMethods: configs.deliveryMethods,
          shippingBorneBy: configs.shippingBorneBy
        })
      });
      if (res.ok) {
        await loadAll();
      }
    } finally { setSavingConfigs(false); }
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "produk", label: "Produk", icon: Package },
    { key: "varian", label: "Varian", icon: Layers },
    { key: "bahan", label: "Bahan", icon: Beaker },
    { key: "pelanggan", label: "Pelanggan", icon: Users },
    { key: "addons", label: "Add-on", icon: Plus },
    { key: "suppliers", label: "Supplier", icon: Store },
    { key: "configs", label: "Pembayaran & Pengiriman", icon: Store },
  ];
  const q = search.toLowerCase();
  const filteredProducts = products.filter(p => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  const filteredVariants = variants.filter(v => !q || v.name.toLowerCase().includes(q));
  const filteredIngredients = ingredients.filter(i => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  const filteredCustomers = customers.filter(c => !q || c.name.toLowerCase().includes(q) || (c.customerType ?? "").toLowerCase().includes(q));
  const filteredAddOns = addOns.filter(a => !q || a.name.toLowerCase().includes(q));
  const filteredSuppliers = suppliers.filter(s => !q || s.name.toLowerCase().includes(q) || (s.contactPerson ?? "").toLowerCase().includes(q));

  const onSuccess = () => { setShowAddForm(false); setEditItem(null); loadAll(); };

  const CTYPE_LABEL: Record<string, string> = { reguler: "Reguler", b2b: "B2B", reseller: "Reseller" };
  const CTYPE_COLOR: Record<string, { bg: string; color: string; border: string }> = {
    reguler: { bg: "#F0FDF4", color: "#16A34A", border: "#DCFCE7" },
    b2b: { bg: "#EFF6FF", color: "#2563EB", border: "#DBEAFE" },
    reseller: { bg: "#FEF3C7", color: "#D97706", border: "#FDE68A" },
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#FEF1F5" }}>
      <div className="sticky top-0 z-30 pt-4 pb-4 bg-white/90 backdrop-blur-xl border-b border-pink-200 shadow-sm">
        <div className="px-5 max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight drop-shadow-sm">Master Data</h1>
              <p className="text-slate-500 text-sm font-medium mt-1">Kelola inventori dan pelanggan Anchur.us</p>
            </div>
            <button
              onClick={() => {
                if (tab === "pelanggan") { setEditingCustomer(null); setCustomerForm({ name: "", customerType: "reguler", channel: "walk_in", phoneNumber: "", address: "", notes: "", discountPerUnit: "0" }); }
                else if (tab === "addons") { setEditingAddon(null); setAddonForm({ name: "", price: "", minStock: "10", channels: [] }); }
                else if (tab === "suppliers") { setEditingSupplier(null); setSupplierForm({ name: "", contactPerson: "", phoneNumber: "" }); }
                else { setEditItem(null); }
                setShowAddForm(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-sm hover:shadow-md hover:bg-primary transition-all active:scale-95"
            >
              <Plus size={18} strokeWidth={2.5} /> Tambah Data
            </button>
          </div>
          
          {/* Scrollable Pill Tabs */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2 md:mx-0 md:px-0">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => switchTab(t.key)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-full whitespace-nowrap text-[14px] font-bold transition-all duration-300 shadow-sm border ${
                    isActive 
                      ? "bg-primary text-white border-primary scale-100" 
                      : "bg-white text-slate-500 border-slate-200 hover:bg-brand-50 scale-95 hover:scale-100 hover:border-slate-300"
                  }`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-white" : "text-slate-500"} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-5 max-w-7xl mx-auto">
        {/* Search Bar */}
        <div className="relative mb-6 mt-2 animate-in fade-in slide-in-from-top-2">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-[#E85D8C]" />
          </div>
          <Input 
            placeholder={`Cari di ${TABS.find(t => t.key === tab)?.label}...`} 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="pl-12 h-14 bg-white rounded-2xl border-none text-[15px] focus-visible:ring-2 focus-visible:ring-[#E85D8C]/50 shadow-sm transition-shadow hover:shadow-md"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <Loader2 className="h-12 w-12 animate-spin mb-4 text-[#E85D8C]" />
            <p className="font-semibold text-[15px]">Memuat data master...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            {/* ── SHOW GENERIC FORMS ── */}
            {showAddForm && tab === "produk" && <div className="max-w-2xl"><ProductForm fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setShowAddForm(false)} /></div>}
            {showAddForm && tab === "varian" && <div className="max-w-2xl"><VariantForm fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setShowAddForm(false)} /></div>}
            {showAddForm && tab === "bahan" && <div className="max-w-2xl"><IngredientForm fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setShowAddForm(false)} /></div>}

            {/* ── GRID SYSTEM CONTAINER ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              
              {/* ── PRODUK ── */}
              {tab === "produk" && (filteredProducts.length === 0 && !showAddForm ? (
                <div className="col-span-full"><EmptyState label={search ? "Tidak ada hasil pencarian" : "Belum ada produk"} sub={search ? "Coba kata kunci lain" : "Klik tombol Tambah Data di atas"} /></div>
              ) : filteredProducts.map(p => (
                <div key={p.id} className={`animate-in fade-in zoom-in-95 duration-300 ${editItem && (editItem as ProductItem).id === p.id ? "col-span-full" : ""}`}>
                  {editItem && (editItem as ProductItem).id === p.id ? (
                    <ProductForm initial={p} fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setEditItem(null)} />
                  ) : (
                    <PremiumCard>
                      <div className="flex flex-col h-full">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-[16px] font-extrabold text-slate-800 leading-tight">{p.name}</h3>
                          <div className="flex gap-1 ml-2">
                            <ActionBtn icon={<Pencil size={12} />} color="#E85D8C" bg="#FEF1F5" hoverBg="#FCE7F3" onClick={() => { setEditItem(p); setShowAddForm(false); setDeleteTarget(null); }} />
                            <ActionBtn icon={<Trash2 size={12} />} color="#DC2626" bg="#FEF2F2" hoverBg="#FEE2E2" onClick={() => { setDeleteTarget({ id: p.id, name: p.name }); setEditItem(null); }} />
                          </div>
                        </div>
                        <div className="mb-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-black text-slate-600 tracking-wider">SKU: {p.code}</span>
                        </div>
                        {p.description && <p className="text-sm text-slate-500 mb-4 flex-grow line-clamp-2">{p.description}</p>}
                        {!p.description && <div className="flex-grow"></div>}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <Badge label={`${p.packPerBatch} pack/batch`} bg="#F0F9FF" color="#0284C7" border="#E0F2FE" />
                          <Badge label={`${p.priceTiers.length} tier harga`} bg="#FEF2F2" color="#DC2626" border="#FECACA" />
                        </div>
                      </div>
                      {deleteTarget?.id === p.id && (
                        <ConfirmDelete label={p.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
                      )}
                    </PremiumCard>
                  )}
                </div>
              )))}

              {/* ── VARIAN ── */}
              {tab === "varian" && (filteredVariants.length === 0 && !showAddForm ? (
                <div className="col-span-full"><EmptyState label={search ? "Tidak ada hasil pencarian" : "Belum ada varian"} sub={search ? "Coba kata kunci lain" : "Klik tombol Tambah Data di atas"} /></div>
              ) : filteredVariants.map(v => {
                const isLow = v.currentStock < v.minStock;
                return (
                  <div key={v.id} className={`animate-in fade-in zoom-in-95 duration-300 ${editItem && (editItem as VariantItem).id === v.id ? "col-span-full" : ""}`}>
                    {editItem && (editItem as VariantItem).id === v.id ? (
                      <VariantForm initial={v} fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setEditItem(null)} />
                    ) : (
                      <PremiumCard danger={isLow}>
                        <div className="flex flex-col h-full">
                          <div className="flex justify-between items-start mb-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isLow ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-primary/10 text-[#E85D8C] border border-primary/20'}`}>
                              <span className="text-xl font-black">{v.name[0]}</span>
                            </div>
                            <div className="flex gap-1">
                              <ActionBtn icon={<Pencil size={12} />} color="#E85D8C" bg="#FEF1F5" hoverBg="#FCE7F3" onClick={() => { setEditItem(v); setShowAddForm(false); setDeleteTarget(null); }} />
                              <ActionBtn icon={<Trash2 size={12} />} color="#DC2626" bg="#FEF2F2" hoverBg="#FEE2E2" onClick={() => { setDeleteTarget({ id: v.id, name: v.name }); setEditItem(null); }} />
                            </div>
                          </div>
                          <h3 className="text-[17px] font-black text-slate-800 mb-1">{v.name}</h3>
                          <p className="text-[12px] text-slate-400 font-bold mb-4">Urutan: #{v.sortOrder}</p>
                          
                          <div className="mt-auto pt-4 border-t border-slate-100 flex items-end justify-between">
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Sisa Stok</p>
                              <div className="flex items-baseline gap-1">
                                <p className={`text-2xl font-black tracking-tight ${isLow ? "text-red-600" : "text-slate-800"}`}>{v.currentStock}</p>
                                <p className="text-xs font-bold text-slate-500">pcs</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Min. Stok</p>
                              <Badge label={`${v.minStock}`} bg="#F1F5F9" color="#475569" border="#E2E8F0" />
                            </div>
                          </div>
                        </div>
                        {deleteTarget?.id === v.id && (
                          <ConfirmDelete label={v.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
                        )}
                      </PremiumCard>
                    )}
                  </div>
                );
              }))}

              {/* ── BAHAN BAKU ── */}
              {tab === "bahan" && (filteredIngredients.length === 0 && !showAddForm ? (
                <div className="col-span-full"><EmptyState label={search ? "Tidak ada hasil pencarian" : "Belum ada bahan baku"} sub={search ? "Coba kata kunci lain" : "Klik tombol Tambah Data di atas"} /></div>
              ) : filteredIngredients.map(ing => {
                const isLow = ing.currentStock < ing.minStock;
                const barPct = Math.min(100, (ing.currentStock / Math.max(ing.minStock * 2, 1)) * 100);
                const CAT_LABEL: Record<string, string> = { bahan_baku: "Bahan Baku", packaging: "Packaging", operasional: "Operasional" };
                return (
                  <div key={ing.id} className={`animate-in fade-in zoom-in-95 duration-300 ${editItem && (editItem as IngredientItem).id === ing.id ? "col-span-full" : ""}`}>
                    {editItem && (editItem as IngredientItem).id === ing.id ? (
                      <IngredientForm initial={ing} fetchWithAuth={fetchWithAuth} onSuccess={onSuccess} onCancel={() => setEditItem(null)} />
                    ) : (
                      <PremiumCard danger={isLow}>
                        <div className="flex flex-col h-full">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-[16px] font-extrabold text-slate-800 leading-tight pr-2">{ing.name}</h3>
                            <div className="flex gap-1 flex-shrink-0">
                              <ActionBtn icon={<Pencil size={12} />} color="#E85D8C" bg="#FEF1F5" hoverBg="#FCE7F3" onClick={() => { setEditItem(ing); setShowAddForm(false); setDeleteTarget(null); }} />
                              <ActionBtn icon={<Trash2 size={12} />} color="#DC2626" bg="#FEF2F2" hoverBg="#FEE2E2" onClick={() => { setDeleteTarget({ id: ing.id, name: ing.name }); setEditItem(null); }} />
                            </div>
                          </div>
                          <div className="mb-5">
                            <Badge label={CAT_LABEL[ing.category] ?? ing.category} bg="#F1F5F9" color="#64748B" border="#E2E8F0" />
                          </div>
                          
                          <div className="mt-auto">
                            <div className="flex items-baseline gap-1 mb-2">
                              <p className={`text-2xl font-black tracking-tight ${isLow ? "text-red-600" : "text-slate-800"}`}>{formatNumber(ing.currentStock)}</p>
                              <p className="text-[12px] font-bold text-slate-500 uppercase">{ing.baseUnit}</p>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                              <div className={`h-full transition-all duration-500 ease-out ${isLow ? "bg-red-500" : "bg-[#E85D8C]"}`} style={{ width: `${barPct}%` }} />
                            </div>
                            <div className="flex justify-between items-center">
                              <p className="text-xs font-bold text-slate-400">Min: {formatNumber(ing.minStock)} {ing.baseUnit}</p>
                              {isLow && <span className="text-xs font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded">LOW</span>}
                            </div>
                          </div>
                        </div>
                        {deleteTarget?.id === ing.id && (
                          <ConfirmDelete label={ing.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
                        )}
                      </PremiumCard>
                    )}
                  </div>
                );
              }))}

              {/* ── ADD-ON & SAOS ── */}
              {tab === "addons" && (
                <>
                  {(showAddForm || editingAddon) && (
                    <div className="col-span-full max-w-2xl bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-2 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[16px] font-extrabold text-slate-800 mb-5">{editingAddon ? "Edit Add-on" : "Tambah Add-on Baru"}</p>
                      <div className="flex flex-col gap-4">
                        <Input placeholder="Nama Add-on" value={addonForm.name} onChange={e => setAddonForm(p => ({ ...p, name: e.target.value }))} className="h-12 rounded-xl text-sm focus-visible:ring-[#E85D8C]" />
                        <div className="flex gap-4">
                          <Input type="number" placeholder="Harga Jual (Rp)" value={addonForm.price} onChange={e => setAddonForm(p => ({ ...p, price: e.target.value }))} className="h-12 flex-1 rounded-xl text-sm focus-visible:ring-[#E85D8C]" />
                          <Input type="number" placeholder="Min Stok" value={addonForm.minStock} onChange={e => setAddonForm(p => ({ ...p, minStock: e.target.value }))} className="h-12 w-32 rounded-xl text-sm focus-visible:ring-[#E85D8C]" />
                        </div>
                        
                        <div className="mt-2 p-4 bg-brand-50 border border-slate-200 rounded-xl">
                          <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Afiliasi Channel</p>
                          <p style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "12px" }}>Biarkan kosong jika Add-on ini tersedia di semua channel.</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: "walkin", label: "Walk-in" },
                              { id: "whatsapp", label: "WhatsApp" },
                              { id: "tiktok", label: "TikTok" },
                              { id: "shopee", label: "Shopee" }
                            ].map(ch => {
                              const checked = addonForm.channels.includes(ch.id);
                              return (
                                <label key={ch.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${checked ? 'border-[#E85D8C] bg-primary/10' : 'border-slate-200 bg-white'} cursor-pointer transition-colors`}>
                                  <input type="checkbox" checked={checked} className="accent-[#E85D8C]"
                                    onChange={(e) => {
                                      setAddonForm(p => ({
                                        ...p,
                                        channels: e.target.checked ? [...p.channels, ch.id] : p.channels.filter(c => c !== ch.id)
                                      }));
                                    }} />
                                  <span style={{ fontSize: "12px", fontWeight: checked ? "600" : "500", color: checked ? "#831843" : "#64748B" }}>{ch.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-3 mt-2 pt-4 border-t border-slate-100">
                          <button onClick={handleSaveAddon} disabled={savingAddon} className="flex-1 flex justify-center items-center h-12 rounded-xl bg-[#E85D8C] text-white text-sm font-bold shadow-[0_4px_12px_rgba(232,93,140,0.2)] hover:bg-[#D94E7A] transition-colors">
                            {savingAddon ? <Loader2 size={16} className="animate-spin" /> : "Simpan Add-on"}
                          </button>
                          <button onClick={() => { setShowAddForm(false); setEditingAddon(null); }} className="px-8 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors">Batal</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {filteredAddOns.length === 0 && !showAddForm ? (
                    <div className="col-span-full"><EmptyState label={search ? "Tidak ada hasil pencarian" : "Belum ada add-on / saos"} sub={search ? "Coba kata kunci lain" : "Klik tombol Tambah Data di atas"} /></div>
                  ) : filteredAddOns.map(a => {
                    const isLow = a.currentStock < a.minStock;
                    if (editingAddon?.id === a.id) return null;
                    return (
                      <div key={a.id} className="animate-in fade-in zoom-in-95 duration-300">
                        <PremiumCard danger={isLow}>
                          <div className="flex flex-col h-full">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-[17px] font-black text-slate-800">{a.name}</h3>
                              <div className="flex gap-1">
                                <ActionBtn icon={<Pencil size={12} />} color="#E85D8C" bg="#FEF1F5" hoverBg="#FCE7F3" onClick={() => { setEditingAddon(a); setAddonForm({ name: a.name, price: String(a.price), minStock: String(a.minStock), channels: a.channels ?? [] }); setShowAddForm(false); setAddonDeleteTarget(null); }} />
                                <ActionBtn icon={<Trash2 size={12} />} color="#DC2626" bg="#FEF2F2" hoverBg="#FEE2E2" onClick={() => { setAddonDeleteTarget({ id: a.id, name: a.name }); setEditingAddon(null); }} />
                              </div>
                            </div>
                            <p className="text-[18px] font-black text-[#E85D8C] mb-6">{fmt(a.price)}</p>
                            
                            <div className="mt-auto pt-3 border-t border-slate-100 flex items-end justify-between">
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Sisa Stok</p>
                                <div className="flex items-baseline gap-1">
                                  <p className={`text-2xl font-black tracking-tight ${isLow ? "text-red-600" : "text-slate-800"}`}>{a.currentStock}</p>
                                  <p className="text-xs font-bold text-slate-500 uppercase">cup</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Min Stok</p>
                                <Badge label={`${a.minStock} CUP`} bg="#F1F5F9" color="#475569" border="#E2E8F0" />
                              </div>
                            </div>
                          </div>
                          {addonDeleteTarget?.id === a.id && (
                            <ConfirmDelete label={a.name} onConfirm={handleDeleteAddon} onCancel={() => setAddonDeleteTarget(null)} loading={deletingAddon} />
                          )}
                        </PremiumCard>
                      </div>
                    );
                  })}
                </>
              )}

              {/* ── SUPPLIER ── */}
              {tab === "suppliers" && (
                <>
                  {(showAddForm || editingSupplier) && (
                    <div className="col-span-full max-w-2xl bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-4 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[16px] font-extrabold text-slate-800 mb-5">{editingSupplier ? "Edit Supplier" : "Tambah Supplier Baru"}</p>
                      <div className="flex flex-col gap-4">
                        <Input placeholder="Nama Perusahaan / Supplier *" value={supplierForm.name} onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))} className="h-12 rounded-xl text-sm focus-visible:ring-[#E85D8C]" />
                        <div className="flex gap-4">
                          <Input placeholder="Nama Kontak (PIC)" value={supplierForm.contactPerson} onChange={e => setSupplierForm(p => ({ ...p, contactPerson: e.target.value }))} className="flex-1 h-12 rounded-xl text-sm focus-visible:ring-[#E85D8C]" />
                          <Input placeholder="Nomor Telepon / WA" value={supplierForm.phoneNumber} onChange={e => setSupplierForm(p => ({ ...p, phoneNumber: e.target.value }))} className="flex-1 h-12 rounded-xl text-sm focus-visible:ring-[#E85D8C]" />
                        </div>
                        <div className="flex gap-3 mt-2 pt-4 border-t border-slate-100">
                          <button onClick={handleSaveSupplier} disabled={savingSupplier} className="flex-1 flex justify-center items-center h-12 rounded-xl bg-[#E85D8C] text-white text-sm font-bold shadow-[0_4px_12px_rgba(232,93,140,0.2)] hover:bg-[#D94E7A] transition-colors">
                            {savingSupplier ? <Loader2 size={16} className="animate-spin" /> : "Simpan Supplier"}
                          </button>
                          <button onClick={() => { setShowAddForm(false); setEditingSupplier(null); }} className="px-8 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors">Batal</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {filteredSuppliers.length === 0 && !showAddForm ? (
                    <div className="col-span-full"><EmptyState label={search ? "Tidak ada hasil pencarian" : "Belum ada data supplier"} sub={search ? "Coba kata kunci lain" : "Klik tombol Tambah Data di atas"} /></div>
                  ) : filteredSuppliers.map(s => {
                    if (editingSupplier?.id === s.id) return null;
                    return (
                      <div key={s.id} className="animate-in fade-in zoom-in-95 duration-300">
                        <PremiumCard>
                          <div className="flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                <Store size={18} className="text-slate-400" />
                              </div>
                              <div className="flex gap-1">
                                <ActionBtn icon={<Pencil size={12} />} color="#E85D8C" bg="#FEF1F5" hoverBg="#FCE7F3" onClick={() => { setEditingSupplier(s); setSupplierForm({ name: s.name, contactPerson: s.contactPerson ?? "", phoneNumber: s.phoneNumber ?? "" }); setShowAddForm(false); setSupplierDeleteTarget(null); }} />
                                <ActionBtn icon={<Trash2 size={12} />} color="#DC2626" bg="#FEF2F2" hoverBg="#FEE2E2" onClick={() => { setSupplierDeleteTarget({ id: s.id, name: s.name }); setEditingSupplier(null); }} />
                              </div>
                            </div>
                            <h3 className="text-[16px] font-black text-slate-800 mb-4">{s.name}</h3>
                            
                            <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-slate-100">
                              <div className="flex items-center gap-2">
                                <Users size={14} className="text-slate-400" />
                                <p className="text-[12px] font-bold text-slate-600">{s.contactPerson || <span className="text-slate-300 font-medium italic">Tidak ada PIC</span>}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Search size={14} className="text-slate-400" /> {/* Should be Phone icon normally, repurposing search for demo or remove icon */}
                                <p className="text-[12px] font-bold text-slate-600">{s.phoneNumber || <span className="text-slate-300 font-medium italic">Tidak ada kontak</span>}</p>
                              </div>
                            </div>
                          </div>
                          {supplierDeleteTarget?.id === s.id && (
                            <ConfirmDelete label={s.name} onConfirm={handleDeleteSupplier} onCancel={() => setSupplierDeleteTarget(null)} loading={deletingSupplier} />
                          )}
                        </PremiumCard>
                      </div>
                    );
                  })}
                </>
              )}

              {/* ── PELANGGAN (CUSTOMER) ── */}
              {tab === "pelanggan" && (
                <>
                  {(showAddForm || editingCustomer) && (
                    <div className="col-span-full max-w-3xl bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${editingCustomer ? 'bg-amber-50 text-amber-600' : 'bg-violet-50 text-violet-600'}`}>
                            {editingCustomer ? <Pencil size={16} /> : <Users size={16} />}
                          </div>
                          <div>
                            <p className="text-base font-extrabold text-slate-800">
                              {editingCustomer ? `Edit Data Pelanggan: ${editingCustomer.name}` : "Tambah Pelanggan Baru"}
                            </p>
                            {editingCustomer && (
                              <p className="text-xs font-semibold text-slate-400">Perbarui informasi kontak, tipe, atau diskon otomatis pelanggan ini</p>
                            )}
                          </div>
                        </div>
                        <button onClick={() => { setShowAddForm(false); setEditingCustomer(null); }} className="text-slate-400 hover:text-slate-600">
                          <X size={18} />
                        </button>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block ml-1">Nama Pelanggan / Toko *</label>
                          <Input placeholder="Nama Lengkap / Nama Toko *" value={customerForm.name} onChange={e => setCustomerForm(p => ({ ...p, name: e.target.value }))} className="h-12 rounded-xl text-sm focus-visible:ring-primary" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Tipe Pelanggan</label>
                            <select value={customerForm.customerType} onChange={e => setCustomerForm(p => ({ ...p, customerType: e.target.value }))}
                              className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                              <option value="reguler">Reguler</option>
                              <option value="reseller">Reseller</option>
                              <option value="b2b">B2B (Bisnis / Mitra)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Sumber Channel Utama</label>
                            <select value={customerForm.channel} onChange={e => setCustomerForm(p => ({ ...p, channel: e.target.value }))}
                              className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                              <option value="walk_in">Walk-in Outlet</option>
                              <option value="whatsapp">WhatsApp</option>
                              <option value="shopee">Shopee</option>
                              <option value="tiktok">TikTok</option>
                              <option value="tokopedia">Tokopedia</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block ml-1">No. WhatsApp / HP</label>
                            <Input placeholder="Contoh: 08123456789" value={customerForm.phoneNumber} onChange={e => setCustomerForm(p => ({ ...p, phoneNumber: e.target.value }))} className="h-12 rounded-xl text-sm focus-visible:ring-primary" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-primary uppercase tracking-wider mb-2 block ml-1">Diskon Otomatis (Rp / Unit)</label>
                            <Input type="number" placeholder="0" value={customerForm.discountPerUnit} onChange={e => setCustomerForm(p => ({ ...p, discountPerUnit: e.target.value }))} className="h-12 rounded-xl text-sm focus-visible:ring-primary border-rose-200 bg-rose-50/30" />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Alamat Pengiriman</label>
                          <Input placeholder="Alamat lengkap lokasi pelanggan" value={customerForm.address} onChange={e => setCustomerForm(p => ({ ...p, address: e.target.value }))} className="h-12 rounded-xl text-sm focus-visible:ring-primary" />
                        </div>
                        
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Catatan Tambahan</label>
                          <Input placeholder="Catatan preferensi pesanan atau info mitra" value={customerForm.notes} onChange={e => setCustomerForm(p => ({ ...p, notes: e.target.value }))} className="h-12 rounded-xl text-sm focus-visible:ring-primary" />
                        </div>

                        <div className="flex gap-3 mt-4 pt-5 border-t border-slate-100">
                          <button onClick={handleSaveCustomer} disabled={savingCustomer} className="flex-1 flex justify-center items-center h-12 rounded-xl bg-primary text-white text-sm font-bold shadow-md hover:bg-rose-600 transition-colors">
                            {savingCustomer ? <Loader2 size={18} className="animate-spin" /> : (editingCustomer ? "Update Data Pelanggan" : "Simpan Pelanggan")}
                          </button>
                          <button onClick={() => { setShowAddForm(false); setEditingCustomer(null); }} className="px-8 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors">Batal</button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {filteredCustomers.length === 0 && !showAddForm ? (
                    <div className="col-span-full"><EmptyState label={search ? "Tidak ada pelanggan ditemukan" : "Belum ada data pelanggan"} sub={search ? "Coba kata kunci pencarian lain" : "Klik tombol Tambah Data di atas untuk menambahkan pelanggan"} /></div>
                  ) : filteredCustomers.map(c => {
                    if (editingCustomer?.id === c.id) return null;
                    const st = CTYPE_COLOR[c.customerType] || CTYPE_COLOR.reguler;
                    const cleanPhone = c.phoneNumber ? c.phoneNumber.replace(/[^0-9]/g, "") : "";
                    const waFormatted = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;

                    return (
                      <div key={c.id} className="animate-in fade-in zoom-in-95 duration-300">
                        <PremiumCard>
                          <div className="flex flex-col h-full relative overflow-hidden space-y-3">
                            
                            {/* Card Header Row */}
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center font-black text-violet-700 text-sm shrink-0 shadow-sm">
                                  {(c.name || "?")[0].toUpperCase()}
                                </div>
                                <div>
                                  <h3 className="text-base font-extrabold text-slate-800 leading-tight">{c.name}</h3>
                                  <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider mt-0.5 border ${st.border}`} style={{ backgroundColor: st.bg, color: st.color }}>
                                    {CTYPE_LABEL[c.customerType] || c.customerType}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <ActionBtn icon={<Pencil size={13} />} color="#64748B" bg="#F1F5F9" hoverBg="#E2E8F0" onClick={() => { setEditingCustomer(c); setCustomerForm({ name: c.name, customerType: c.customerType, channel: c.channel, phoneNumber: c.phoneNumber ?? "", address: c.address ?? "", notes: c.notes ?? "", discountPerUnit: String(c.discountPerUnit || 0) }); setShowAddForm(false); setCustomerDeleteTarget(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
                                <ActionBtn icon={<Trash2 size={13} />} color="#DC2626" bg="#FEF2F2" hoverBg="#FEE2E2" onClick={() => { setCustomerDeleteTarget({ id: c.id, name: c.name }); setEditingCustomer(null); }} />
                              </div>
                            </div>
                            
                            {/* Details List */}
                            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-400 flex items-center gap-1">
                                  <Phone size={12} /> Kontak HP
                                </span>
                                {c.phoneNumber ? (
                                  <a 
                                    href={`https://wa.me/${waFormatted}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="font-bold text-emerald-600 hover:underline flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50"
                                  >
                                    <MessageCircle size={11} /> {c.phoneNumber}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 italic">Tidak ada nomor</span>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-400 flex items-center gap-1">
                                  <Store size={12} /> Asal Channel
                                </span>
                                <span className="font-bold text-slate-700 capitalize">
                                  {c.channel?.replace("_", " ") || "Walk-in"}
                                </span>
                              </div>

                              {c.address && (
                                <div className="flex items-start gap-1 pt-1 text-slate-600">
                                  <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                                  <span className="text-[11px] font-medium leading-snug line-clamp-2">{c.address}</span>
                                </div>
                              )}
                            </div>
                            
                            {c.discountPerUnit > 0 && (
                              <div className="mt-auto bg-rose-50 border border-rose-100 rounded-xl p-2 flex items-center justify-between text-xs">
                                <span className="font-bold text-primary flex items-center gap-1">
                                  <Tag size={12} /> Diskon Otomatis
                                </span>
                                <span className="font-black text-rose-600">-{fmt(c.discountPerUnit)} / unit</span>
                              </div>
                            )}
                          </div>
                          {customerDeleteTarget?.id === c.id && (
                            <ConfirmDelete label={c.name} onConfirm={handleDeleteCustomer} onCancel={() => setCustomerDeleteTarget(null)} loading={deletingCustomer} />
                          )}
                        </PremiumCard>
                      </div>
                    );
                  })}
                </>
              )}

            </div>
          </div>
        )}

        {/* ─── CONFIGS TAB ─── */}
        {tab === "configs" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
            <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100">
              <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <Store size={24} className="text-[#E85D8C]" /> Konfigurasi Pembayaran & Pengiriman
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payment Methods */}
                <div className="bg-slate-50 p-5 rounded-[16px] border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Metode Pembayaran</h3>
                  <div className="flex flex-col gap-2 mb-4">
                    {configs.paymentMethods.map((m, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={m} onChange={e => {
                          const newM = [...configs.paymentMethods];
                          newM[i] = e.target.value;
                          setConfigs({ ...configs, paymentMethods: newM });
                        }} className="bg-white" />
                        <button onClick={() => {
                          const newM = configs.paymentMethods.filter((_, idx) => idx !== i);
                          setConfigs({ ...configs, paymentMethods: newM });
                        }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setConfigs({ ...configs, paymentMethods: [...configs.paymentMethods, ""] })} className="text-sm font-bold text-[#E85D8C] flex items-center gap-1 hover:bg-pink-50 p-2 rounded-lg transition-colors"><Plus size={16}/> Tambah Metode</button>
                </div>

                {/* Delivery Methods */}
                <div className="bg-slate-50 p-5 rounded-[16px] border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Metode Pengiriman</h3>
                  <div className="flex flex-col gap-2 mb-4">
                    {configs.deliveryMethods.map((m, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={m} onChange={e => {
                          const newM = [...configs.deliveryMethods];
                          newM[i] = e.target.value;
                          setConfigs({ ...configs, deliveryMethods: newM });
                        }} className="bg-white" />
                        <button onClick={() => {
                          const newM = configs.deliveryMethods.filter((_, idx) => idx !== i);
                          setConfigs({ ...configs, deliveryMethods: newM });
                        }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setConfigs({ ...configs, deliveryMethods: [...configs.deliveryMethods, ""] })} className="text-sm font-bold text-[#E85D8C] flex items-center gap-1 hover:bg-pink-50 p-2 rounded-lg transition-colors"><Plus size={16}/> Tambah Metode</button>
                </div>

                {/* Shipping Borne By */}
                <div className="bg-slate-50 p-5 rounded-[16px] border border-slate-100 md:col-span-2">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Penanggung Ongkir</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {configs.shippingBorneBy.map((m, i) => (
                      <div key={i} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                        <Input value={m} onChange={e => {
                          const newM = [...configs.shippingBorneBy];
                          newM[i] = e.target.value;
                          setConfigs({ ...configs, shippingBorneBy: newM });
                        }} className="border-none shadow-none h-8 w-32 focus-visible:ring-0" />
                        <button onClick={() => {
                          const newM = configs.shippingBorneBy.filter((_, idx) => idx !== i);
                          setConfigs({ ...configs, shippingBorneBy: newM });
                        }} className="p-1 text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={14}/></button>
                      </div>
                    ))}
                    <button onClick={() => setConfigs({ ...configs, shippingBorneBy: [...configs.shippingBorneBy, ""] })} className="text-sm font-bold text-[#E85D8C] flex items-center gap-1 hover:bg-pink-50 p-2 rounded-lg transition-colors"><Plus size={16}/> Tambah Opsi</button>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                <button onClick={handleSaveConfigs} disabled={savingConfigs} className="bg-[#E85D8C] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-pink-600 transition-colors shadow-sm">
                  {savingConfigs ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Simpan Konfigurasi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared UI Components ────────────────────────────────────────────────────────

function PremiumCard({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-white rounded-[20px] p-5 shadow-sm border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg h-full ${danger ? "border-red-200 bg-red-50/20" : "border-slate-100 hover:border-pink-200"}`}>
      {children}
    </div>
  );
}

function Badge({ label, bg, color, border }: { label: string; bg: string; color: string; border: string }) {
  return (
    <span style={{ backgroundColor: bg, color: color, borderColor: border }} className="px-2 py-1 rounded-[8px] border text-xs font-black uppercase tracking-wider">
      {label}
    </span>
  );
}

function EmptyState({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="bg-white rounded-[24px] p-16 text-center border-2 border-primary/20 border-dashed shadow-sm">
      <div className="w-20 h-20 bg-primary/10 rounded-[20px] flex items-center justify-center mx-auto mb-5 border border-primary/20">
        <Package size={32} className="text-[#E85D8C]" />
      </div>
      <p className="text-[16px] font-black text-slate-800">{label}</p>
      <p className="text-[14px] font-semibold text-slate-400 mt-2">{sub}</p>
    </div>
  );
}

function ActionBtn({ icon, color, bg, hoverBg, onClick }: {
  icon: React.ReactNode; color: string; bg: string; hoverBg: string; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button 
      onClick={onClick} 
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-colors shadow-sm"
      style={{ backgroundColor: hover ? hoverBg : bg, color: color }}
    >
      {icon}
    </button>
  );
}

export default function MasterDataPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <MasterDataContent />
    </Suspense>
  );
}
