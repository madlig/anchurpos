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
  ShoppingCart,
  Check,
  AlertTriangle,
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

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="p-5">
        <Card className="p-6 text-center">
          <Check className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-stone-900 mb-1">
            Order Berhasil!
          </h2>
          <p className="text-2xl font-mono font-bold text-emerald-600 mb-3">
            {result.orderNumber}
          </p>
          {result.needsProduction && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <p className="text-sm text-amber-800 flex items-center gap-2 justify-center">
                <AlertTriangle size={16} /> Stok kurang, perlu produksi
                tambahan
              </p>
            </div>
          )}
          {result.hasRainbow && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
              <p className="text-sm text-purple-800 mb-1">
                Order ini berisi Rainbow, perlu di-assembly
              </p>
              <Link
                href="/manager/rainbow-assembly"
                className="text-sm text-purple-600 underline"
              >
                Ke halaman Rainbow Assembly
              </Link>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => setResult(null)}
              className="flex-1"
              variant="outline"
            >
              Order Baru
            </Button>
            <Link href={`/manager/orders/${result.orderId}`} className="flex-1">
              <Button className="w-full">Lihat Detail</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-1">Kasir</h1>
      <p className="text-sm text-stone-500 mb-5">Buat order baru</p>

      <div className="mb-4">
        <label className="text-xs text-stone-500 mb-1 block">Pelanggan</label>
        <select
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm bg-white"
        >
          <option value="">Pilih pelanggan...</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.channel})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-stone-900">Item</h2>
          <Button
            onClick={() => setShowAddItem(true)}
            size="sm"
            variant="outline"
            className="gap-1"
          >
            <Plus size={14} /> Tambah
          </Button>
        </div>

        {cart.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-6">
            Belum ada item. Tap + Tambah untuk mulai.
          </p>
        )}

        <div className="space-y-2">
          {cart.map((item, idx) => (
            <Card key={idx} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-stone-900">
                  {item.productName} — {item.variantName}
                </p>
                <p className="text-xs text-stone-500">
                  {item.qty} x {formatCurrency(item.basePrice)} ={" "}
                  {formatCurrency(item.subtotal)}
                </p>
              </div>
              <button
                onClick={() => removeFromCart(idx)}
                className="text-stone-400 hover:text-red-500 p-1"
              >
                <Trash2 size={16} />
              </button>
            </Card>
          ))}
        </div>
      </div>

      {showAddItem && (
        <Card className="p-4 mb-4 bg-stone-50">
          <h3 className="text-sm font-semibold text-stone-900 mb-3">
            Tambah Item
          </h3>
          <div className="space-y-2">
            <select
              value={addProductId}
              onChange={(e) => setAddProductId(e.target.value)}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm bg-white"
            >
              <option value="">Pilih produk...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={addVariantId}
              onChange={(e) => setAddVariantId(e.target.value)}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm bg-white"
            >
              <option value="">Pilih varian...</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="1"
              placeholder="Jumlah"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => setShowAddItem(false)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                onClick={addToCart}
                size="sm"
                className="flex-1"
                disabled={!addProductId || !addVariantId || !addQty}
              >
                Tambah
              </Button>
            </div>
          </div>
        </Card>
      )}

      {cart.length > 0 && (
        <>
          <Card className="p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-stone-600">Total</span>
              <span className="text-lg font-bold text-stone-900">
                {formatCurrency(total)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">
                  Metode Bayar
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                  <option value="qris">QRIS</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">
                  Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="sudah_bayar">Lunas</option>
                  <option value="belum_bayar">Belum Bayar</option>
                </select>
              </div>
            </div>
          </Card>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedCustomer || cart.length === 0}
            className="w-full min-h-[48px] text-base gap-2"
            size="lg"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ShoppingCart size={18} />
            )}
            Buat Order
          </Button>

          {!selectedCustomer && (
            <p className="text-xs text-amber-600 text-center mt-2">
              Pilih pelanggan dulu
            </p>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
