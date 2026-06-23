"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  Trash2,
  ShoppingCart,
  Check,
  AlertTriangle,
  X,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import type { Product, Variant, Customer } from "@/types";

interface CartItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  qty: number;
  basePrice: number;
  subtotal: number;
}

interface ProductWithTiers extends Product {
  priceTiers: { minQty: number; maxQty: number | null; price: number }[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

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
  const [result, setResult] = useState<{
    orderNumber: string;
    needsProduction: boolean;
    hasRainbow: boolean;
    orderId: string;
  } | null>(null);
  const [error, setError] = useState("");

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

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/products").then((r) => r.json()),
      fetchWithAuth("/api/variants").then((r) => r.json()),
      fetchWithAuth("/api/customers").then((r) => r.json()),
    ])
      .then(([p, v, c]) => {
        setProducts(p);
        setVariants(v);
        setCustomers(c);
      })
      .finally(() => setLoading(false));
  }, [fetchWithAuth]);

  function getTierPrice(productId: string, qty: number): number {
    const product = products.find((p) => p.id === productId);
    if (!product?.priceTiers?.length) return 0;
    for (const tier of product.priceTiers) {
      if (qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty)) {
        return tier.price;
      }
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

    setCart((prev) => [
      ...prev,
      {
        productId: addProductId,
        productName: product?.name ?? addProductId,
        variantId: addVariantId,
        variantName: variant?.name ?? addVariantId,
        qty,
        basePrice: price,
        subtotal: price * qty,
      },
    ]);

    setAddProductId("");
    setAddVariantId("");
    setAddQty("");
    setShowAddItem(false);
  }

  function removeFromCart(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = cart.reduce((s, item) => s + item.subtotal, 0);

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedCustomer,
          source: "marketplace_manual",
          items: cart.map((c) => ({
            productId: c.productId,
            variantId: c.variantId,
            qty: c.qty,
          })),
          paymentMethod,
          paymentStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat order");
        return;
      }
      setResult(data);
      setCart([]);
    } catch {
      setError("Gagal membuat order");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="page-enter flex min-h-screen items-center justify-center px-5">
        <div className="rounded-3xl bg-white border border-stone-100 shadow-lg p-8 text-center w-full max-w-sm">
          <div className="h-16 w-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-emerald-600" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black tracking-tight text-stone-900 mb-1">Order Berhasil!</h2>
          <p className="text-3xl font-black tabular-nums text-emerald-600 mb-4" data-testid="order-number">
            {result.orderNumber}
          </p>

          {result.needsProduction && (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3 mb-3 text-left">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800 font-medium">Stok kurang, perlu produksi tambahan</p>
              </div>
            </div>
          )}
          {result.hasRainbow && (
            <div className="rounded-2xl bg-violet-50 border border-violet-100 p-3 mb-3 text-left">
              <p className="text-sm text-violet-800 font-medium mb-1">Order ini berisi Rainbow, perlu di-assembly</p>
              <Link href="/manager/rainbow-assembly" className="text-sm text-violet-600 font-semibold underline">
                Ke halaman Rainbow Assembly →
              </Link>
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <Button
              onClick={() => setResult(null)}
              variant="outline"
              className="flex-1 h-12 rounded-2xl font-bold"
              data-testid="new-order-button"
            >
              Order Baru
            </Button>
            <Link href={`/manager/orders/${result.orderId}`} className="flex-1">
              <Button className="w-full h-12 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700" data-testid="view-order-detail-button">
                Lihat Detail
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter px-5 pt-6 pb-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
          <ShoppingCart size={16} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">Kasir</h1>
        </div>
      </div>

      {/* Customer selector */}
      <div className="mb-4">
        <label className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-2 block">
          Pelanggan
        </label>
        <div className="relative">
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full h-12 rounded-2xl border border-stone-200 bg-white px-4 pr-10 text-sm font-medium text-stone-700 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors"
            data-testid="customer-select"
          >
            <option value="">Pilih pelanggan...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.channel})
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        </div>
      </div>

      {/* Cart items */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400">
            Item Pesanan
          </p>
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors tap-target"
            data-testid="add-item-button"
          >
            <Plus size={13} strokeWidth={2.5} />
            Tambah
          </button>
        </div>

        {cart.length === 0 && !showAddItem && (
          <div className="rounded-3xl bg-stone-100 border-2 border-dashed border-stone-200 py-10 text-center">
            <ShoppingCart size={28} className="mx-auto text-stone-300 mb-2" />
            <p className="text-sm text-stone-400 font-medium">Belum ada item</p>
            <p className="text-xs text-stone-400">Tap Tambah untuk mulai</p>
          </div>
        )}

        <div className="space-y-2">
          {cart.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-white border border-stone-100 shadow-sm px-4 py-3 flex items-center justify-between"
              data-testid={`cart-item-${idx}`}
            >
              <div className="min-w-0 flex-1 mr-3">
                <p className="text-sm font-semibold text-stone-900 truncate">
                  {item.productName} — {item.variantName}
                </p>
                <p className="text-xs text-stone-400 mt-0.5 tabular-nums">
                  {item.qty} × {formatCurrency(item.basePrice)} = <span className="font-bold text-stone-600">{formatCurrency(item.subtotal)}</span>
                </p>
              </div>
              <button
                onClick={() => removeFromCart(idx)}
                className="h-8 w-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-400 hover:bg-rose-100 transition-colors tap-target"
                data-testid={`remove-cart-item-${idx}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add item panel */}
      {showAddItem && (
        <div className="rounded-3xl bg-white border border-stone-200 shadow-sm p-5 mb-4" data-testid="add-item-panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-stone-900">Tambah Item</h3>
            <button onClick={() => setShowAddItem(false)} className="text-stone-400 hover:text-stone-600 tap-target">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <select
                value={addProductId}
                onChange={(e) => setAddProductId(e.target.value)}
                className="w-full h-12 rounded-2xl border border-stone-200 bg-stone-50 px-4 pr-10 text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors"
                data-testid="add-product-select"
              >
                <option value="">Pilih produk...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={addVariantId}
                onChange={(e) => setAddVariantId(e.target.value)}
                className="w-full h-12 rounded-2xl border border-stone-200 bg-stone-50 px-4 pr-10 text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors"
                data-testid="add-variant-select"
              >
                <option value="">Pilih varian...</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            </div>
            <Input
              type="number"
              min="1"
              placeholder="Jumlah (pcs/box)"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              className="h-12 rounded-2xl border-stone-200 bg-stone-50 font-medium text-center"
              data-testid="add-qty-input"
            />
            {addProductId && addVariantId && addQty && (
              <div className="text-center py-1">
                <p className="text-sm font-bold text-emerald-700">
                  = {formatCurrency(getTierPrice(addProductId, parseInt(addQty) || 0) * (parseInt(addQty) || 0))}
                </p>
                <p className="text-xs text-stone-400">@ {formatCurrency(getTierPrice(addProductId, parseInt(addQty) || 0))} / pcs</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => setShowAddItem(false)} variant="outline" className="flex-1 h-11 rounded-2xl font-bold">
                Batal
              </Button>
              <Button
                onClick={addToCart}
                className="flex-1 h-11 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700"
                disabled={!addProductId || !addVariantId || !addQty}
                data-testid="confirm-add-item-button"
              >
                Tambah ke Keranjang
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Order summary & checkout */}
      {cart.length > 0 && (
        <>
          <div className="rounded-3xl bg-white border border-stone-100 shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-stone-500">Total Pembayaran</span>
              <span className="text-2xl font-black tabular-nums text-stone-900" data-testid="cart-total">
                {formatCurrency(total)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2 block">
                  Metode Bayar
                </label>
                <div className="relative">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-11 rounded-2xl border border-stone-200 bg-stone-50 px-3 pr-8 text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors"
                    data-testid="payment-method-select"
                  >
                    <option value="cash">Cash</option>
                    <option value="transfer">Transfer</option>
                    <option value="qris">QRIS</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2 block">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full h-11 rounded-2xl border border-stone-200 bg-stone-50 px-3 pr-8 text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors"
                    data-testid="payment-status-select"
                  >
                    <option value="sudah_bayar">Lunas</option>
                    <option value="belum_bayar">Belum Bayar</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedCustomer || cart.length === 0}
            className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-60 tap-target"
            data-testid="create-order-button"
          >
            {submitting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ShoppingCart size={20} />
            )}
            Buat Order
          </button>

          {!selectedCustomer && (
            <p className="text-xs text-amber-600 text-center mt-2 font-medium">
              Pilih pelanggan terlebih dahulu
            </p>
          )}
        </>
      )}

      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 mt-4" data-testid="pos-error">
          <p className="text-sm text-rose-700 font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
