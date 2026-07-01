"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Search, ShoppingCart, X, Minus, Plus, ChevronDown, UserPlus, CreditCard, CheckCircle2 } from "lucide-react";
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
interface CustomerItem {
  id: string; name: string; channel: string; customerType: string; phoneNumber: string | null;
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
  const { getToken, role } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [productStocks, setProductStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua");

  // Variant selector sheet
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [variantQtys, setVariantQtys] = useState<Record<string, number>>({});

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Checkout sheet state
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderChannel, setOrderChannel] = useState<"walkin" | "whatsapp" | "tiktok" | "shopee">("walkin");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [saveNewCustomer, setSaveNewCustomer] = useState(false);
  const [newCustomerType, setNewCustomerType] = useState<"reguler" | "b2b" | "reseller">("reguler");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [isPaid, setIsPaid] = useState(true);
  const [orderNotes, setOrderNotes] = useState("");
  const [platformFeeOverride, setPlatformFeeOverride] = useState(""); // manual override if needed
  const [marketplaceFees, setMarketplaceFees] = useState({ tiktok: 0, shopee: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const customerRef = useRef<HTMLDivElement>(null);

  // Back-dated order states
  const [enableCustomDate, setEnableCustomDate] = useState(false);
  const [customOrderDate, setCustomOrderDate] = useState("");


  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/products").then(r => r.json()),
      fetchWithAuth("/api/variants").then(r => r.json()),
      fetchWithAuth("/api/customers").then(r => r.json()),
      fetchWithAuth("/api/products/stocks").then(r => r.json()),
      fetchWithAuth("/api/settings/marketplace-fee").then(r => r.ok ? r.json() : { tiktok: 0, shopee: 0 }),
    ]).then(([p, v, c, s, fees]) => {
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
      setCustomers(Array.isArray(c) ? c : []);
      setProductStocks(Array.isArray(s) ? s : []);
      setMarketplaceFees({ tiktok: fees.tiktok ?? 0, shopee: fees.shopee ?? 0 });
    }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  // ── Filtered products ──────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    // TikTok: hanya tampilkan produk TikTok (nama mengandung "tiktok" atau "TikTok")
    const isTicktokChannel = orderChannel === "tiktok";
    return products.filter(p =>
      (isTicktokChannel ? p.name.toLowerCase().includes("tiktok") : !p.name.toLowerCase().includes("tiktok")) &&
      (activeCategory === "Semua" || p.name === activeCategory) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()))
    );
  }, [products, activeCategory, search, orderChannel]);

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

  // Recalculate unit prices in cart dynamically based on accumulated quantity per product
  const recalculateCartPrices = useCallback((currentCart: CartItem[]): CartItem[] => {
    const productQtyMap = new Map<string, number>();
    for (const item of currentCart) {
      const current = productQtyMap.get(item.productId) ?? 0;
      productQtyMap.set(item.productId, current + item.qty);
    }

    return currentCart.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return item;
      const accumulatedQty = productQtyMap.get(item.productId) ?? item.qty;
      const price = getPrice(product, accumulatedQty);
      return { ...item, price };
    });
  }, [products]);

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
      return recalculateCartPrices(next);
    });
    setSelectedProduct(null);
    setVariantQtys({});
  }

  function removeFromCart(idx: number) {
    setCart(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return recalculateCartPrices(next);
    });
  }

  function updateCartQty(idx: number, delta: number) {
    setCart(prev => {
      const next = prev.map((item, i) => {
        if (i !== idx) return item;
        const newQty = item.qty + delta;
        if (newQty <= 0) return item; // use removeFromCart instead
        return { ...item, qty: newQty };
      });
      return recalculateCartPrices(next);
    });
  }

  // ── Fee calculations ────────────────────────────────────────────────────────
  const activeFeePercent = useMemo(() => {
    if (platformFeeOverride !== "") return parseFloat(platformFeeOverride) || 0;
    if (orderChannel === "tiktok") return marketplaceFees.tiktok;
    if (orderChannel === "shopee") return marketplaceFees.shopee;
    return 0;
  }, [orderChannel, marketplaceFees, platformFeeOverride]);

  const feeAmount = useMemo(() => Math.round(cartTotal * activeFeePercent / 100), [cartTotal, activeFeePercent]);
  const netRevenue = useMemo(() => cartTotal - feeAmount, [cartTotal, feeAmount]);

  // ── Checkout ───────────────────────────────────────────────────────────────
  // Filter customers untuk dropdown — untuk WA tampilkan semua, untuk channel lain tersembunyi
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers.slice(0, 8);
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phoneNumber ?? "").includes(q)).slice(0, 8);
  }, [customers, customerSearch]);

  const isNewCustomer = customerSearch.trim() && !selectedCustomer && !customers.some(c => c.name.toLowerCase() === customerSearch.toLowerCase().trim());
  const finalCustomerName = selectedCustomer ? selectedCustomer.name : customerSearch.trim() || "Walk-in";
  const effectiveCustomerType = selectedCustomer?.customerType ?? (isNewCustomer ? newCustomerType : "reguler");
  const isB2B = effectiveCustomerType === "b2b" || effectiveCustomerType === "reseller";

  async function handleCheckout() {
    if (!cart.length) return;
    setError(""); setSubmitting(true);
    try {
      // Simpan pelanggan baru jika diminta
      let customerId = selectedCustomer?.id ?? null;
      if (isNewCustomer && saveNewCustomer && customerSearch.trim()) {
        const saveRes = await fetchWithAuth("/api/customers", {
          method: "POST",
          body: JSON.stringify({
            name: customerSearch.trim(),
            customerType: newCustomerType,
            channel: orderChannel === "whatsapp" ? "whatsapp" : "walk_in",
            createdVia: "pos"
          }),
        });
        if (saveRes.ok) {
          const newC = await saveRes.json();
          customerId = newC.id;
          setCustomers(prev => [...prev, { id: newC.id, name: customerSearch.trim(), channel: "whatsapp", customerType: newCustomerType, phoneNumber: null }]);
        }
      }

      const res = await fetchWithAuth("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: finalCustomerName,
          customerId,
          customerType: isNewCustomer ? newCustomerType : (selectedCustomer?.customerType ?? null),
          source: orderChannel === "walkin" ? "walk_in" : orderChannel === "whatsapp" ? "wa_form" : "marketplace_manual",
          orderChannel,
          items: cart.map(c => ({ productId: c.productId, variantId: c.variantId, qty: c.qty })),
          orderNotes: orderNotes.trim() || null,
          customDate: enableCustomDate && customOrderDate ? customOrderDate : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal membuat pesanan"); return; }
      // Reset
      setCart([]); setShowCheckout(false); setCustomerSearch("");
      setSelectedCustomer(null); setOrderNotes(""); setIsPaid(true); setSaveNewCustomer(false);
      setPlatformFeeOverride(""); setNewCustomerType("reguler");
      setEnableCustomDate(false); setCustomOrderDate("");
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
          <div className="flex items-center justify-between">
            <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Input Pesanan</h1>
          </div>

          {/* ── Sumber Pesanan (Channel Selector) ── */}
          <div className="grid grid-cols-4 gap-1.5 mt-3 mb-2">
            {([
              { key: "walkin", label: "Walk-in", emoji: "🏪" },
              { key: "whatsapp", label: "WhatsApp", emoji: "💬" },
              { key: "tiktok", label: "TikTok", emoji: "🎵" },
              { key: "shopee", label: "Shopee", emoji: "🛍️" },
            ] as const).map(ch => (
              <button key={ch.key} onClick={() => { setOrderChannel(ch.key); setCart([]); setSelectedCustomer(null); setCustomerSearch(""); setPlatformFeeOverride(""); }}
                style={{ padding: "8px 4px", borderRadius: "10px", fontSize: "11px", fontWeight: "600", border: "none", cursor: "pointer", textAlign: "center",
                  color: orderChannel === ch.key ? "#fff" : "#64748B",
                  background: orderChannel === ch.key ? "#E85D8C" : "#F1F5F9" }}>
                <span style={{ marginRight: "4px" }}>{ch.emoji}</span>
                {ch.label}
              </button>
            ))}
          </div>

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
          className="fixed left-0 right-0 z-50"
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
                const stockId = `${selectedProduct.id}_${v.id}`;
                const stockItem = productStocks.find(s => s.id === stockId);
                const currentStock = stockItem ? stockItem.currentStock : 0;
                const minStock = stockItem ? stockItem.minStock : v.minStock;
                const isLowStock = currentStock < minStock;
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
                        Stok: {currentStock} pcs {isLowStock ? "⚠ Rendah" : ""}
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
          <div className="overflow-y-auto" style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "92vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#1C1C1E" }}>Checkout Pesanan</h2>
                <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>Sumber: <strong style={{ color: "#E85D8C" }}>{orderChannel === "walkin" ? "Walk-in 🏪" : orderChannel === "whatsapp" ? "WhatsApp 💬" : orderChannel === "tiktok" ? "TikTok 🎵" : "Shopee 🛍️"}</strong></p>
              </div>
              <button onClick={() => setShowCheckout(false)}
                style={{ width: "30px", height: "30px", borderRadius: "10px", background: "#F8FAFC", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} style={{ color: "#64748B" }} />
              </button>
            </div>


            {/* Cart summary */}
            <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "12px 14px", marginBottom: "14px" }}>
              {cart.map((item, i) => (
                <div key={i} className="flex items-center justify-between"
                  style={{ paddingBottom: i < cart.length - 1 ? "8px" : 0, marginBottom: i < cart.length - 1 ? "8px" : 0, borderBottom: i < cart.length - 1 ? "1px solid #F1F5F9" : "none" }}>
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
                    <button onClick={() => removeFromCart(i)}
                      style={{ width: "22px", height: "22px", borderRadius: "6px", background: "#FEE2E2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={11} style={{ color: "#DC2626" }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Customer Picker — hanya untuk WhatsApp ── */}
            {orderChannel === "whatsapp" && (
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>
                  Pelanggan
                </label>
                <div ref={customerRef} style={{ position: "relative" }}>
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between"
                      style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #E85D8C", background: "#FEF1F5" }}>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>{selectedCustomer.name}</p>
                        <p style={{ fontSize: "11px", color: "#E85D8C", textTransform: "uppercase" }}>{selectedCustomer.customerType}</p>
                      </div>
                      <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); }}
                        style={{ width: "24px", height: "24px", borderRadius: "8px", background: "#FEE2E2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={12} style={{ color: "#DC2626" }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input type="text" placeholder="Cari nama pelanggan atau ketik baru..."
                        value={customerSearch}
                        onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "13px", outline: "none", background: "#F8FAFC" }}
                        data-testid="checkout-customer-search" />
                      {showCustomerDropdown && (filteredCustomers.length > 0 || isNewCustomer) && (
                        <div style={{ position: "absolute", top: "44px", left: 0, right: 0, background: "#fff", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10, overflow: "hidden" }}>
                          {filteredCustomers.map(c => (
                            <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerDropdown(false); }}
                              className="w-full flex items-center justify-between"
                              style={{ padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #F8FAFC" }}
                              data-testid={`customer-option-${c.id}`}>
                              <div>
                                <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{c.name}</p>
                                {c.phoneNumber && <p style={{ fontSize: "11px", color: "#94A3B8" }}>{c.phoneNumber}</p>}
                              </div>
                              <span style={{ padding: "2px 8px", borderRadius: "6px", background: c.customerType === "b2b" ? "#EFF6FF" : c.customerType === "reseller" ? "#FEF3C7" : "#F8FAFC", border: "1px solid #E2E8F0", fontSize: "10px", fontWeight: "600", color: c.customerType === "b2b" ? "#2563EB" : c.customerType === "reseller" ? "#D97706" : "#64748B" }}>
                                {c.customerType?.toUpperCase()}
                              </span>
                            </button>
                          ))}
                          {customerSearch.trim() && (
                            <div style={{ padding: "10px 14px", borderTop: filteredCustomers.length ? "1px solid #F1F5F9" : "none" }}>
                              <p style={{ fontSize: "11px", color: "#64748B", marginBottom: "6px" }}>
                                {isNewCustomer ? `"${customerSearch.trim()}" belum ada di master pelanggan` : "Gunakan nama ini:"}
                              </p>
                              <button onClick={() => setShowCustomerDropdown(false)}
                                className="flex items-center gap-2 w-full"
                                style={{ padding: "8px 0", border: "none", background: "transparent", cursor: "pointer" }}
                                data-testid="use-custom-name-btn">
                                <span style={{ fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>"{customerSearch.trim()}"</span>
                                <span style={{ fontSize: "11px", color: "#94A3B8" }}>— tanpa simpan ke master</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* Opsi simpan ke master jika nama baru */}
                {isNewCustomer && !showCustomerDropdown && (
                  <div style={{ marginTop: "8px" }}>
                    <label className="flex items-center gap-2" style={{ cursor: "pointer", marginBottom: "6px" }}>
                      <input type="checkbox" checked={saveNewCustomer} onChange={e => setSaveNewCustomer(e.target.checked)}
                        style={{ accentColor: "#E85D8C" }} data-testid="save-new-customer-checkbox" />
                      <span style={{ fontSize: "12px", color: "#64748B" }}>Simpan "{customerSearch.trim()}" ke master pelanggan</span>
                    </label>
                    {saveNewCustomer && (
                      <div className="flex gap-1.5">
                        {(["reguler", "b2b", "reseller"] as const).map(ct => (
                          <button key={ct} onClick={() => setNewCustomerType(ct)}
                            style={{ flex: 1, padding: "6px", borderRadius: "8px", fontSize: "11px", fontWeight: "600", border: "none", cursor: "pointer",
                              color: newCustomerType === ct ? "#fff" : "#64748B",
                              background: newCustomerType === ct ? "#E85D8C" : "#F1F5F9" }}>
                            {ct.charAt(0).toUpperCase() + ct.slice(1)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Fee Marketplace (TikTok/Shopee) ── */}
            {(orderChannel === "tiktok" || orderChannel === "shopee") && (
              <div style={{ marginBottom: "12px", padding: "12px", borderRadius: "12px", background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <p style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", marginBottom: "8px" }}>Potongan Platform</p>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.1" min="0" max="100"
                    placeholder={`Default: ${orderChannel === "tiktok" ? marketplaceFees.tiktok : marketplaceFees.shopee}%`}
                    value={platformFeeOverride}
                    onChange={e => setPlatformFeeOverride(e.target.value)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "13px", outline: "none", background: "#fff" }} />
                  <span style={{ fontSize: "13px", color: "#64748B" }}>%</span>
                  {platformFeeOverride !== "" && (
                    <button onClick={() => setPlatformFeeOverride("")}
                      style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#FEE2E2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={12} style={{ color: "#DC2626" }} />
                    </button>
                  )}
                </div>
                <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Fee aktif: {activeFeePercent}% → Potongan: {fmt(feeAmount)}</p>
              </div>
            )}


            {/* ── Status Bayar — hanya untuk WhatsApp ── */}
            {orderChannel === "whatsapp" && (
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
                  Status Pembayaran
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setIsPaid(true)} data-testid="pay-status-paid"
                    className="flex items-center justify-center gap-1.5 flex-1"
                    style={{ padding: "9px", borderRadius: "12px", fontSize: "12px", fontWeight: "600", border: "none", cursor: "pointer",
                      color: isPaid ? "#fff" : "#16A34A", background: isPaid ? "#16A34A" : "#DCFCE7" }}>
                    <CheckCircle2 size={13} /> Sudah Bayar
                  </button>
                  <button onClick={() => setIsPaid(false)} data-testid="pay-status-unpaid"
                    className="flex items-center justify-center gap-1.5 flex-1"
                    style={{ padding: "9px", borderRadius: "12px", fontSize: "12px", fontWeight: "600", border: "none", cursor: "pointer",
                      color: !isPaid ? "#fff" : "#DC2626", background: !isPaid ? "#DC2626" : "#FEE2E2" }}>
                    <CreditCard size={13} /> Belum Bayar
                  </button>
                </div>
              </div>
            )}

            {/* ── Metode Pembayaran (hanya tampil jika sudah bayar & bukan marketplace record only) ── */}
            {(orderChannel === "walkin" || (orderChannel === "whatsapp" && isPaid)) && (

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
                  Metode Pembayaran
                </label>
                <div className="flex gap-2">
                  {(["cash", "transfer", "qris"] as PayMethod[]).map(m => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      style={{ flex: 1, padding: "9px 0", borderRadius: "12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: "none",
                        color: payMethod === m ? "#fff" : "#64748B", background: payMethod === m ? "#E85D8C" : "#F1F5F9" }}
                      data-testid={`pay-method-${m}`}>
                      {m === "cash" ? "Tunai" : m === "transfer" ? "Transfer" : "QRIS"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tanggal Transaksi Mundur (Hanya Owner/Manager) ── */}
            {role && (role === "owner" || role === "manager") && (
              <div style={{ marginBottom: "14px", padding: "10px 12px", borderRadius: "12px", background: "#FEF1F5", border: "1px solid #F2A0B7" }}>
                <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={enableCustomDate} onChange={e => {
                    setEnableCustomDate(e.target.checked);
                    if (e.target.checked && !customOrderDate) {
                      setCustomOrderDate(new Date().toISOString().split("T")[0]);
                    }
                  }} style={{ accentColor: "#E85D8C" }} />
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#E85D8C" }}>Catat Tanggal Mundur (Masa Lalu)</span>
                </label>
                {enableCustomDate && (
                  <input type="date" value={customOrderDate} onChange={e => setCustomOrderDate(e.target.value)}
                    style={{ width: "100%", marginTop: "8px", padding: "8px 12px", borderRadius: "10px", border: "1px solid #F2A0B7", fontSize: "13px", outline: "none", color: "#1C1C1E", background: "#fff" }} />
                )}
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: "14px" }}>
              <input type="text" placeholder="Catatan pesanan (opsional)" value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "13px", outline: "none", background: "#F8FAFC" }}
                data-testid="checkout-notes" />
            </div>

            {/* Total + Net Revenue */}
            <div style={{ padding: "12px 14px", borderRadius: "12px", background: "#FEF1F5", border: "1px solid #F2A0B7", marginBottom: "14px" }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#64748B" }}>Total Pesanan</span>
                <span style={{ fontSize: "18px", fontWeight: "700", color: "#E85D8C" }}>{fmt(cartTotal)}</span>
              </div>
              {feeAmount > 0 && (
                <>
                  <div className="flex items-center justify-between" style={{ marginTop: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#94A3B8" }}>Fee {orderChannel} ({activeFeePercent}%)</span>
                    <span style={{ fontSize: "12px", color: "#DC2626" }}>- {fmt(feeAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between" style={{ marginTop: "4px", paddingTop: "6px", borderTop: "1px solid #F2A0B7" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#64748B" }}>Pendapatan Bersih</span>
                    <span style={{ fontSize: "16px", fontWeight: "700", color: "#16A34A" }}>{fmt(netRevenue)}</span>
                  </div>
                </>
              )}
            </div>

            {/* B2B invoice notice */}
            {isB2B && (
              <div className="flex items-center gap-2" style={{ padding: "10px 12px", borderRadius: "10px", background: "#EFF6FF", border: "1px solid #BFDBFE", marginBottom: "14px" }}>
                <span style={{ fontSize: "12px", color: "#2563EB" }}>Invoice B2B bisa dicetak dari halaman detail pesanan setelah pesanan dibuat.</span>
              </div>
            )}

            {error && <p style={{ fontSize: "12px", color: "#DC2626", textAlign: "center", marginBottom: "8px" }}>{error}</p>}

            <button onClick={handleCheckout} disabled={submitting || !cart.length} className="w-full"
              style={{ padding: "15px", borderRadius: "14px", fontSize: "14px", fontWeight: "700", color: "#fff",
                background: isPaid ? "#E85D8C" : "#F59E0B", border: "none", cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
              data-testid="confirm-order-btn">
              {submitting ? "Memproses..." : isPaid ? "Konfirmasi & Catat Pesanan" : "Catat Pesanan (Belum Bayar)"}
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
