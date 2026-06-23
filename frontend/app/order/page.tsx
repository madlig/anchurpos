"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Check, ShoppingBag } from "lucide-react";

interface SimpleProduct {
  id: string;
  name: string;
}

interface SimpleVariant {
  id: string;
  name: string;
}

interface CartItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  qty: number;
}

export default function PublicOrderPage() {
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [variants, setVariants] = useState<SimpleVariant[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addVariantId, setAddVariantId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    orderNumber: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/variants").then((r) => r.json()),
    ])
      .then(([p, v]) => {
        setProducts(p);
        setVariants(v);
      })
      .finally(() => setLoading(false));
  }, []);

  function addToCart() {
    if (!addProductId || !addVariantId || !addQty) return;
    const qty = parseInt(addQty);
    if (qty <= 0) return;

    const product = products.find((p) => p.id === addProductId);
    const variant = variants.find((v) => v.id === addVariantId);

    setCart((prev) => [
      ...prev,
      {
        productId: addProductId,
        productName: product?.name ?? addProductId,
        variantId: addVariantId,
        variantName: variant?.name ?? addVariantId,
        qty,
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

  async function handleSubmit() {
    setError("");

    if (!name.trim() || !phone.trim()) {
      setError("Nama dan nomor HP wajib diisi");
      return;
    }
    if (cart.length === 0) {
      setError("Tambahkan minimal 1 item");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone.trim(),
          name: name.trim(),
          address: address.trim(),
          items: cart.map((c) => ({
            productId: c.productId,
            variantId: c.variantId,
            qty: c.qty,
          })),
          requestedDeliveryDate: deliveryDate || undefined,
          orderNotes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengirim pesanan");
        return;
      }
      setResult(data);
    } catch {
      setError("Gagal mengirim pesanan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex justify-center items-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-5">
        <Card className="p-6 text-center max-w-sm w-full">
          <Check className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-stone-900 mb-1">
            Pesanan Terkirim!
          </h2>
          <p className="text-2xl font-mono font-bold text-emerald-600 mb-3">
            {result.orderNumber}
          </p>
          <p className="text-sm text-stone-500 mb-4">
            Pesanan Anda sudah diterima. Tim kami akan segera menghubungi Anda
            untuk konfirmasi.
          </p>
          <Button
            onClick={() => {
              setResult(null);
              setCart([]);
              setName("");
              setPhone("");
              setAddress("");
              setDeliveryDate("");
              setNotes("");
            }}
            variant="outline"
            className="w-full"
          >
            Buat Pesanan Baru
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-emerald-600 text-white px-5 py-6">
        <h1 className="text-xl font-bold">Pesan Churros Anchur</h1>
        <p className="text-sm text-emerald-100 mt-1">
          Isi form di bawah untuk memesan
        </p>
      </div>

      <div className="p-5 max-w-lg mx-auto space-y-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-stone-900 mb-3">
            Data Pemesan
          </h2>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">
                Nama *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap / nama toko"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">
                No. HP / WhatsApp *
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                type="tel"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">
                Alamat Pengiriman
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Alamat lengkap"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">
                Tanggal Kirim
              </label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">
                Catatan
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
              />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-stone-900">
              Item Pesanan
            </h2>
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
            <p className="text-sm text-stone-400 text-center py-4">
              Belum ada item. Tap + Tambah.
            </p>
          )}

          <div className="space-y-2">
            {cart.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-stone-50 rounded-lg p-3"
              >
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {item.productName} — {item.variantName}
                  </p>
                  <p className="text-xs text-stone-500">{item.qty} pcs</p>
                </div>
                <button
                  onClick={() => removeFromCart(idx)}
                  className="text-stone-400 hover:text-red-500 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {showAddItem && (
            <div className="mt-3 bg-stone-50 rounded-lg p-3 space-y-2">
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
          )}
        </Card>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full min-h-[48px] text-base gap-2"
          size="lg"
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <ShoppingBag size={18} />
          )}
          Kirim Pesanan
        </Button>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
