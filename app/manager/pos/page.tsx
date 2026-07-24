"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Search, X, Store, MessageCircle, Smartphone, ShoppingBag, ArrowLeft, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";

// Components
import { ProductGrid } from "./components/ProductGrid";
import { VariantSelectorModal } from "./components/VariantSelectorModal";
import { CartCheckoutPanel } from "./components/CartCheckoutPanel";
import { CartBottomBar } from "./components/CartBottomBar";
import { BottomSheet } from "@/components/shared/BottomSheet";

// Types
import type { ProductItem, Variant, CustomerItem, CartItem, AddonItem } from "./types";

function getChannelIcon(channel: string, size = 14) {
  switch (channel) {
    case "walkin": return <Store size={size} />;
    case "whatsapp": return <MessageCircle size={size} />;
    case "tiktok": return <Smartphone size={size} />;
    case "shopee": return <ShoppingBag size={size} />;
    default: return null;
  }
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

export default function KasirPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [productStocks, setProductStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [orderChannel, setOrderChannel] = useState<"walkin" | "whatsapp" | "tiktok" | "shopee" | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [addOns, setAddOns] = useState<AddonItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [marketplaceFees, setMarketplaceFees] = useState({ tiktok: 0, shopee: 0 });

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);
  const [configs, setConfigs] = useState<{ paymentMethods: string[], deliveryMethods: string[], shippingBorneBy: string[] } | null>(null);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/products").then(r => r.json()),
      fetchWithAuth("/api/variants").then(r => r.json()),
      fetchWithAuth("/api/customers").then(r => r.json()),
      fetchWithAuth("/api/products/stocks").then(r => r.json()),
      fetchWithAuth("/api/settings/marketplace-fee").then(r => r.ok ? r.json() : { tiktok: 0, shopee: 0 }),
      fetchWithAuth("/api/addons").then(r => r.json()),
      fetchWithAuth("/api/system-configs").then(r => r.ok ? r.json() : null),
    ]).then(([p, v, c, s, fees, addonsData, configsData]) => {
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
      setCustomers(Array.isArray(c) ? c : []);
      setProductStocks(Array.isArray(s) ? s : []);
      setMarketplaceFees({ tiktok: fees.tiktok ?? 0, shopee: fees.shopee ?? 0 });
      setAddOns(Array.isArray(addonsData) ? addonsData : []);
      if (configsData) {
        setConfigs({
          paymentMethods: configsData.paymentMethods || ["cash", "transfer", "qris"],
          deliveryMethods: configsData.deliveryMethods || ["pickup", "delivery"],
          shippingBorneBy: configsData.shippingBorneBy || ["seller", "customer"]
        });
      } else {
        setConfigs({ paymentMethods: ["cash", "transfer", "qris"], deliveryMethods: ["pickup", "delivery"], shippingBorneBy: ["seller", "customer"] });
      }
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
      const basePrice = getPrice(product, accumulatedQty);
      
      const totalPrice = basePrice * item.qty;

      return { 
        ...item, 
        price: basePrice, 
        basePrice, 
        appliedTier: `${accumulatedQty} pcs`, 
        discountPerUnit: 0, 
        totalPrice 
      };
    });
  }, [products]);

  function handleAddToCart(newItems: Omit<CartItem, "price" | "basePrice" | "appliedTier" | "discountPerUnit" | "totalPrice">[]) {
    setCart(prev => {
      const next = [...prev];
      for (const ni of newItems) {
        const idx = next.findIndex(c => c.productId === ni.productId && c.variantId === ni.variantId && c.sauceId === ni.sauceId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], qty: next[idx].qty + ni.qty };
        } else {
          // price, basePrice, etc. will be recalculated right after
          next.push({ ...ni, price: 0, basePrice: 0, appliedTier: "", discountPerUnit: 0, totalPrice: 0 }); 
        }
      }
      return recalculateCartPrices(next);
    });
    setSelectedProduct(null);
  }

  function removeFromCart(idx: number) {
    setCart(prev => recalculateCartPrices(prev.filter((_, i) => i !== idx)));
  }

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-brand-50">
      <Loader2 className="h-7 w-7 animate-spin text-pink-400" />
    </div>
  );

  if (!orderChannel) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-6 bg-brand-50">
        <div className="mb-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-3xl font-black text-slate-800 mb-2">Pilih Channel</h1>
          <p className="text-slate-500 text-sm font-medium">Dari mana pesanan ini berasal?</p>
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
              onClick={() => { setOrderChannel(ch.key); setCart([]); }}
              className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-[0_0_15px_rgba(244,63,94,0.05)] border border-primary/20 hover:border-primary/50 hover:shadow-lg transition-all animate-in fade-in zoom-in-95 duration-300"
            >
              <div className="mb-3 p-4 bg-primary/10 rounded-full text-primary">
                {getChannelIcon(ch.key, 28)}
              </div>
              <span className="font-bold text-slate-800">{ch.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col md:flex-row">
      {/* LEFT PANEL: Menu & Product Grid */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <div className="sticky top-0 z-30 pt-4 px-4 pb-4 bg-white/90 backdrop-blur-xl border-b border-primary/20 shadow-sm">
          <h1 className="text-lg font-extrabold text-slate-800">Input Pesanan</h1>

          <div className="flex items-center justify-between mt-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-xl">
              <span className="text-primary font-bold text-xs flex items-center gap-1.5">
                {getChannelIcon(orderChannel)}
                {orderChannel.charAt(0).toUpperCase() + orderChannel.slice(1)}
              </span>
            </div>
            <button 
              onClick={() => { setOrderChannel(null); setCart([]); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-slate-100 text-xs font-bold text-slate-800 hover:bg-brand-50 transition-colors"
            >
              <ArrowLeft size={14} /> Ganti Channel
            </button>
          </div>

          <div className="flex items-center gap-2 mt-2 px-3 py-2.5 bg-brand-50 rounded-xl border border-primary/10">
            <Search size={15} className="text-primary shrink-0" />
            <input
              type="text"
              placeholder="Cari produk..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
            />
            {search && <button onClick={() => setSearch("")}><X size={14} className="text-slate-500" /></button>}
          </div>

          <div className="flex gap-2 overflow-x-auto px-1 pt-3 pb-1" style={{ scrollbarWidth: "none" }}>
            {["Semua", ...products.map(p => p.name)].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs shrink-0 transition-colors ${activeCategory === cat ? "font-bold text-primary bg-primary/10 shadow-sm" : "font-semibold text-slate-500 bg-white shadow-sm border border-slate-100"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4" style={{ paddingBottom: cart.length > 0 ? "120px" : "24px" }}>
          <ProductGrid products={filteredProducts} variantCount={variants.length} onAdd={setSelectedProduct} />
        </div>
      </div>

      {/* RIGHT PANEL: Desktop Cart Checkout */}
      <div className="hidden md:flex w-[400px] border-l border-primary/20 bg-white flex-col h-screen sticky top-0 overflow-hidden shadow-[-10px_0_30px_rgba(244,63,94,0.03)] z-40">
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 h-full">
            <h2 className="text-lg font-extrabold text-slate-800 mb-4 flex items-center gap-2">
              <ShoppingCart size={20} className="text-primary" /> Checkout
            </h2>
            <CartCheckoutPanel
              cart={cart}
              cartTotal={cartTotal}
              orderChannel={orderChannel}
              customers={customers}
              setCustomers={setCustomers}
              addOns={addOns}
              marketplaceFees={marketplaceFees}
              configs={configs}
              onClose={() => {}}
              onSuccess={(orderId) => router.push(`/manager/orders/${orderId}`)}
              removeFromCart={removeFromCart}
            />
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM BAR */}
      <div className="md:hidden">
        <CartBottomBar cartCount={cartCount} cartTotal={cartTotal} onCheckout={() => setShowMobileCart(true)} />
      </div>

      {selectedProduct && (
        <VariantSelectorModal
          selectedProduct={selectedProduct}
          variants={variants}
          productStocks={productStocks}
          addOns={addOns}
          orderChannel={orderChannel}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* MOBILE CHECKOUT BOTTOM SHEET */}
      <BottomSheet isOpen={showMobileCart} onClose={() => setShowMobileCart(false)} title="Checkout">
        <CartCheckoutPanel
          cart={cart}
          cartTotal={cartTotal}
          orderChannel={orderChannel}
          customers={customers}
          setCustomers={setCustomers}
          addOns={addOns}
          marketplaceFees={marketplaceFees}
          configs={configs}
          onClose={() => setShowMobileCart(false)}
          onSuccess={(orderId) => router.push(`/manager/orders/${orderId}`)}
          removeFromCart={removeFromCart}
        />
      </BottomSheet>
    </div>
  );
}
