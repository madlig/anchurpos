"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Search, ShoppingCart, X, Minus, Plus, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PriceTier { id: string; minQty: number; maxQty: number | null; price: number; }
interface ProductItem {
  id: string; code: string; name: string; description: string;
  packPerBatch: number; isActive: boolean; priceTiers: PriceTier[];
}
interface Variant {
  id: string; name: string; currentStock: number; minStock: number; sortOrder: number;
}
interface CartItem {
  productId: string; productName: string;
  variantId: string; variantName: string;
  qty: number; price: number;
}

type PayMethod = "cash" | "transfer" | "qris";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function getPrice(product: ProductItem, qty: number): number {
  if (!product.priceTiers.length) return 0;
  const sorted = [...product.priceTiers].sort((a, b) => a.minQty - b.minQty);
  let price = sorted[0].price;
  for (const tier of sorted) {
    if (qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty)) {
      price = tier.price;
    }
  }
  return price;
}

function startingPrice(product: ProductItem): number {
  return getPrice(product, 1);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function KasirPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua");

  // Variant selector sheet
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [variantQtys, setVariantQtys] = useState<Record<string, number>>({});

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Checkout sheet
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [orderNotes, setOrderNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/products").then(r => r.json()),
      fetchWithAuth("/api/variants").then(r => r.json()),
    ]).then(([p, v]) => {
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
    }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  // ── Filtered products ──────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      (activeCategory === "Semua" || p.name === activeCategory) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()))
    );
  }, [products, activeCategory, search]);

  // ── Cart calculations ──────────────────────────────────────────────────────
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  // ── Variant sheet helpers ──────────────────────────────────────────────────
  function openVariantSheet(product: ProductItem) {
    setSelectedProduct(product);
    setVariantQtys({});
  }

  function adjustVariantQty(variantId: string, delta: number) {
    setVariantQtys(prev => {
      const next = Math.max(0, (prev[variantId] ?? 0) + delta);
      return { ...prev, [variantId]: next };
    });
  }

  const totalVariantSelected = Object.values(variantQtys).reduce((s, n) => s + n, 0);

  function addToCart() {
    if (!selectedProduct) return;
    const newItems: CartItem[] = [];
    for (const [variantId, qty] of Object.entries(variantQtys)) {
      if (qty <= 0) continue;
      const variant = variants.find(v => v.id === variantId);
      const totalQty = qty;
      const price = getPrice(selectedProduct, totalQty);
      newItems.push({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        variantId,
        variantName: variant?.name ?? variantId,
        qty,
        price,
      });
    }

    setCart(prev => {
      const next = [...prev];
      for (const ni of newItems) {
        const idx = next.findIndex(c => c.productId === ni.productId && c.variantId === ni.variantId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], qty: next[idx].qty + ni.qty };
        } else {
          next.push(ni);
        }
      }
      return next;
    });
    setSelectedProduct(null);
    setVariantQtys({});
  }

  function removeFromCart(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  function updateCartQty(idx: number, delta: number) {
    setCart(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = item.qty + delta;
      if (newQty <= 0) return item; // use removeFromCart instead
      return { ...item, qty: newQty, price: getPrice(products.find(p => p.id === item.productId)!, newQty) };
    }));
  }

  // ── Checkout ───────────────────────────────────────────────────────────────
  async function handleCheckout() {
    if (!cart.length) return;
    setError(""); setSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: customerName.trim() || "Walk-in",
          source: "walk_in",
          items: cart.map(c => ({ productId: c.productId, variantId: c.variantId, qty: c.qty })),
          paymentMethod: payMethod,
          paymentStatus: "sudah_bayar",
          orderNotes: orderNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal membuat order"); return; }
      // Success
      setCart([]);
      setShowCheckout(false);
      setCustomerName("");
      setOrderNotes("");
      router.push(`/manager/orders/${data.orderId}`);
    } catch { setError("Gagal menghubungi server"); } finally { setSubmitting(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#FCABB4" }}>

      {/* ── Header (white, sticky) ── */}
      <div className="sticky top-0 z-30" style={{ background: "#fff", borderBottom: "1px solid #F1F5F9" }}>
        <div className="px-5 pt-4 pb-2">
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Kasir</h1>

          {/* Search bar */}
          <div
            className="flex items-center gap-2 mt-2"
            style={{ padding: "9px 12px", background: "#F8FAFC", borderRadius: "12px", border: "1px solid #F1F5F9" }}
          >
            <Search size={15} style={{ color: "#94A3B8", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Cari produk..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: "transparent", fontSize: "13px", color: "#1C1C1E", outline: "none" }}
              data-testid="pos-search"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={14} style={{ color: "#94A3B8" }} />
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto px-5 pb-3" style={{ scrollbarWidth: "none" }}>
          {["Semua", ...products.map(p => p.name)].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              data-testid={`category-chip-${cat}`}
              style={{
                padding: "5px 14px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: activeCategory === cat ? "600" : "500",
                color: activeCategory === cat ? "#fff" : "#64748B",
                background: activeCategory === cat ? "#E85D8C" : "#F1F5F9",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product Grid ── */}
      <div className="p-4" style={{ paddingBottom: cart.length > 0 ? "120px" : "24px" }}>
        {products.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20"
            style={{ background: "#fff", borderRadius: "16px", textAlign: "center" }}
          >
            <ShoppingCart size={40} style={{ color: "#CBD5E1", marginBottom: "12px" }} />
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>Belum ada produk</p>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>Tambah produk di Master Data</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center">
            <p style={{ fontSize: "14px", color: "#94A3B8" }}>Produk tidak ditemukan</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                variantCount={variants.length}
                onAdd={() => openVariantSheet(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom Cart Bar ── */}
      {cart.length > 0 && (
        <div
          className="fixed left-0 right-0 z-40"
          style={{ bottom: "66px", padding: "10px 16px", background: "linear-gradient(to top, #FCABB4 60%, transparent)" }}
        >
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full flex items-center justify-between"
            style={{
              background: "linear-gradient(135deg,#E85D8C,#C94A73)",
              borderRadius: "100px",
              padding: "14px 20px",
              boxShadow: "0 8px 30px rgba(232,93,140,0.4)",
              border: "none",
              cursor: "pointer",
            }}
            data-testid="cart-bar-button"
          >
            <div className="flex items-center gap-2.5">
              <span
                style={{ background: "rgba(255,255,255,0.2)", borderRadius: "100px", padding: "3px 10px", fontSize: "12px", fontWeight: "700", color: "#fff" }}
              >
                {cartCount} item
              </span>
              <span style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>{fmt(cartTotal)}</span>
            </div>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>Bayar →</span>
          </button>
        </div>
      )}

      {/* ── Variant Selector Sheet ── */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) { setSelectedProduct(null); setVariantQtys({}); } }}
        >
          <div
            className="overflow-y-auto"
            style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "80vh" }}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#1C1C1E" }}>{selectedProduct.name}</h2>
                <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>
                  {fmt(startingPrice(selectedProduct))} / pack
                </p>
              </div>
              <button
                onClick={() => { setSelectedProduct(null); setVariantQtys({}); }}
                style={{ width: "30px", height: "30px", borderRadius: "10px", background: "#F8FAFC", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} style={{ color: "#64748B" }} />
              </button>
            </div>

            {/* Variant list */}
            <div className="flex flex-col gap-2">
              {variants.map(v => {
                const qty = variantQtys[v.id] ?? 0;
                const isLowStock = v.currentStock < v.minStock;
                return (
                  <div
                    key={v.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: "12px",
                      background: qty > 0 ? "#FEF1F5" : "#F8FAFC",
                      border: qty > 0 ? "1px solid #F2A0B7" : "1px solid #F1F5F9",
                    }}
                    data-testid={`variant-row-${v.id}`}
                  >
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{v.name}</p>
                      <p style={{ fontSize: "11px", color: isLowStock ? "#DC2626" : "#94A3B8", marginTop: "2px" }}>
                        Stok: {v.currentStock} pcs {isLowStock ? "⚠ Rendah" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {qty > 0 && (
                        <>
                          <button
                            onClick={() => adjustVariantQty(v.id, -1)}
                            style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Minus size={13} style={{ color: "#64748B" }} />
                          </button>
                          <span style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E", minWidth: "20px", textAlign: "center" }}>{qty}</span>
                        </>
                      )}
                      <button
                        onClick={() => adjustVariantQty(v.id, 1)}
                        style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#E85D8C", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        data-testid={`add-variant-${v.id}`}
                      >
                        <Plus size={13} style={{ color: "#fff" }} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add to cart button */}
            {totalVariantSelected > 0 ? (
              <button
                onClick={addToCart}
                className="w-full mt-4"
                style={{ padding: "14px", borderRadius: "14px", background: "#E85D8C", color: "#fff", fontSize: "14px", fontWeight: "700", border: "none", cursor: "pointer" }}
                data-testid="add-to-cart-btn"
              >
                Tambah ke Cart ({totalVariantSelected} item · {fmt(cart.length === 0 ? getPrice(selectedProduct, totalVariantSelected) * totalVariantSelected : cartTotal + Object.entries(variantQtys).reduce((s, [vId, qty]) => s + getPrice(selectedProduct, qty) * qty, 0))})
              </button>
            ) : (
              <p className="text-center mt-4" style={{ fontSize: "12px", color: "#94A3B8" }}>Pilih varian untuk ditambah ke cart</p>
            )}
          </div>
        </div>
      )}

      {/* ── Checkout Sheet ── */}
      {showCheckout && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowCheckout(false); }}
        >
          <div
            className="overflow-y-auto"
            style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "90vh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#1C1C1E" }}>Konfirmasi Pesanan</h2>
              <button
                onClick={() => setShowCheckout(false)}
                style={{ width: "30px", height: "30px", borderRadius: "10px", background: "#F8FAFC", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} style={{ color: "#64748B" }} />
              </button>
            </div>

            {/* Cart summary */}
            <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "12px 14px", marginBottom: "16px" }}>
              {cart.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between"
                  style={{ paddingBottom: i < cart.length - 1 ? "8px" : 0, marginBottom: i < cart.length - 1 ? "8px" : 0, borderBottom: i < cart.length - 1 ? "1px solid #F1F5F9" : "none" }}
                >
                  <div className="flex items-center gap-2">
                    <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#E85D8C" }}>{item.qty}x</span>
                    </div>
                    <div>
                      <p style={{ fontSize: "12px", fontWeight: "600", color: "#1C1C1E" }}>{item.productName}</p>
                      <p style={{ fontSize: "11px", color: "#94A3B8" }}>{item.variantName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#1C1C1E" }}>{fmt(item.price * item.qty)}</span>
                    <button
                      onClick={() => removeFromCart(i)}
                      style={{ width: "22px", height: "22px", borderRadius: "6px", background: "#FEE2E2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <X size={11} style={{ color: "#DC2626" }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer name */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>
                Nama Pelanggan
              </label>
              <input
                type="text"
                placeholder="Nama pelanggan (opsional)"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#1C1C1E", outline: "none", background: "#F8FAFC" }}
                data-testid="checkout-customer-name"
              />
            </div>

            {/* Payment method */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
                Metode Pembayaran
              </label>
              <div className="flex gap-2">
                {(["cash", "transfer", "qris"] as PayMethod[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: "12px", fontSize: "12px", fontWeight: "600",
                      color: payMethod === m ? "#fff" : "#64748B",
                      background: payMethod === m ? "#E85D8C" : "#F1F5F9",
                      border: payMethod === m ? "none" : "1px solid #E2E8F0",
                      cursor: "pointer",
                    }}
                    data-testid={`pay-method-${m}`}
                  >
                    {m === "cash" ? "Tunai" : m === "transfer" ? "Transfer" : "QRIS"}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: "16px" }}>
              <input
                type="text"
                placeholder="Catatan pesanan (opsional)"
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#1C1C1E", outline: "none", background: "#F8FAFC" }}
                data-testid="checkout-notes"
              />
            </div>

            {/* Total */}
            <div
              className="flex items-center justify-between"
              style={{ padding: "12px 14px", borderRadius: "12px", background: "#FEF1F5", border: "1px solid #F2A0B7", marginBottom: "16px" }}
            >
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#64748B" }}>Total</span>
              <span style={{ fontSize: "18px", fontWeight: "700", color: "#E85D8C" }}>{fmt(cartTotal)}</span>
            </div>

            {/* Error */}
            {error && (
              <p style={{ fontSize: "12px", color: "#DC2626", textAlign: "center", marginBottom: "8px" }}>{error}</p>
            )}

            {/* Confirm button */}
            <button
              onClick={handleCheckout}
              disabled={submitting || !cart.length}
              className="w-full"
              style={{
                padding: "15px", borderRadius: "14px", fontSize: "14px", fontWeight: "700",
                color: "#fff", background: "#E85D8C", border: "none",
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
              data-testid="confirm-order-btn"
            >
              {submitting ? "Memproses..." : "Konfirmasi Pesanan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, variantCount, onAdd }: {
  product: ProductItem; variantCount: number; onAdd: () => void;
}) {
  const sp = startingPrice(product);
  return (
    <div
      style={{ background: "#fff", borderRadius: "14px", overflow: "hidden", border: "1px solid #F1F5F9" }}
      data-testid={`product-card-${product.id}`}
    >
      {/* Image placeholder */}
      <div style={{ height: "80px", background: "linear-gradient(135deg, rgba(232,93,140,0.12), rgba(252,171,180,0.3))", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(232,93,140,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "20px" }}>🍰</span>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "8px 10px 10px" }}>
        <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E", lineHeight: "1.3" }}>{product.name}</p>
        <p style={{ fontSize: "11px", fontWeight: "500", color: "#94A3B8", marginTop: "2px" }}>
          {variantCount} varian
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#E85D8C" }}>
            {sp > 0 ? fmt(sp) : "—"}
          </span>
          <button
            onClick={onAdd}
            style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#E85D8C", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            data-testid={`product-add-btn-${product.id}`}
          >
            <Plus size={14} style={{ color: "#fff" }} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
