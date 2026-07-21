"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Search, ShoppingCart, X, Minus, Plus, ChevronDown, UserPlus, CreditCard, CheckCircle2, Store, MessageCircle, Trash2, Smartphone, ShoppingBag, ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PriceTier { id: string; minQty: number; maxQty: number | null; price: number; }
interface ProductItem {
  id: string; code: string; name: string; description: string;
  packPerBatch: number; isActive: boolean; priceTiers: PriceTier[]; channels?: string[];
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
  sauceId?: string;
  sauceName?: string;
}
interface AddonItem { id: string; name: string; price: number; currentStock: number; minStock: number; channels?: string[]; }

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

function getChannelIcon(channel: string, size = 14) {
  switch (channel) {
    case "walkin": return <Store size={size} />;
    case "whatsapp": return <MessageCircle size={size} />;
    case "tiktok": return <Smartphone size={size} />;
    case "shopee": return <ShoppingBag size={size} />;
    default: return null;
  }
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
  const [variantSelections, setVariantSelections] = useState<Record<string, { id: string; qty: number | ""; sauceId: string }[]>>({});
  
  // Dynamic Addon Sauce States
  const [addOns, setAddOns] = useState<any[]>([]);
  const [sauceDist, setSauceDist] = useState<Record<string, number>>({});

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);





  // Checkout sheet state
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderChannel, setOrderChannel] = useState<"walkin" | "whatsapp" | "tiktok" | "shopee" | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const filteredAddOns = useMemo(() => {
    return addOns.filter(a => !a.channels?.length || (orderChannel && a.channels.includes(orderChannel)));
  }, [addOns, orderChannel]);

  const defaultSauce = useMemo(() => {
    if (!filteredAddOns.length) return null;
    const tiramisu = filteredAddOns.find(a => a.name.toLowerCase().includes("tiramisu") || a.id === "saus-tiramisu");
    if (tiramisu) return tiramisu;
    return filteredAddOns[0];
  }, [filteredAddOns]);
  const [saveNewCustomer, setSaveNewCustomer] = useState(false);
  const [newCustomerType, setNewCustomerType] = useState<"reguler" | "b2b" | "reseller">("reguler");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [isPaid, setIsPaid] = useState(true);
  const [orderNotes, setOrderNotes] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [showPoNumber, setShowPoNumber] = useState(false);
  const [platformFeeOverride, setPlatformFeeOverride] = useState(""); // manual override if needed
  const [marketplaceFees, setMarketplaceFees] = useState({ tiktok: 0, shopee: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const customerRef = useRef<HTMLDivElement>(null);

  // Back-dated order states
  const [enableCustomDate, setEnableCustomDate] = useState(false);
  const [customOrderDate, setCustomOrderDate] = useState("");

  // WhatsApp shipping states
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "self_delivery" | "courier">("courier");
  const [shippingCost, setShippingCost] = useState("");
  const [shippingBorneBy, setShippingBorneBy] = useState<"seller" | "customer">("customer");


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
      fetchWithAuth("/api/addons").then(r => r.json()),
    ]).then(([p, v, c, s, fees, addonsData]) => {
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
      setCustomers(Array.isArray(c) ? c : []);
      setProductStocks(Array.isArray(s) ? s : []);
      setMarketplaceFees({ tiktok: fees.tiktok ?? 0, shopee: fees.shopee ?? 0 });
      setAddOns(Array.isArray(addonsData) ? addonsData : []);
    }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const isChannelMatch = !p.channels?.length || (orderChannel && p.channels.includes(orderChannel));
      const isCategoryMatch = activeCategory === "Semua" || p.name === activeCategory;
      const isSearchMatch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      return isChannelMatch && isCategoryMatch && isSearchMatch;
    });
  }, [products, activeCategory, search, orderChannel]);

  // ── Cart calculations ──────────────────────────────────────────────────────
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  // Kalkulasi distribusi saos glaze otomatis (Cokelat default + Pilihan bebas)
  const computedSauceDist = useMemo(() => {
    const dist: Record<string, number> = {};
    if (!addOns.length) return dist;

    // Cari saos cokelat default
    const defaultCoklat = addOns.find(a => a.id === "saus-coklat" || a.id === "saus-coklat-tiktok")?.id || "saus-coklat";

    cart.forEach(item => {
      const hasSauce = item.productId.toLowerCase().includes("churros") || (item.productName || "").toLowerCase().includes("churros");
      if (hasSauce) {
        // 1. Setiap pack mendapat 1x Cokelat default
        dist[defaultCoklat] = (dist[defaultCoklat] ?? 0) + item.qty;
        
        // 2. Setiap pack mendapat 1x Saus pilihan bebas
        const chosenSauce = item.sauceId || defaultCoklat;
        dist[chosenSauce] = (dist[chosenSauce] ?? 0) + item.qty;
      }
    });

    return dist;
  }, [cart, addOns]);

  const totalSaucesNeeded = useMemo(() => {
    return Object.values(computedSauceDist).reduce((s, v) => s + v, 0);
  }, [computedSauceDist]);

  useEffect(() => {
    if (showCheckout) {
      setSauceDist(computedSauceDist);
    } else {
      setSauceDist({});
    }
  }, [showCheckout, computedSauceDist]);

  // ── Variant sheet helpers ──────────────────────────────────────────────────
  function openVariantSheet(product: ProductItem) {
    setSelectedProduct(product);
    setVariantSelections({});
  }

  function addVariantSelectionRow(variantId: string, initialQty: number = 1) {
    const newRowId = Math.random().toString(36).substr(2, 9);
    const defSauce = defaultSauce?.id || (addOns[0]?.id ?? "");
    setVariantSelections(prev => {
      const currentRows = prev[variantId] || [];
      return { ...prev, [variantId]: [...currentRows, { id: newRowId, qty: initialQty, sauceId: defSauce }] };
    });
  }

  function updateVariantSelectionQty(variantId: string, rowId: string, delta: number) {
    setVariantSelections(prev => {
      const currentRows = prev[variantId] || [];
      const newRows = currentRows.map(r => {
        const currentQty = typeof r.qty === "number" ? r.qty : 1;
        return { ...r, qty: Math.max(1, currentQty + delta) };
      });
      return { ...prev, [variantId]: newRows };
    });
  }

  function setVariantSelectionQtyDirect(variantId: string, rowId: string, val: string) {
    setVariantSelections(prev => {
      const currentRows = prev[variantId] || [];
      const newRows: { id: string; qty: number | ""; sauceId: string }[] = currentRows.map(r => {
        if (r.id !== rowId) return r;
        if (val === "") return { ...r, qty: "" };
        return { ...r, qty: Math.max(1, parseInt(val) || 1) };
      });
      return { ...prev, [variantId]: newRows };
    });
  }

  function removeVariantSelectionRow(variantId: string, rowId: string) {
    setVariantSelections(prev => {
      const currentRows = prev[variantId] || [];
      const newRows = currentRows.filter(r => r.id !== rowId);
      return { ...prev, [variantId]: newRows };
    });
  }

  function updateVariantSelectionSauce(variantId: string, rowId: string, newSauceId: string) {
    setVariantSelections(prev => {
      const currentRows = prev[variantId] || [];
      const newRows = currentRows.map(r => r.id === rowId ? { ...r, sauceId: newSauceId } : r);
      return { ...prev, [variantId]: newRows };
    });
  }

  const totalVariantSelected = Object.values(variantSelections).flatMap(r => r).reduce((s, r) => s + (typeof r.qty === "number" ? r.qty : 0), 0);

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
    const hasSauce = selectedProduct.id.toLowerCase().includes("churros");

    for (const [variantId, rows] of Object.entries(variantSelections)) {
      const variant = variants.find(v => v.id === variantId);
      for (const row of rows) {
        if (typeof row.qty !== "number" || row.qty <= 0) continue;
        
        const price = 0; // will be recalculated by recalculateCartPrices
        const sId = hasSauce ? row.sauceId : undefined;
        const sName = sId ? (addOns.find(a => a.id === sId)?.name || sId) : undefined;

        newItems.push({
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          variantId,
          variantName: variant?.name ?? variantId,
          qty: row.qty,
          price,
          sauceId: sId,
          sauceName: sName,
        });
      }
    }

    setCart(prev => {
      const next = [...prev];
      for (const ni of newItems) {
        const idx = next.findIndex(c => c.productId === ni.productId && c.variantId === ni.variantId && c.sauceId === ni.sauceId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], qty: next[idx].qty + ni.qty };
        } else {
          next.push(ni);
        }
      }
      return recalculateCartPrices(next);
    });
    setSelectedProduct(null);
    setVariantSelections({});
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
            poNumber: showPoNumber && poNumber.trim() ? poNumber.trim() : null,
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
          items: cart.map(c => ({
            productId: c.productId,
            variantId: c.variantId,
            qty: c.qty,
            sauceId: c.sauceId,
            sauceName: c.sauceName,
          })),
          orderNotes: orderNotes.trim() || null,
          paymentMethod: payMethod,
          paymentStatus: isPaid ? "sudah_bayar" : "belum_bayar",
          poNumber: showPoNumber && poNumber.trim() ? poNumber.trim() : null,
          customDate: enableCustomDate && customOrderDate ? customOrderDate : undefined,
          shippingCost: orderChannel === "whatsapp" && deliveryMethod !== "pickup" ? (parseInt(shippingCost) || 0) : null,
          shippingBorneBy: orderChannel === "whatsapp" && deliveryMethod !== "pickup" ? shippingBorneBy : null,
          deliveryMethod: orderChannel === "whatsapp" ? deliveryMethod : null,
          sauceDistribution: totalSaucesNeeded > 0 ? sauceDist : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal menyimpan pesanan"); return; }
      // Reset
      setCart([]); setShowCheckout(false); setCustomerSearch("");
      setSelectedCustomer(null); setOrderNotes(""); setIsPaid(true); setSaveNewCustomer(false);
      setPlatformFeeOverride(""); setNewCustomerType("reguler");
      setEnableCustomDate(false); setCustomOrderDate("");
      setShippingCost(""); setShippingBorneBy("customer"); setDeliveryMethod("courier");

      router.push(`/manager/orders/${data.orderId}`);
    } catch { setError("Gagal menghubungi server"); } finally { setSubmitting(false); }
  }

  function adjustSauceQty(sauceId: string, delta: number) {
    setSauceDist(prev => {
      const curr = prev[sauceId] ?? 0;
      const next = Math.max(0, curr + delta);
      const totalWithNext = Object.entries(prev).reduce((sum, [id, val]) => {
        return sum + (id === sauceId ? next : val);
      }, 0);
      if (totalWithNext > totalSaucesNeeded) {
        return prev; // don't exceed total needed limit
      }
      return { ...prev, [sauceId]: next };
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#FEF1F5" }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#FCABB4" }} />
    </div>
  );

  if (!orderChannel) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-6" style={{ background: "#FEF1F5" }}>
        <div className="mb-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-3xl font-black text-[#1C1C1E] mb-2">Pilih Channel</h1>
          <p className="text-[#64748B] text-sm font-medium">Dari mana pesanan ini berasal?</p>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          {([
            { key: "walkin", label: "Walk-in" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "tiktok", label: "TikTok" },
            { key: "shopee", label: "Shopee" },
          ] as const).map(ch => (
            <button
              key={ch.key}
              onClick={() => { setOrderChannel(ch.key); setCart([]); setSelectedCustomer(null); setCustomerSearch(""); setPlatformFeeOverride(""); }}
              className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-[0_8px_30px_rgba(252,171,180,0.2)] border-2 border-transparent hover:border-[#FCABB4] hover:shadow-[0_8px_30px_rgba(252,171,180,0.4)] transition-all animate-in fade-in zoom-in-95 duration-300"
            >
              <div className="mb-3 p-4 bg-[#FEF1F5] rounded-full text-[#E85D8C]">
                {getChannelIcon(ch.key, 28)}
              </div>
              <span className="font-bold text-[#1C1C1E]">{ch.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#FEF1F5" }}>

      {/* ── Header (Glassmorphism) ── */}
      <div className="sticky top-0 z-30 pt-4 px-4 pb-4 bg-white/90 backdrop-blur-xl border-b border-pink-200 shadow-sm">
        <div className="flex items-center justify-between">
            <h1 style={{ fontSize: "18px", fontWeight: "800", color: "#1C1C1E" }}>Input Pesanan</h1>
          </div>

          {/* ── Sumber Pesanan (Channel Info) ── */}
          <div className="flex items-center justify-between mt-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/40 rounded-xl">
              <span className="text-pink-900 font-semibold text-xs flex items-center gap-1.5">
                {getChannelIcon(orderChannel)}
                {orderChannel === "walkin" ? "Walk-in" : orderChannel === "whatsapp" ? "WhatsApp" : orderChannel === "tiktok" ? "TikTok" : "Shopee"}
              </span>
            </div>
            <button 
              onClick={() => { setOrderChannel(null); setCart([]); setSelectedCustomer(null); setCustomerSearch(""); setPlatformFeeOverride(""); setPoNumber(""); setShowPoNumber(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl shadow-sm text-xs font-bold text-[#1C1C1E] hover:bg-brand-50 transition-colors"
            >
              <ArrowLeft size={14} /> Ganti Channel
            </button>
          </div>

          {/* Search bar */}
          <div
            className="flex items-center gap-2 mt-2"
            style={{ padding: "9px 12px", background: "rgba(255,255,255,0.5)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.6)" }}
          >
            <Search size={15} style={{ color: "#64748B", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Cari produk..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: "transparent", fontSize: "13px", color: "#1C1C1E", outline: "none" }}
              className="placeholder:text-slate-500"
              data-testid="pos-search"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={14} style={{ color: "#64748B" }} />
              </button>
            )}
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
                fontWeight: activeCategory === cat ? "700" : "600",
                color: activeCategory === cat ? "#1C1C1E" : "#475569",
                background: activeCategory === cat ? "#fff" : "rgba(255,255,255,0.4)",
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
          style={{ bottom: "66px", padding: "10px 16px", background: "linear-gradient(to top, #FEF1F5 60%, transparent)" }}
        >
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full flex items-center justify-between"
            style={{
              background: "linear-gradient(135deg, #FCABB4, #F9A8D4)",
              borderRadius: "100px",
              padding: "14px 20px",
              boxShadow: "0 8px 30px rgba(252,171,180,0.6)",
              border: "none",
              cursor: "pointer",
            }}
            data-testid="cart-bar-button"
          >
            <div className="flex items-center gap-2.5">
              <span
                style={{ background: "rgba(131,24,67,0.15)", borderRadius: "100px", padding: "3px 10px", fontSize: "12px", fontWeight: "800", color: "#831843" }}
              >
                {cartCount} item
              </span>
              <span style={{ fontSize: "15px", fontWeight: "800", color: "#831843" }}>{fmt(cartTotal)}</span>
            </div>
            <span style={{ fontSize: "14px", fontWeight: "800", color: "#831843" }}>Bayar →</span>
          </button>
        </div>
      )}

      {/* ── Variant Selector Sheet ── */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) { setSelectedProduct(null); setVariantSelections({}); } }}
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
                onClick={() => { setSelectedProduct(null); setVariantSelections({}); }}
                style={{ width: "30px", height: "30px", borderRadius: "10px", background: "#F8FAFC", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} style={{ color: "#64748B" }} />
              </button>
            </div>

            {/* Variant list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {variants.map(v => {
                const rows = variantSelections[v.id] || [];
                const qty = rows.reduce((s, r) => s + (typeof r.qty === "number" ? r.qty : 0), 0);
                const stockId = `${selectedProduct.id}_${v.id}`;
                const stockItem = productStocks.find(s => s.id === stockId);
                const currentStock = stockItem ? stockItem.currentStock : 0;
                const minStock = stockItem ? stockItem.minStock : v.minStock;
                const isLowStock = currentStock < minStock;
                const hasSauce = selectedProduct.id.toLowerCase().includes("churros") || (selectedProduct.name || "").toLowerCase().includes("churros");

                return (
                  <div
                    key={v.id}
                    style={{
                      display: "flex", flexDirection: "column", gap: "8px",
                      padding: "10px 14px", borderRadius: "12px",
                      background: qty > 0 ? "#FEF1F5" : "#F8FAFC",
                      border: qty > 0 ? "1px solid #F2A0B7" : "1px solid #F1F5F9",
                    }}
                    data-testid={`variant-row-${v.id}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{v.name}</p>
                        <p style={{ fontSize: "11px", color: isLowStock ? "#DC2626" : "#94A3B8", marginTop: "2px" }}>
                          Stok: {currentStock} pcs {isLowStock ? "⚠ Rendah" : ""}
                        </p>
                      </div>
                      
                      {/* Top level QTY controls — only active if NO rows exist or if product has NO sauce */}
                      {(!hasSauce || rows.length === 0) && (
                        <div className="flex items-center gap-1.5">
                          {qty > 0 ? (
                            <>
                              <button
                                onClick={() => {
                                  if (rows.length > 0) updateVariantSelectionQty(v.id, rows[0].id, -1);
                                }}
                                style={{ width: "30px", height: "30px", borderRadius: "8px", background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <Minus size={13} style={{ color: "#64748B" }} />
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={qty}
                                placeholder="0"
                                onChange={e => {
                                  if (rows.length > 0) {
                                    setVariantSelectionQtyDirect(v.id, rows[0].id, e.target.value);
                                  } else if (parseInt(e.target.value) > 0) {
                                    addVariantSelectionRow(v.id, parseInt(e.target.value));
                                  }
                                }}
                                style={{
                                  width: "54px",
                                  height: "30px",
                                  borderRadius: "8px",
                                  border: "1px solid #E2E8F0",
                                  textAlign: "center",
                                  fontSize: "13px",
                                  fontWeight: "700",
                                  color: "#1C1C1E",
                                  background: "#fff",
                                  outline: "none",
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (rows.length > 0) updateVariantSelectionQty(v.id, rows[0].id, 1);
                                  else addVariantSelectionRow(v.id, 1);
                                }}
                                style={{ width: "30px", height: "30px", borderRadius: "8px", background: "#E85D8C", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                data-testid={`add-variant-${v.id}`}
                              >
                                <Plus size={13} style={{ color: "#fff" }} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => {
                                  if (rows.length > 0) removeVariantSelectionRow(v.id, rows[0].id);
                                }}
                                style={{ marginLeft: "4px", width: "30px", height: "30px", borderRadius: "8px", background: "#FEE2E2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                title="Batal"
                              >
                                <Trash2 size={13} style={{ color: "#DC2626" }} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => addVariantSelectionRow(v.id, 1)}
                              style={{
                                padding: "6px 14px",
                                borderRadius: "8px",
                                background: "#E85D8C",
                                color: "#fff",
                                border: "none",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              data-testid={`add-variant-${v.id}`}
                            >
                              <Plus size={13} strokeWidth={2.5} /> Tambah
                            </button>
                          )}
                        </div>
                      )}

                      {/* Display total qty if product has sauce and has rows */}
                      {hasSauce && rows.length > 0 && (
                        <div style={{ fontSize: "14px", fontWeight: "700", color: "#E85D8C" }}>
                          Total: {qty}
                        </div>
                      )}
                    </div>

                    {/* Sauce Breakdown Rows */}
                    {hasSauce && rows.length > 0 && (
                      <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-primary/20 border-dashed">
                        {rows.map((row, index) => (
                          <div key={row.id} className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-pink-50">
                            <select
                              value={row.sauceId}
                              onChange={e => updateVariantSelectionSauce(v.id, row.id, e.target.value)}
                              style={{ padding: "4px 8px", borderRadius: "8px", border: "1px solid #F2A0B7", fontSize: "11px", outline: "none", color: "#1C1C1E", background: "#fff", cursor: "pointer", flex: 1, marginRight: "8px" }}
                            >
                              {addOns.map(addon => (
                                <option key={addon.id} value={addon.id}>{addon.name}</option>
                              ))}
                            </select>
                            
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => updateVariantSelectionQty(v.id, row.id, -1)}
                                style={{ width: "26px", height: "26px", borderRadius: "6px", background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <Minus size={11} style={{ color: "#64748B" }} />
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={row.qty}
                                placeholder="0"
                                onChange={e => {
                                  setVariantSelectionQtyDirect(v.id, row.id, e.target.value);
                                }}
                                style={{
                                  width: "40px",
                                  height: "26px",
                                  borderRadius: "6px",
                                  border: "1px solid #E2E8F0",
                                  textAlign: "center",
                                  fontSize: "12px",
                                  fontWeight: "700",
                                  color: "#1C1C1E",
                                  background: "#fff",
                                  outline: "none",
                                }}
                              />
                              <button
                                onClick={() => updateVariantSelectionQty(v.id, row.id, 1)}
                                style={{ width: "26px", height: "26px", borderRadius: "6px", background: "#E85D8C", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <Plus size={11} style={{ color: "#fff" }} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => removeVariantSelectionRow(v.id, row.id)}
                                style={{ marginLeft: "4px", width: "26px", height: "26px", borderRadius: "6px", background: "#FEE2E2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                title="Hapus kombinasi saus"
                              >
                                <Trash2 size={13} style={{ color: "#DC2626" }} />
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        <button
                          onClick={() => addVariantSelectionRow(v.id, 1)}
                          style={{ marginTop: "4px", padding: "6px 0", fontSize: "11px", fontWeight: "600", color: "#E85D8C", background: "transparent", border: "1px dashed #F2A0B7", borderRadius: "8px", cursor: "pointer", textAlign: "center", width: "100%" }}
                        >
                          + Tambah Kombinasi Saus
                        </button>
                      </div>
                    )}
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
                Tambah ke Cart ({totalVariantSelected} item · {fmt(cart.length === 0 ? getPrice(selectedProduct, totalVariantSelected) * totalVariantSelected : cartTotal + Object.values(variantSelections).flatMap(r => r).reduce((s, r) => s + getPrice(selectedProduct, typeof r.qty === "number" ? r.qty : 0) * (typeof r.qty === "number" ? r.qty : 0), 0))})
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
                <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                  Sumber:{" "}
                  <span className="inline-flex items-center gap-1 font-bold" style={{ color: "#E85D8C" }}>
                    {getChannelIcon(orderChannel, 12)}
                    {orderChannel === "walkin" ? "Walk-in" : orderChannel === "whatsapp" ? "WhatsApp" : orderChannel === "tiktok" ? "TikTok" : "Shopee"}
                  </span>
                </p>
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
                      <p style={{ fontSize: "11px", color: "#94A3B8" }}>
                        {item.variantName}
                        {item.sauceName ? ` · Saus: ${item.sauceName}` : ""}
                      </p>
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


            {/* ── Status Bayar — ── */}
            {(orderChannel === "whatsapp" || orderChannel === "walkin") && (
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

            {/* ── Metode Pengiriman — hanya untuk WhatsApp ── */}
            {orderChannel === "whatsapp" && (
              <div style={{ marginBottom: "12px", padding: "12px", borderRadius: "12px", background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>
                  Metode Pengiriman
                </label>

                {/* Step 1 — Pilih tipe */}
                <div className="flex gap-2 mb-3">
                  {([
                    { key: "pickup", label: "Pickup" },
                    { key: "self_delivery", label: "Diantar Kita" },
                    { key: "courier", label: "Kurir Online" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setDeliveryMethod(opt.key);
                        if (opt.key === "pickup") { setShippingCost(""); setShippingBorneBy("customer"); }
                      }}
                      style={{
                        flex: 1,
                        padding: "7px 4px",
                        borderRadius: "10px",
                        fontSize: "11px",
                        fontWeight: "600",
                        border: "none",
                        cursor: "pointer",
                        color: deliveryMethod === opt.key ? "#fff" : "#64748B",
                        background: deliveryMethod === opt.key ? "#E85D8C" : "#E2E8F0",
                        transition: "all 0.15s",
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Step 2 — Sub-fields per tipe */}
                {deliveryMethod === "pickup" && (
                  <p style={{ fontSize: "11px", color: "#16A34A", fontWeight: "600", padding: "8px 10px", background: "#DCFCE7", borderRadius: "8px" }}>
                    Pembeli akan mengambil sendiri. Tidak ada biaya ongkir.
                  </p>
                )}

                {(deliveryMethod === "self_delivery" || deliveryMethod === "courier") && (
                  <div>
                    <p style={{ fontSize: "10px", color: "#94A3B8", marginBottom: "6px" }}>
                      {deliveryMethod === "self_delivery" ? "Biaya antar (masukkan 0 jika gratis):" : "Biaya ongkir kurir:"}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ fontSize: "13px", color: "#64748B", fontWeight: "600" }}>Rp</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0"
                        value={shippingCost}
                        onChange={e => setShippingCost(e.target.value)}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "13px", outline: "none", background: "#fff", color: "#1C1C1E" }}
                      />
                      {shippingCost !== "" && (
                        <button onClick={() => setShippingCost("")}
                          style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#FEE2E2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <X size={12} style={{ color: "#DC2626" }} />
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: "10px", color: "#94A3B8", marginBottom: "6px" }}>Ditanggung Oleh:</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShippingBorneBy("customer")}
                        style={{ flex: 1, padding: "6px", borderRadius: "8px", fontSize: "11px", fontWeight: "600", border: "none", cursor: "pointer",
                          color: shippingBorneBy === "customer" ? "#fff" : "#64748B",
                          background: shippingBorneBy === "customer" ? "#E85D8C" : "#E2E8F0" }}>
                        Pembeli
                      </button>
                      <button onClick={() => setShippingBorneBy("seller")}
                        style={{ flex: 1, padding: "6px", borderRadius: "8px", fontSize: "11px", fontWeight: "600", border: "none", cursor: "pointer",
                          color: shippingBorneBy === "seller" ? "#fff" : "#64748B",
                          background: shippingBorneBy === "seller" ? "#E85D8C" : "#E2E8F0" }}>
                        Kita (Toko)
                      </button>
                    </div>
                  </div>
                )}
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

            {/* ── Distribusi Saos Glaze (Tinjauan Otomatis) ── */}
            {totalSaucesNeeded > 0 && addOns.length > 0 && (
              <div style={{ marginBottom: "12px", padding: "12px", borderRadius: "12px", background: "#FEF1F5", border: "1px solid #F2A0B7" }}>
                <span style={{ fontSize: "11px", fontWeight: "750", color: "#E85D8C", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  Rincian Saus Glaze (Otomatis)
                </span>
                <p style={{ fontSize: "10px", color: "#64748B", marginBottom: "8px", lineHeight: "1.3" }}>
                  Setiap pack churros (non-full) otomatis mendapatkan 1x Cokelat default + 1x rasa saus pilihan bebas Anda.
                </p>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(sauceDist).map(([sauceId, qty]) => {
                    if (qty <= 0) return null;
                    const name = addOns.find(a => a.id === sauceId)?.name || sauceId;
                    return (
                      <div key={sauceId} className="flex justify-between items-center text-xs font-semibold text-slate-700" style={{ padding: "4px 0", borderBottom: "1px dashed #F1F5F9" }}>
                        <span>🍮 {name}</span>
                        <span style={{ color: "#E85D8C", fontWeight: "700" }}>{qty} cup</span>
                      </div>
                    );
                  })}
                </div>
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
              {orderChannel === "whatsapp" && deliveryMethod !== "pickup" && (parseInt(shippingCost) || 0) > 0 && (
                <div className="flex items-center justify-between" style={{ marginTop: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#94A3B8" }}>
                    Ongkir ({shippingBorneBy === "customer" ? "Ditanggung Pembeli" : "Ditanggung Kita"})
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: shippingBorneBy === "customer" ? "#16A34A" : "#DC2626" }}>
                    {shippingBorneBy === "customer" ? "+" : "-"} {fmt(parseInt(shippingCost) || 0)}
                  </span>
                </div>
              )}

              {feeAmount > 0 && (
                <div className="flex items-center justify-between" style={{ marginTop: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#94A3B8" }}>Fee {orderChannel} ({activeFeePercent}%)</span>
                  <span style={{ fontSize: "12px", color: "#DC2626" }}>- {fmt(feeAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between" style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #F2A0B7" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#64748B" }}>
                  {deliveryMethod !== "pickup" && shippingBorneBy === "customer" && (parseInt(shippingCost) || 0) > 0 ? "Total Tagihan (inc. Ongkir)" : "Pendapatan Bersih"}
                </span>
                <span style={{ fontSize: "16px", fontWeight: "700", color: "#16A34A" }}>
                  {fmt(
                    (cartTotal - feeAmount) +
                    (orderChannel === "whatsapp" && deliveryMethod !== "pickup" && shippingBorneBy === "customer" ? (parseInt(shippingCost) || 0) : 0)
                  )}
                </span>
              </div>
              {orderChannel === "whatsapp" && deliveryMethod !== "pickup" && (parseInt(shippingCost) || 0) > 0 && shippingBorneBy === "seller" && (
                <p style={{ fontSize: "10px", color: "#64748B", marginTop: "6px", textAlign: "right", fontStyle: "italic" }}>
                  * Ongkir ditanggung kita akan otomatis dicatat sebagai pengeluaran operasional.
                </p>
              )}
            </div>

            {/* B2B invoice notice */}
            {isB2B && (
              <div className="flex items-center gap-2" style={{ padding: "10px 12px", borderRadius: "10px", background: "#EFF6FF", border: "1px solid #BFDBFE", marginBottom: "14px" }}>
                <span style={{ fontSize: "12px", color: "#2563EB" }}>Invoice B2B bisa dicetak dari halaman detail pesanan setelah pesanan dibuat.</span>
              </div>
            )}

            {error && <p style={{ fontSize: "12px", color: "#DC2626", textAlign: "center", marginBottom: "8px" }}>{error}</p>}

            {(() => {
              const allocated = Object.values(sauceDist).reduce((s, v) => s + v, 0);
              const isMatched = totalSaucesNeeded === 0 || allocated === totalSaucesNeeded;
              return (
                <button onClick={handleCheckout} disabled={submitting || !cart.length || !isMatched} className="w-full"
                  style={{ padding: "15px", borderRadius: "14px", fontSize: "14px", fontWeight: "800", color: !isMatched ? "#fff" : isPaid ? "#831843" : "#fff",
                    background: !isMatched ? "#94A3B8" : isPaid ? "#FCABB4" : "#F59E0B", border: "none", cursor: submitting || !isMatched ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
                  data-testid="confirm-order-btn">
                  {submitting ? "Memproses..." : !isMatched ? `Saos Kurang (${allocated}/${totalSaucesNeeded})` : isPaid ? "Konfirmasi & Catat Pesanan" : "Catat Pesanan (Belum Bayar)"}
                </button>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, variantCount, onAdd }: {
  product: ProductItem; variantCount: number; onAdd: () => void;
}) {
  const sp = startingPrice(product);
  return (
    <div
      onClick={onAdd}
      className="bg-white rounded-[16px] overflow-hidden border border-white/40 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col group relative"
      data-testid={`product-card-${product.id}`}
    >
      {/* Decorative gradient top bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FCABB4] to-[#F9A8D4]" />
      
      {/* Icon Area */}
      <div className="h-[70px] bg-brand-50 flex items-center justify-center group-hover:bg-primary/10/50 transition-colors">
        <div className="w-[38px] h-[38px] rounded-[12px] bg-white shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 group-hover:border-pink-200 transition-transform duration-300">
          <span className="text-[20px]">🍰</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm font-extrabold text-slate-800 leading-[1.3] line-clamp-2">{product.name}</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1.5">
          {variantCount} varian
        </p>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/60">
          <span className="text-[14px] font-black text-[#831843]">
            {sp > 0 ? fmt(sp) : "—"}
          </span>
          <button
            className="w-7 h-7 rounded-[8px] bg-slate-100 text-[#831843] group-hover:bg-[#FCABB4] group-hover:text-[#831843] transition-colors flex items-center justify-center"
            data-testid={`product-add-btn-${product.id}`}
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
