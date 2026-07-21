"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, AlertCircle, ShoppingBag } from "lucide-react";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";

// Components
import { EditCartList } from "./components/EditCartList";
import { AddItemForm } from "./components/AddItemForm";
import { CustomerDetailForm } from "./components/CustomerDetailForm";
import { PaymentStatusCard } from "./components/PaymentStatusCard";
import { OrderSummaryCard } from "./components/OrderSummaryCard";

// Types
import type { ProductItem, Variant, CustomerItem, EditCartItem, AddonItem } from "./types";

function getPrice(product: ProductItem, qty: number): number {
  if (!product.priceTiers.length) return 0;
  const sorted = [...product.priceTiers].sort((a, b) => a.minQty - b.minQty);
  let activePrice = sorted[0].price;
  for (const tier of sorted) {
    if (qty >= tier.minQty) {
      activePrice = tier.price;
    }
  }
  return activePrice;
}

export default function EditOrderPage() {
  const { getToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { alert, confirm } = useAlertConfirm();

  // DB Data
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [addOns, setAddOns] = useState<AddonItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [loadingOrder, setLoadingOrder] = useState(true);

  // Order Details
  const [orderNumber, setOrderNumber] = useState("");
  const [orderChannel, setOrderChannel] = useState<"walkin" | "whatsapp" | "tiktok" | "shopee">("walkin");
  const [cart, setCart] = useState<EditCartItem[]>([]);
  
  // Customer & Meta
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [showPoNumber, setShowPoNumber] = useState(false);
  const [enableCustomDate, setEnableCustomDate] = useState(false);
  const [customOrderDate, setCustomOrderDate] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // Shipping
  const [shippingAddress, setShippingAddress] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "self_delivery" | "courier">("courier");
  const [shippingCost, setShippingCost] = useState("");
  const [shippingBorneBy, setShippingBorneBy] = useState<"seller" | "customer">("customer");

  // Payment
  const [isPaid, setIsPaid] = useState(true);
  const [payMethod, setPayMethod] = useState("cash");
  const [platformFeeOverride, setPlatformFeeOverride] = useState("");

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
      fetchWithAuth("/api/addons").then(r => r.json()),
      fetchWithAuth("/api/customers").then(r => r.json()),
    ]).then(([p, v, addonsData, c]) => {
      setProducts(Array.isArray(p) ? p : []);
      setVariants(Array.isArray(v) ? v : []);
      setAddOns(Array.isArray(addonsData) ? addonsData : []);
      setCustomers(Array.isArray(c) ? c : []);
    }).catch(err => {
      console.error("Gagal memuat data pendukung:", err);
    }).finally(() => setDbLoading(false));
  }, [fetchWithAuth]);

  useEffect(() => {
    if (dbLoading) return;
    (async () => {
      try {
        const res = await fetchWithAuth(`/api/orders/${orderId}`);
        if (!res.ok) {
          setError("Pesanan tidak ditemukan atau Gagal memuat data pesanan.");
          setLoadingOrder(false);
          return;
        }
        const o = await res.json();
        
        if (o.status === "selesai") {
          setError("Pesanan yang sudah diselesaikan tidak dapat diedit kembali.");
          setLoadingOrder(false);
          return;
        }

        setOrderNumber(o.orderNumber);
        setOrderChannel(o.orderChannel || "walkin");
        
        if (o.poNumber) {
          setPoNumber(o.poNumber);
          setShowPoNumber(true);
        }
        
        const mappedCart: EditCartItem[] = o.items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId,
          variantName: item.variantName,
          qty: item.qty,
          price: item.basePrice,
          sauceId: item.sauceId || undefined,
          sauceName: item.sauceName || undefined,
        }));
        setCart(mappedCart);

        if (o.customerId) {
          const cust = customers.find(c => c.id === o.customerId);
          if (cust) {
            setSelectedCustomer(cust);
            setCustomerSearch(cust.name);
          }
        } else if (o.customerName) {
          setCustomerSearch(o.customerName);
        }

        setIsPaid(o.paymentStatus === "sudah_bayar");
        setPayMethod(o.paymentMethod || "cash");
        setOrderNotes(o.orderNotes || "");
        setShippingAddress(o.shippingAddress || "");
        setShippingCost(o.shippingCost ? String(o.shippingCost) : "");
        setShippingBorneBy(o.shippingBorneBy || "customer");
        setDeliveryMethod(o.deliveryMethod ?? (o.shippingCost ? "courier" : "pickup"));
        setPlatformFeeOverride(o.platformFeePercent ? String(o.platformFeePercent) : "");

        if (o.createdAt) {
          const orderDate = o.createdAt.split("T")[0];
          const todayDate = new Date().toISOString().split("T")[0];
          if (orderDate !== todayDate) {
            setEnableCustomDate(true);
            setCustomOrderDate(orderDate);
          }
        }
      } catch (err) {
        console.error("Gagal memuat pesanan detail:", err);
        setError("Gagal menghubungi server untuk memuat pesanan.");
      } finally {
        setLoadingOrder(false);
      }
    })();
  }, [orderId, dbLoading, customers, fetchWithAuth]);

  const recalculatePrices = useCallback((currentCart: EditCartItem[]): EditCartItem[] => {
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

  const handleAddItem = (newItem: EditCartItem) => {
    setCart(prev => {
      const next = [...prev];
      const idx = next.findIndex(c => c.productId === newItem.productId && c.variantId === newItem.variantId && c.sauceId === newItem.sauceId);
      if (idx >= 0) {
        next[idx] = { ...next[idx], qty: next[idx].qty + newItem.qty };
      } else {
        next.push(newItem);
      }
      return recalculatePrices(next);
    });
  };

  const handleRemoveItem = (index: number) => {
    setCart(prev => recalculatePrices(prev.filter((_, i) => i !== index)));
  };

  const handleAdjustQty = (index: number, delta: number) => {
    setCart(prev => {
      const next = [...prev];
      next[index] = { ...next[index], qty: Math.max(1, next[index].qty + delta) };
      return recalculatePrices(next);
    });
  };

  const handleSauceChange = (index: number, newSauceId: string) => {
    const addon = addOns.find(a => a.id === newSauceId);
    setCart(prev => {
      const next = [...prev];
      next[index] = { ...next[index], sauceId: newSauceId, sauceName: addon?.name ?? newSauceId };
      return next;
    });
  };

  const isNewCustomer = useMemo(() => customerSearch.trim() && !selectedCustomer && !customers.some(c => c.name.toLowerCase() === customerSearch.toLowerCase().trim()), [customers, customerSearch, selectedCustomer]);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  
  const computedSauceDist = useMemo(() => {
    const dist: Record<string, number> = {};
    if (!addOns.length) return dist;
    const defaultCoklat = addOns.find(a => a.id === "saus-coklat" || a.id === "saus-coklat-tiktok")?.id || "saus-coklat";

    cart.forEach(item => {
      const hasSauce = item.productId.toLowerCase().includes("churros");
      if (hasSauce) {
        dist[defaultCoklat] = (dist[defaultCoklat] ?? 0) + item.qty;
        const chosen = item.sauceId || defaultCoklat;
        dist[chosen] = (dist[chosen] ?? 0) + item.qty;
      }
    });
    return dist;
  }, [cart, addOns]);

  const totalSauces = useMemo(() => Object.values(computedSauceDist).reduce((s, v) => s + v, 0), [computedSauceDist]);
  
  const grandTotal = useMemo(() => cartTotal + (orderChannel === "whatsapp" ? (parseInt(shippingCost) || 0) : 0), [cartTotal, orderChannel, shippingCost]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.length) return alert("Pemesanan tidak boleh kosong! Tambahkan minimal 1 item.", "Peringatan");
    if (!customerSearch.trim()) return alert("Nama pelanggan wajib diisi!", "Peringatan");

    const approved = await confirm("Apakah Anda yakin ingin menyimpan perubahan pada pesanan ini? Stok dan biaya akan disesuaikan secara otomatis.", "Konfirmasi");
    if (!approved) return;

    setSubmitting(true);
    setError("");

    try {
      let resolvedCustomerId = selectedCustomer?.id || null;
      if (isNewCustomer) {
        const cRes = await fetchWithAuth("/api/customers", {
          method: "POST",
          body: JSON.stringify({ name: customerSearch.trim(), customerType: "reguler", channel: orderChannel === "whatsapp" ? "whatsapp" : "walk_in", createdVia: "pos" }),
        });
        if (cRes.ok) {
          const newC = await cRes.json();
          resolvedCustomerId = newC.id;
        }
      }

      const body = {
        customerId: resolvedCustomerId,
        customerName: customerSearch.trim(),
        customerType: selectedCustomer?.customerType ?? "reguler",
        source: orderChannel === "walkin" ? "walk_in" : orderChannel === "whatsapp" ? "wa_form" : "marketplace_manual",
        orderChannel,
        items: cart.map(c => ({ productId: c.productId, variantId: c.variantId, qty: c.qty, sauceId: c.sauceId, sauceName: c.sauceName })),
        paymentMethod: payMethod,
        paymentStatus: isPaid ? "sudah_bayar" : "belum_bayar",
        shippingAddress: orderChannel === "whatsapp" ? shippingAddress.trim() || null : null,
        shippingCost: orderChannel === "whatsapp" && deliveryMethod !== "pickup" ? (parseInt(shippingCost) || 0) : null,
        shippingBorneBy: orderChannel === "whatsapp" && deliveryMethod !== "pickup" ? shippingBorneBy : null,
        deliveryMethod: orderChannel === "whatsapp" ? deliveryMethod : null,
        orderNotes: orderNotes.trim() || null,
        platformFeePercent: (orderChannel === "tiktok" || orderChannel === "shopee") ? (parseFloat(platformFeeOverride) || 0) : undefined,
        customDate: enableCustomDate && customOrderDate ? customOrderDate : undefined,
        poNumber: showPoNumber && poNumber.trim() ? poNumber.trim() : null,
        sauceDistribution: Object.keys(computedSauceDist).length > 0 ? computedSauceDist : undefined,
      };

      const res = await fetchWithAuth(`/api/orders/${orderId}`, { method: "PUT", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan perubahan pesanan.");
        setSubmitting(false);
        return;
      }
      router.push(`/manager/orders/${orderId}`);
    } catch (err) {
      setError("Gagal menghubungi server untuk memperbarui pesanan.");
      setSubmitting(false);
    }
  }

  if (dbLoading || loadingOrder) {
    return (
      <div className="flex h-screen items-center justify-center bg-pink-400">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-white" />
          <p className="text-white font-semibold text-sm">Memuat data pesanan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16 bg-pink-400">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3 px-5 py-4 max-w-5xl mx-auto">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center hover:bg-slate-100 transition-colors">
            <ArrowLeft size={16} className="text-slate-500" />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-800">Edit Pesanan #{orderNumber}</h1>
            <p className="text-xs text-slate-400">Sesuaikan item dan info transaksi</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 flex flex-col gap-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 flex gap-2.5 items-start">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-slate-100">
              <ShoppingBag size={15} className="text-primary" />
              <h2 className="text-sm font-bold text-slate-800">Daftar Item Belanja</h2>
            </div>
            
            <EditCartList
              cart={cart}
              addOns={addOns}
              onRemoveItem={handleRemoveItem}
              onAdjustQty={handleAdjustQty}
              onSauceChange={handleSauceChange}
            />

            <AddItemForm
              products={products}
              variants={variants}
              addOns={addOns}
              onAddItem={handleAddItem}
              getPrice={getPrice}
            />
          </div>

          <CustomerDetailForm
            orderChannel={orderChannel} setOrderChannel={setOrderChannel}
            customers={customers} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch}
            selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer}
            showCustomerDropdown={showCustomerDropdown} setShowCustomerDropdown={setShowCustomerDropdown}
            showPoNumber={showPoNumber} setShowPoNumber={setShowPoNumber} poNumber={poNumber} setPoNumber={setPoNumber}
            enableCustomDate={enableCustomDate} setEnableCustomDate={setEnableCustomDate} customOrderDate={customOrderDate} setCustomOrderDate={setCustomOrderDate}
            orderNotes={orderNotes} setOrderNotes={setOrderNotes}
            shippingAddress={shippingAddress} setShippingAddress={setShippingAddress}
            deliveryMethod={deliveryMethod} setDeliveryMethod={setDeliveryMethod}
            shippingCost={shippingCost} setShippingCost={setShippingCost}
            shippingBorneBy={shippingBorneBy} setShippingBorneBy={setShippingBorneBy}
          />
        </div>

        <div className="flex flex-col gap-4">
          <PaymentStatusCard
            isPaid={isPaid} setIsPaid={setIsPaid}
            payMethod={payMethod} setPayMethod={setPayMethod}
            orderChannel={orderChannel}
            platformFeeOverride={platformFeeOverride} setPlatformFeeOverride={setPlatformFeeOverride}
          />

          {totalSauces > 0 && addOns.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-100">
              <span className="text-xs font-bold text-primary uppercase block mb-2.5">Rincian Saus (Otomatis)</span>
              <div className="flex flex-col gap-2">
                {Object.entries(computedSauceDist).map(([sauceId, qty]) => {
                  if (qty <= 0) return null;
                  const name = addOns.find(a => a.id === sauceId)?.name || sauceId;
                  return (
                    <div key={sauceId} className="flex justify-between items-center text-xs font-semibold text-slate-700 pb-2 border-b border-dashed border-slate-100">
                      <span>🍮 {name}</span><span className="font-bold text-slate-800">{qty} cup</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-3 leading-snug">
                * Kebutuhan saus dipotong dari inventaris secara otomatis.
              </p>
            </div>
          )}

          <OrderSummaryCard
            cartTotal={cartTotal} shippingCost={shippingCost} orderChannel={orderChannel}
            grandTotal={grandTotal} submitting={submitting} onSubmit={handleSubmit} onCancel={() => router.back()}
          />
        </div>
      </div>
    </div>
  );
}
