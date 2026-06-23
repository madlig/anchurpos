"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import {
  Loader2, Plus, Trash2, ShoppingCart, Check, AlertTriangle, X, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import type { Product, Variant, Customer } from "@/types";

interface CartItem {
  productId: string; productName: string;
  variantId: string; variantName: string;
  qty: number; basePrice: number; subtotal: number;
}
interface ProductWithTiers extends Product {
  priceTiers: { minQty: number; maxQty: number | null; price: number }[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const SELECT_CLS = "w-full h-11 rounded-2xl border px-4 pr-10 text-sm font-medium appearance-none focus:outline-none transition-colors";

export default function ManagerPosPage() {
  const { getToken } = useAuth();
  const [products, setProducts] = useState<ProductWithTiers[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("sudah_bayar");

  const [showAddItem, setShowAddItem] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addVariantId, setAddVariantId] = useState("");
  const [addQty, setAddQty] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ orderNumber: string; needsProduction: boolean; hasRainbow: boolean; orderId: string } | null>(null);
  const [error, setError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/products").then((r) => r.json()),
      fetchWithAuth("/api/variants").then((r) => r.json()),
      fetchWithAuth("/api/customers").then((r) => r.json()),
    ]).then(([p, v, c]) => {
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
      setCustomers(Array.isArray(c) ? c : []);
    }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  function getTierPrice(productId: string, qty: number): number {
    const product = products.find((p) => p.id === productId);
    if (!product?.priceTiers?.length) return 0;
    for (const tier of product.priceTiers) {
      if (qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty)) return tier.price;
    }
    return product.priceTiers[0]?.price ?? 0;
  }

  function addToCart() {
    if (!addProductId || !addVariantId || !addQty) return;
    const qty = parseInt(addQty);
    if (qty <= 0) return;
    const product = products.find((p) => p.id === addProductId);
    const variant = variants.find((v) => v.id === addVariantId);
    const price = getTierPrice(addProductId, qty);
    setCart((prev) => [...prev, { productId: addProductId, productName: product?.name ?? addProductId, variantId: addVariantId, variantName: variant?.name ?? addVariantId, qty, basePrice: price, subtotal: price * qty }]);
    setAddProductId(""); setAddVariantId(""); setAddQty(""); setShowAddItem(false);
  }

  const total = cart.reduce((s, item) => s + item.subtotal, 0);

  async function handleSubmit() {
    setError(""); setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/orders", {
        method: "POST",
        body: JSON.stringify({ customerId: selectedCustomer, source: "marketplace_manual", items: cart.map((c) => ({ productId: c.productId, variantId: c.variantId, qty: c.qty })), paymentMethod, paymentStatus }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal membuat order"); return; }
      setResult(data); setCart([]);
    } catch { setError("Gagal membuat order"); } finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} /></div>;

  if (result) {
    return (
      <div className="page-enter flex min-h-screen items-center justify-center px-5" style={{ background: "#F0EDE8" }}>
        <div className="rounded-3xl p-8 text-center w-full max-w-sm" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}>
          <div className="h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "#FEF1F5" }}>
            <Check className="h-8 w-8" style={{ color: "#E85D8C" }} strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight mb-1" style={{ color: "#1C1C1E" }}>Order Berhasil!</h2>
          <p className="text-3xl font-extrabold tabular-nums mb-4" style={{ color: "#E85D8C" }} data-testid="order-number">{result.orderNumber}</p>
          {result.needsProduction && (
            <div className="rounded-2xl p-3 mb-3 text-left" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} style={{ color: "#D97706" }} className="shrink-0" />
                <p className="text-sm font-medium" style={{ color: "#92400E" }}>Stok kurang, perlu produksi tambahan</p>
              </div>
            </div>
          )}
          {result.hasRainbow && (
            <div className="rounded-2xl p-3 mb-3 text-left" style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
              <p className="text-sm font-medium mb-1" style={{ color: "#4C1D95" }}>Order ini berisi Rainbow, perlu di-assembly</p>
              <Link href="/manager/rainbow-assembly" className="text-sm font-semibold underline" style={{ color: "#7C3AED" }}>Ke Rainbow Assembly →</Link>
            </div>
          )}
          <div className="flex gap-2 mt-5">
            <button onClick={() => setResult(null)} className="flex-1 h-12 rounded-2xl font-bold tap-target" style={{ background: "#F1F5F9", color: "#334155", border: "1px solid #E2E8F0" }} data-testid="new-order-button">
              Order Baru
            </button>
            <Link href={`/manager/orders/${result.orderId}`} className="flex-1">
              <button className="w-full h-12 rounded-2xl font-bold text-white tap-target" style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)" }} data-testid="view-order-detail-button">
                Lihat Detail
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter px-5 pt-6 pb-4 md:px-8 md:pt-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "#FEF1F5" }}>
          <ShoppingCart size={16} style={{ color: "#E85D8C" }} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#1C1C1E" }}>Kasir</h1>
      </div>

      {/* Desktop: 2-column layout */}
      <div className="md:grid md:grid-cols-[1fr_340px] md:gap-6 max-w-5xl">
        {/* Left: Customer + Cart */}
        <div>
          {/* Customer selector */}
          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#94A3B8" }}>Pelanggan</label>
            <div className="relative">
              <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className={SELECT_CLS}
                style={{ borderColor: "#E2E8F0", background: "#fff" }} data-testid="customer-select">
                <option value="">Pilih pelanggan...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.channel})</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
            </div>
          </div>

          {/* Cart header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>Item Pesanan</p>
            <button onClick={() => setShowAddItem(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tap-target"
              style={{ background: "#FEF1F5", color: "#E85D8C" }} data-testid="add-item-button">
              <Plus size={13} strokeWidth={2.5} /> Tambah
            </button>
          </div>

          {cart.length === 0 && !showAddItem && (
            <div className="rounded-3xl py-10 text-center mb-4" style={{ background: "#fff", border: "2px dashed #E2E8F0" }}>
              <ShoppingCart size={28} className="mx-auto mb-2" style={{ color: "#CBD5E1" }} />
              <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Belum ada item</p>
              <p className="text-xs mt-1" style={{ color: "#CBD5E1" }}>Tap Tambah untuk mulai</p>
            </div>
          )}

          <div className="space-y-2 mb-4">
            {cart.map((item, idx) => (
              <div key={idx} className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }} data-testid={`cart-item-${idx}`}>
                <div className="min-w-0 flex-1 mr-3">
                  <p className="text-sm font-semibold truncate" style={{ color: "#1C1C1E" }}>{item.productName} — {item.variantName}</p>
                  <p className="text-xs mt-0.5 tabular-nums" style={{ color: "#94A3B8" }}>
                    {item.qty} × {fmt(item.basePrice)} = <span className="font-bold" style={{ color: "#E85D8C" }}>{fmt(item.subtotal)}</span>
                  </p>
                </div>
                <button onClick={() => setCart((p) => p.filter((_, i) => i !== idx))} className="h-8 w-8 rounded-xl flex items-center justify-center tap-target" style={{ background: "#FEF2F2", color: "#DC2626" }} data-testid={`remove-cart-item-${idx}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add item panel */}
          {showAddItem && (
            <div className="rounded-3xl p-5 mb-4" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }} data-testid="add-item-panel">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold" style={{ color: "#1C1C1E" }}>Tambah Item</h3>
                <button onClick={() => setShowAddItem(false)} className="tap-target" style={{ color: "#94A3B8" }}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <select value={addProductId} onChange={(e) => setAddProductId(e.target.value)} className={SELECT_CLS}
                    style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }} data-testid="add-product-select">
                    <option value="">Pilih produk...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
                </div>
                <div className="relative">
                  <select value={addVariantId} onChange={(e) => setAddVariantId(e.target.value)} className={SELECT_CLS}
                    style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }} data-testid="add-variant-select">
                    <option value="">Pilih varian...</option>
                    {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
                </div>
                <Input type="number" min="1" placeholder="Jumlah (pcs/box)" value={addQty} onChange={(e) => setAddQty(e.target.value)}
                  className="h-11 rounded-2xl text-center font-medium" style={{ borderColor: "#E2E8F0" }} data-testid="add-qty-input" />
                {addProductId && addVariantId && addQty && (
                  <div className="text-center py-1">
                    <p className="text-sm font-bold" style={{ color: "#E85D8C" }}>= {fmt(getTierPrice(addProductId, parseInt(addQty) || 0) * (parseInt(addQty) || 0))}</p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>@ {fmt(getTierPrice(addProductId, parseInt(addQty) || 0))} / pcs</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowAddItem(false)} className="flex-1 h-11 rounded-2xl font-bold tap-target" style={{ background: "#F1F5F9", color: "#64748B" }}>Batal</button>
                  <button onClick={addToCart} disabled={!addProductId || !addVariantId || !addQty} className="flex-1 h-11 rounded-2xl font-bold text-white tap-target disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)" }} data-testid="confirm-add-item-button">
                    Tambah ke Keranjang
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Summary & Checkout */}
        <div>
          {cart.length > 0 ? (
            <div className="rounded-3xl p-5 sticky top-6" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
                <span className="text-sm font-bold" style={{ color: "#64748B" }}>Total Pembayaran</span>
                <span className="text-2xl font-extrabold tabular-nums" style={{ color: "#1C1C1E" }} data-testid="cart-total">{fmt(total)}</span>
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#94A3B8" }}>Metode Bayar</label>
                  <div className="relative">
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={SELECT_CLS}
                      style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }} data-testid="payment-method-select">
                      <option value="cash">Cash</option>
                      <option value="transfer">Transfer</option>
                      <option value="qris">QRIS</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#94A3B8" }}>Status Bayar</label>
                  <div className="relative">
                    <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={SELECT_CLS}
                      style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }} data-testid="payment-status-select">
                      <option value="sudah_bayar">Lunas</option>
                      <option value="belum_bayar">Belum Bayar</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
                  </div>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !selectedCustomer || cart.length === 0}
                className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 tap-target disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)", boxShadow: "0 8px 20px rgba(232,93,140,0.3)" }}
                data-testid="create-order-button"
              >
                {submitting ? <Loader2 size={20} className="animate-spin" /> : <ShoppingCart size={20} />}
                Buat Order
              </button>
              {!selectedCustomer && <p className="text-xs text-center mt-2 font-medium" style={{ color: "#D97706" }}>Pilih pelanggan terlebih dahulu</p>}
            </div>
          ) : (
            <div className="rounded-2xl p-6 text-center hidden md:block" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
              <ShoppingCart size={28} className="mx-auto mb-2" style={{ color: "#CBD5E1" }} />
              <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Keranjang kosong</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile checkout (only visible on mobile when cart has items) */}
      {cart.length > 0 && (
        <div className="md:hidden mt-4">
          <div className="rounded-3xl p-5" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold" style={{ color: "#64748B" }}>Total</span>
              <span className="text-2xl font-extrabold tabular-nums" style={{ color: "#1C1C1E" }}>{fmt(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#94A3B8" }}>Metode</label>
                <div className="relative">
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={SELECT_CLS} style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}>
                    <option value="cash">Cash</option><option value="transfer">Transfer</option><option value="qris">QRIS</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#94A3B8" }}>Status</label>
                <div className="relative">
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={SELECT_CLS} style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}>
                    <option value="sudah_bayar">Lunas</option><option value="belum_bayar">Belum Bayar</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
                </div>
              </div>
            </div>
            <button onClick={handleSubmit} disabled={submitting || !selectedCustomer || cart.length === 0}
              className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 tap-target disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)", boxShadow: "0 8px 20px rgba(232,93,140,0.3)" }} data-testid="create-order-button-mobile">
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <ShoppingCart size={20} />}
              Buat Order
            </button>
            {!selectedCustomer && <p className="text-xs text-center mt-2 font-medium" style={{ color: "#D97706" }}>Pilih pelanggan terlebih dahulu</p>}
          </div>
        </div>
      )}

      {error && <div className="rounded-2xl px-4 py-3 mt-4 max-w-5xl" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }} data-testid="pos-error">
        <p className="text-sm font-medium" style={{ color: "#DC2626" }}>{error}</p>
      </div>}
    </div>
  );
}
