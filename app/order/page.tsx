"use client";

import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Loader2, Plus, Trash2, Check, ShoppingBag, X,
  ChevronDown, MapPin, Phone, User, Calendar, MessageSquare,
} from "lucide-react";

interface SimpleProduct { id: string; name: string; }
interface SimpleVariant { id: string; name: string; }
interface CartItem {
  productId: string; productName: string;
  variantId: string; variantName: string; qty: number;
}

const SELECT_CLS = "w-full h-11 rounded-2xl border px-4 pr-9 text-sm font-medium appearance-none focus:outline-none transition-colors";

export default function PublicOrderPage() {
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [variants, setVariants] = useState<SimpleVariant[]>([]);
  const [productStocks, setProductStocks] = useState<any[]>([]);
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
      fetch("/api/products/stocks").then((r) => r.json()),
    ])
      .then(([p, v, s]) => {
        setProducts(p);
        setVariants(v);
        setProductStocks(Array.isArray(s) ? s : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const availableVariants = useMemo(() => {
    if (!addProductId) return [];

    // 1. If it's a frozen product
    if (addProductId.startsWith("churros-frozen")) {
      const stocks = productStocks.filter(s => s.productId === addProductId);
      return stocks.map(s => ({
        id: s.variantId,
        name: s.variantName,
        stock: s.currentStock,
      }));
    }

    // 2. If it's churros-rainbow
    if (addProductId === "churros-rainbow") {
      return [{ id: "rainbow", name: "Rainbow", stock: 999 }];
    }

    // 3. If it's Extra Dipping Sauce
    if (addProductId === "QCPFbGabYGWAZRB9tesO" || addProductId === "EDS" || addProductId.toLowerCase().includes("sauce")) {
      return [{ id: "original", name: "Default / Original", stock: 999 }];
    }

    // 4. For anything else (like Churros Matang)
    return variants
      .filter(v => v.id !== "rainbow")
      .map(v => ({
        id: v.id,
        name: v.name,
        stock: 999,
      }));
  }, [addProductId, productStocks, variants]);

  useEffect(() => {
    if (availableVariants.length === 1) {
      setAddVariantId(availableVariants[0].id);
    } else {
      setAddVariantId("");
    }
  }, [availableVariants]);

  function addToCart() {
    if (!addProductId || !addVariantId || !addQty) return;
    const qty = parseInt(addQty);
    if (qty <= 0) return;
    const product = products.find((p) => p.id === addProductId);
    const variant = variants.find((v) => v.id === addVariantId);
    setCart((prev) => [...prev, { productId: addProductId, productName: product?.name ?? addProductId, variantId: addVariantId, variantName: variant?.name ?? addVariantId, qty }]);
    setAddProductId(""); setAddVariantId(""); setAddQty(""); setShowAddItem(false);
  }

  async function handleSubmit() {
    setError("");
    if (!name.trim() || !phone.trim()) { setError("Nama dan nomor HP wajib diisi"); return; }
    if (cart.length === 0) { setError("Tambahkan minimal 1 item pesanan"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone.trim(), name: name.trim(), address: address.trim(), items: cart.map((c) => ({ productId: c.productId, variantId: c.variantId, qty: c.qty })), requestedDeliveryDate: deliveryDate || undefined, orderNotes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal mengirim pesanan"); return; }
      setResult(data);
    } catch { setError("Gagal mengirim pesanan. Coba lagi."); } finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex justify-center items-center" style={{ background: "#F0EDE8" }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
    </div>
  );

  if (result) return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "#F0EDE8" }}>
      <div className="page-enter rounded-3xl p-8 text-center max-w-sm w-full" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}>
        <div className="h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-5" style={{ background: "#FEF1F5" }}>
          <Check className="h-10 w-10" style={{ color: "#E85D8C" }} strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-extrabold mb-1" style={{ color: "#1C1C1E" }}>Pesanan Terkirim!</h2>
        <p className="text-3xl font-extrabold tabular-nums mb-3" style={{ color: "#E85D8C" }} data-testid="public-order-number">{result.orderNumber}</p>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "#64748B" }}>Pesanan Anda sudah diterima. Tim Anchur akan menghubungi Anda melalui WhatsApp untuk konfirmasi.</p>
        <button
          onClick={() => { setResult(null); setCart([]); setName(""); setPhone(""); setAddress(""); setDeliveryDate(""); setNotes(""); }}
          className="w-full h-12 rounded-2xl font-bold text-white tap-target"
          style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)" }}
          data-testid="new-public-order-button"
        >
          Buat Pesanan Baru
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#F0EDE8" }}>
      {/* Branded header */}
      <div className="relative px-5 pt-10 pb-8 overflow-hidden" style={{ background: "linear-gradient(135deg,#E85D8C 0%,#C94A73 100%)" }}>
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
        <div className="absolute bottom-0 left-0 h-16 w-48 rounded-tr-full" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="relative max-w-lg mx-auto md:max-w-3xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
              <span className="text-lg font-black text-white">A</span>
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.75)" }}>Anchur Bandung</p>
              <h1 className="text-white font-extrabold text-xl tracking-tight">Pesan Churros</h1>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>Isi form di bawah untuk memesan. Tim kami akan menghubungi via WhatsApp.</p>
        </div>
      </div>

      <div className="px-5 py-6 max-w-lg mx-auto md:max-w-3xl">
        {/* Desktop: 2-col layout */}
        <div className="md:grid md:grid-cols-2 md:gap-5">
          {/* Left col: customer info + notes */}
          <div className="space-y-4">
            {/* Customer info */}
            <div className="rounded-3xl p-5" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: "#1C1C1E" }}>
                <User size={15} style={{ color: "#E85D8C" }} /> Data Pemesan
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "#94A3B8" }}>Nama <span style={{ color: "#DC2626" }}>*</span></label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap / nama toko" className="h-12 rounded-2xl font-medium" style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }} data-testid="public-name-input" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 block" style={{ color: "#94A3B8" }}>
                    <Phone size={10} /> No. HP / WhatsApp <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" type="tel" className="h-12 rounded-2xl font-medium" style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }} data-testid="public-phone-input" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 block" style={{ color: "#94A3B8" }}>
                    <MapPin size={10} /> Alamat Pengiriman
                  </label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat lengkap (opsional)" className="h-12 rounded-2xl font-medium" style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }} data-testid="public-address-input" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1 block" style={{ color: "#94A3B8" }}>
                    <Calendar size={10} /> Tanggal Kirim
                  </label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="h-12 rounded-2xl font-medium" style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }} data-testid="public-delivery-date-input" />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-3xl p-5" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <label className="text-sm font-bold mb-3 flex items-center gap-2 block" style={{ color: "#1C1C1E" }}>
                <MessageSquare size={15} style={{ color: "#E85D8C" }} /> Catatan Pesanan
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan, misal: tanpa saus, kirim pagi, dll."
                rows={3}
                className="w-full rounded-2xl border px-4 py-3 text-sm font-medium resize-none focus:outline-none transition-colors"
                style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}
                data-testid="public-notes-input"
              />
            </div>
          </div>

          {/* Right col: order items + submit */}
          <div className="space-y-4 mt-4 md:mt-0">
            {/* Order items */}
            <div className="rounded-3xl p-5" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: "#1C1C1E" }}>
                  <ShoppingBag size={15} style={{ color: "#E85D8C" }} /> Item Pesanan
                </h2>
                <button onClick={() => setShowAddItem(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tap-target"
                  style={{ background: "#FEF1F5", color: "#E85D8C" }} data-testid="public-add-item-button">
                  <Plus size={12} strokeWidth={2.5} /> Tambah
                </button>
              </div>

              {cart.length === 0 && !showAddItem && (
                <div className="rounded-2xl py-8 text-center" style={{ background: "#F8FAFC", border: "2px dashed #E2E8F0" }}>
                  <ShoppingBag size={24} className="mx-auto mb-2" style={{ color: "#CBD5E1" }} />
                  <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Belum ada item</p>
                </div>
              )}

              <div className="space-y-2">
                {cart.map((item, idx) => (
                  <div key={idx} className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }} data-testid={`public-cart-item-${idx}`}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>{item.productName} — {item.variantName}</p>
                      <p className="text-xs" style={{ color: "#94A3B8" }}>{item.qty} pcs</p>
                    </div>
                    <button onClick={() => setCart((p) => p.filter((_, i) => i !== idx))} className="h-7 w-7 rounded-lg flex items-center justify-center tap-target" style={{ background: "#fff", border: "1px solid #E2E8F0", color: "#94A3B8" }} data-testid={`public-remove-item-${idx}`}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {showAddItem && (
                <div className="mt-3 rounded-2xl p-4 space-y-3" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                  <div className="relative">
                    <select value={addProductId} onChange={(e) => setAddProductId(e.target.value)} className={SELECT_CLS} style={{ borderColor: "#E2E8F0", background: "#fff" }} data-testid="public-product-select">
                      <option value="">Pilih produk...</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
                  </div>
                  <div className="relative">
                    <select value={addVariantId} onChange={(e) => setAddVariantId(e.target.value)} className={SELECT_CLS} style={{ borderColor: "#E2E8F0", background: "#fff" }} data-testid="public-variant-select" disabled={availableVariants.length === 0}>
                      <option value="">{availableVariants.length === 0 ? "Pilih produk dahulu..." : "Pilih varian..."}</option>
                      {availableVariants.map((v) => {
                        const isOut = addProductId.startsWith("churros-frozen") && v.stock <= 0;
                        return (
                          <option key={v.id} value={v.id} disabled={isOut}>
                            {v.name} {isOut ? "(Habis)" : addProductId.startsWith("churros-frozen") ? `(Stok: ${v.stock} pack)` : ""}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94A3B8" }} />
                  </div>
                  <Input type="number" min="1" placeholder="Jumlah (pcs)" value={addQty} onChange={(e) => setAddQty(e.target.value)} className="h-11 rounded-2xl font-medium text-center" style={{ borderColor: "#E2E8F0" }} data-testid="public-qty-input" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddItem(false)} className="flex-1 h-11 rounded-2xl font-bold tap-target" style={{ background: "#F1F5F9", color: "#64748B" }}>Batal</button>
                    <button onClick={addToCart} disabled={!addProductId || !addVariantId || !addQty} className="flex-1 h-11 rounded-2xl font-bold text-white tap-target disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)" }} data-testid="public-confirm-add-button">
                      Tambah
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={submitting} className="w-full min-h-[56px] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 tap-target disabled:opacity-70"
              style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)", boxShadow: "0 8px 20px rgba(232,93,140,0.3)" }} data-testid="public-submit-button">
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <ShoppingBag size={20} />}
              Kirim Pesanan
            </button>

            {error && (
              <div className="rounded-2xl px-4 py-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }} data-testid="public-order-error">
                <p className="text-sm font-medium text-center" style={{ color: "#DC2626" }}>{error}</p>
              </div>
            )}

            <p className="text-center text-xs pb-4" style={{ color: "#94A3B8" }}>Konfirmasi via WhatsApp · Anchur Bandung</p>
          </div>
        </div>
      </div>
    </div>
  );
}
