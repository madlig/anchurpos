"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  Trash2,
  Check,
  ShoppingBag,
  X,
  ChevronDown,
  MapPin,
  Phone,
  User,
  Calendar,
  MessageSquare,
} from "lucide-react";

interface SimpleProduct { id: string; name: string; }
interface SimpleVariant { id: string; name: string; }
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
  const [result, setResult] = useState<{ orderNumber: string } | null>(null);
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
    setAddProductId(""); setAddVariantId(""); setAddQty(""); setShowAddItem(false);
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
      setError("Tambahkan minimal 1 item pesanan");
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
          items: cart.map((c) => ({ productId: c.productId, variantId: c.variantId, qty: c.qty })),
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
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-5">
        <div className="page-enter rounded-3xl bg-white border border-stone-100 shadow-lg p-8 text-center max-w-sm w-full">
          <div className="h-20 w-20 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-5">
            <Check className="h-10 w-10 text-emerald-600" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black text-stone-900 mb-1">Pesanan Terkirim!</h2>
          <p className="text-3xl font-black tabular-nums text-emerald-600 mb-3" data-testid="public-order-number">
            {result.orderNumber}
          </p>
          <p className="text-sm text-stone-500 leading-relaxed mb-6">
            Pesanan Anda sudah diterima. Tim Anchur akan menghubungi Anda melalui WhatsApp untuk konfirmasi.
          </p>
          <Button
            onClick={() => {
              setResult(null); setCart([]);
              setName(""); setPhone(""); setAddress(""); setDeliveryDate(""); setNotes("");
            }}
            className="w-full h-12 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700"
            data-testid="new-public-order-button"
          >
            Buat Pesanan Baru
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Branded header */}
      <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 pt-10 pb-8 overflow-hidden">
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-0 h-16 w-48 rounded-tr-full bg-white/5" />
        <div className="relative max-w-sm mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <span className="text-lg font-black text-white">A</span>
            </div>
            <div>
              <p className="text-emerald-200 text-xs font-bold tracking-wider uppercase">Anchur Bandung</p>
              <h1 className="text-white font-black text-xl tracking-tight">Pesan Churros</h1>
            </div>
          </div>
          <p className="text-emerald-100 text-sm leading-relaxed">
            Isi form di bawah untuk memesan. Tim kami akan menghubungi via WhatsApp.
          </p>
        </div>
      </div>

      <div className="px-5 py-6 max-w-sm mx-auto space-y-4">
        {/* Customer info */}
        <div className="rounded-3xl bg-white border border-stone-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
            <User size={15} className="text-emerald-600" /> Data Pemesan
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1.5 block">
                Nama <span className="text-rose-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap / nama toko"
                className="h-12 rounded-2xl border-stone-200 bg-stone-50 font-medium"
                data-testid="public-name-input"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1.5 block flex items-center gap-1">
                <Phone size={10} /> No. HP / WhatsApp <span className="text-rose-500">*</span>
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                type="tel"
                className="h-12 rounded-2xl border-stone-200 bg-stone-50 font-medium"
                data-testid="public-phone-input"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1.5 block flex items-center gap-1">
                <MapPin size={10} /> Alamat Pengiriman
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Alamat lengkap (opsional)"
                className="h-12 rounded-2xl border-stone-200 bg-stone-50 font-medium"
                data-testid="public-address-input"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1.5 block flex items-center gap-1">
                <Calendar size={10} /> Tanggal Kirim
              </label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="h-12 rounded-2xl border-stone-200 bg-stone-50 font-medium"
                data-testid="public-delivery-date-input"
              />
            </div>
          </div>
        </div>

        {/* Order items */}
        <div className="rounded-3xl bg-white border border-stone-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <ShoppingBag size={15} className="text-emerald-600" /> Item Pesanan
            </h2>
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors tap-target"
              data-testid="public-add-item-button"
            >
              <Plus size={12} strokeWidth={2.5} /> Tambah
            </button>
          </div>

          {cart.length === 0 && !showAddItem && (
            <div className="rounded-2xl bg-stone-50 border-2 border-dashed border-stone-200 py-8 text-center">
              <ShoppingBag size={24} className="mx-auto text-stone-300 mb-2" />
              <p className="text-sm text-stone-400 font-medium">Belum ada item</p>
            </div>
          )}

          <div className="space-y-2">
            {cart.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-stone-50 border border-stone-100 px-4 py-3 flex items-center justify-between"
                data-testid={`public-cart-item-${idx}`}
              >
                <div>
                  <p className="text-sm font-semibold text-stone-900">{item.productName} — {item.variantName}</p>
                  <p className="text-xs text-stone-400">{item.qty} pcs</p>
                </div>
                <button
                  onClick={() => removeFromCart(idx)}
                  className="h-7 w-7 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-400 hover:text-rose-500 tap-target"
                  data-testid={`public-remove-item-${idx}`}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          {showAddItem && (
            <div className="mt-3 rounded-2xl bg-stone-50 border border-stone-200 p-4 space-y-3">
              <div className="relative">
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-stone-200 bg-white px-4 pr-9 text-sm font-medium appearance-none"
                  data-testid="public-product-select"
                >
                  <option value="">Pilih produk...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={addVariantId}
                  onChange={(e) => setAddVariantId(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-stone-200 bg-white px-4 pr-9 text-sm font-medium appearance-none"
                  data-testid="public-variant-select"
                >
                  <option value="">Pilih varian...</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              </div>
              <Input
                type="number"
                min="1"
                placeholder="Jumlah (pcs)"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                className="h-11 rounded-2xl border-stone-200 bg-white font-medium text-center"
                data-testid="public-qty-input"
              />
              <div className="flex gap-2">
                <Button onClick={() => setShowAddItem(false)} variant="outline" className="flex-1 h-11 rounded-2xl font-bold">
                  Batal
                </Button>
                <Button
                  onClick={addToCart}
                  className="flex-1 h-11 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700"
                  disabled={!addProductId || !addVariantId || !addQty}
                  data-testid="public-confirm-add-button"
                >
                  Tambah
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-3xl bg-white border border-stone-100 shadow-sm p-5">
          <label className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2 block">
            <MessageSquare size={15} className="text-emerald-600" /> Catatan Pesanan
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan tambahan, misal: tanpa saus, kirim pagi, dll."
            rows={3}
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors"
            data-testid="public-notes-input"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-70 tap-target"
          data-testid="public-submit-button"
        >
          {submitting ? <Loader2 size={20} className="animate-spin" /> : <ShoppingBag size={20} />}
          Kirim Pesanan
        </button>

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3" data-testid="public-order-error">
            <p className="text-sm text-rose-700 font-medium text-center">{error}</p>
          </div>
        )}

        <p className="text-center text-xs text-stone-400 pb-4">
          Konfirmasi via WhatsApp · Anchur Bandung
        </p>
      </div>
    </div>
  );
}
