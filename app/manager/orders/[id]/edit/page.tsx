"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Plus, Trash2, CheckCircle2, AlertCircle, ShoppingBag } from "lucide-react";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";

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
interface EditCartItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  qty: number;
  price: number;
  sauceId?: string;
  sauceName?: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

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

  // Database lists
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [addOns, setAddOns] = useState<any[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Order state to edit
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [orderNumber, setOrderNumber] = useState("");
  const [originalCreatedAt, setOriginalCreatedAt] = useState("");

  // Edit fields states
  const [cart, setCart] = useState<EditCartItem[]>([]);
  const [orderChannel, setOrderChannel] = useState<"walkin" | "whatsapp" | "tiktok" | "shopee">("walkin");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [isPaid, setIsPaid] = useState(true);
  const [orderNotes, setOrderNotes] = useState("");
  const [platformFeeOverride, setPlatformFeeOverride] = useState("");
  
  const [enableCustomDate, setEnableCustomDate] = useState(false);
  const [customOrderDate, setCustomOrderDate] = useState("");

  const [poNumber, setPoNumber] = useState("");
  const [showPoNumber, setShowPoNumber] = useState(false);

  const [shippingCost, setShippingCost] = useState("");
  const [shippingBorneBy, setShippingBorneBy] = useState<"seller" | "customer">("customer");
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "self_delivery" | "courier">("courier");
  const [shippingAddress, setShippingAddress] = useState("");

  // Inline "Add Item" form states
  const [newProdId, setNewProdId] = useState("");
  const [newVarId, setNewVarId] = useState("");
  const [newSauceId, setNewSauceId] = useState("");
  const [newQty, setNewQty] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  // Load database lists
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

  // Load order details
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
        setOriginalCreatedAt(o.createdAt);
        
        if (o.poNumber) {
          setPoNumber(o.poNumber);
          setShowPoNumber(true);
        }
        
        // Map items to cart structure
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

        // Map customer
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
        // Load delivery method — fallback: if old order has shippingCost but no deliveryMethod, assume courier
        setDeliveryMethod(o.deliveryMethod ?? (o.shippingCost ? "courier" : "pickup"));
        setPlatformFeeOverride(o.platformFeePercent ? String(o.platformFeePercent) : "");


        // Custom back-dated date check
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

  // Recalculate price tiers dynamically
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

  // Quantity adjusters
  function adjustQty(index: number, delta: number) {
    setCart(prev => {
      const next = [...prev];
      const nextQty = Math.max(1, next[index].qty + delta);
      next[index] = { ...next[index], qty: nextQty };
      return recalculatePrices(next);
    });
  }

  // Remove item
  function removeItem(index: number) {
    setCart(prev => {
      const next = prev.filter((_, i) => i !== index);
      return recalculatePrices(next);
    });
  }

  // Sauce change
  function handleSauceChange(index: number, newSauceId: string) {
    const addon = addOns.find(a => a.id === newSauceId);
    setCart(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        sauceId: newSauceId,
        sauceName: addon?.name ?? newSauceId,
      };
      return next;
    });
  }

  // Handle adding new item inline
  const selectedProductDetails = useMemo(() => products.find(p => p.id === newProdId), [products, newProdId]);
  const allowedVariants = useMemo(() => variants, [variants]);
  
  // Set default variant & sauce when product changes
  useEffect(() => {
    if (newProdId) {
      setNewVarId(allowedVariants[0]?.id || "");
      const hasSauce = !newProdId.toLowerCase().includes("full");
      if (hasSauce && addOns.length > 0) {
        const tiramisu = addOns.find(a => a.name.toLowerCase().includes("tiramisu") || a.id === "saus-tiramisu") || addOns[0];
        setNewSauceId(tiramisu.id);
      } else {
        setNewSauceId("");
      }
    }
  }, [newProdId, allowedVariants, addOns]);

  async function handleAddItem() {
    if (!newProdId || !newVarId) {
      await alert("Pilih produk dan varian rasa terlebih dahulu!", "Peringatan");
      return;
    }
    const product = products.find(p => p.id === newProdId);
    const variant = variants.find(v => v.id === newVarId);
    if (!product || !variant) return;

    const hasSauce = !product.id.toLowerCase().includes("full") && !product.name.toLowerCase().includes("full");
    const sId = hasSauce ? newSauceId : undefined;
    const sName = sId ? (addOns.find(a => a.id === sId)?.name || sId) : undefined;

    const newItem: EditCartItem = {
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantName: variant.name,
      qty: newQty,
      price: getPrice(product, newQty),
      sauceId: sId,
      sauceName: sName,
    };

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

    // Reset inline form
    setNewProdId("");
    setNewVarId("");
    setNewSauceId("");
    setNewQty(1);
  }

  // Filtered customer search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    return customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase().trim()));
  }, [customers, customerSearch]);

  const isNewCustomer = useMemo(() => {
    return customerSearch.trim() && !selectedCustomer && !customers.some(c => c.name.toLowerCase() === customerSearch.toLowerCase().trim());
  }, [customers, customerSearch, selectedCustomer]);

  // Grand Total & Sauce calculations
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  
  const computedSauceDist = useMemo(() => {
    const dist: Record<string, number> = {};
    if (!addOns.length) return dist;
    const defaultCoklat = addOns.find(a => a.id === "saus-coklat" || a.id === "saus-coklat-tiktok")?.id || "saus-coklat";

    cart.forEach(item => {
      const hasSauce = !item.productId.toLowerCase().includes("full") && !item.productName.toLowerCase().includes("full");
      if (hasSauce) {
        // 1x default chocolate
        dist[defaultCoklat] = (dist[defaultCoklat] ?? 0) + item.qty;
        // 1x free choice
        const chosen = item.sauceId || defaultCoklat;
        dist[chosen] = (dist[chosen] ?? 0) + item.qty;
      }
    });
    return dist;
  }, [cart, addOns]);

  const totalSauces = useMemo(() => Object.values(computedSauceDist).reduce((s, v) => s + v, 0), [computedSauceDist]);
  
  const grandTotal = useMemo(() => {
    const shipping = orderChannel === "whatsapp" ? (parseInt(shippingCost) || 0) : 0;
    return cartTotal + shipping;
  }, [cartTotal, orderChannel, shippingCost]);

  // Submit edit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.length) {
      await alert("Pemesanan tidak boleh kosong! Tambahkan minimal 1 item.", "Peringatan");
      return;
    }
    if (!customerSearch.trim()) {
      await alert("Nama pelanggan wajib diisi!", "Peringatan");
      return;
    }

    const confirmText = "Apakah Anda yakin ingin menyimpan perubahan pada pesanan ini? Stok dan biaya akan disesuaikan secara otomatis.";
    const approved = await confirm(confirmText, "Konfirmasi");
    if (!approved) return;

    setSubmitting(true);
    setError("");

    try {
      let resolvedCustomerId = selectedCustomer?.id || null;

      // Handle new customer creation if needed
      if (isNewCustomer) {
        const cRes = await fetchWithAuth("/api/customers", {
          method: "POST",
          body: JSON.stringify({
            name: customerSearch.trim(),
            customerType: "reguler",
            channel: orderChannel === "whatsapp" ? "whatsapp" : "walk_in",
            createdVia: "pos",
          }),
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
        items: cart.map(c => ({
          productId: c.productId,
          variantId: c.variantId,
          qty: c.qty,
          sauceId: c.sauceId,
          sauceName: c.sauceName,
        })),
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


      const res = await fetchWithAuth(`/api/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan perubahan pesanan.");
        setSubmitting(false);
        return;
      }

      router.push(`/manager/orders/${orderId}`);
    } catch (err) {
      console.error(err);
      setError("Gagal menghubungi server untuk memperbarui pesanan.");
      setSubmitting(false);
    }
  }

  if (dbLoading || loadingOrder) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-white" />
          <p className="text-white font-semibold text-sm">Memuat data pesanan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: "#FCABB4" }}>
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: "#fff", borderBottom: "1px solid #F1F5F9" }}>
        <div className="flex items-center gap-3 px-5 py-4 max-w-5xl mx-auto">
          <button onClick={() => router.back()} style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#F8FAFC", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={16} style={{ color: "#64748B" }} />
          </button>
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: "700", color: "#1C1C1E" }}>Edit Pesanan #{orderNumber}</h1>
            <p style={{ fontSize: "11px", color: "#94A3B8" }}>Sesuaikan item dan info transaksi</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Left Columns - Forms & Cart */}
        <div className="md:col-span-2 flex flex-col gap-4">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 flex gap-2.5 items-start">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          {/* CARD 1: Daftar Produk */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: "1px solid #F1F5F9" }}>
            <div className="flex items-center gap-2 mb-3.5 pb-2.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
              <ShoppingBag size={15} style={{ color: "#E85D8C" }} />
              <h2 className="text-sm font-bold text-slate-800">Daftar Item Belanja</h2>
            </div>

            <div className="flex flex-col gap-3">
              {cart.map((item, idx) => {
                const isFull = item.productId.toLowerCase().includes("full") || item.productName.toLowerCase().includes("full");
                return (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.productName}</p>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{item.variantName}</p>
                      </div>
                      <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border-none cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Sauce Dropdown (only for non-full items) */}
                    {!isFull && addOns.length > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Saus Bebas (Pilihan):</span>
                        <select
                          value={item.sauceId || ""}
                          onChange={e => handleSauceChange(idx, e.target.value)}
                          style={{ padding: "4px 8px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "11px", outline: "none", color: "#1C1C1E", background: "#fff", cursor: "pointer", maxWidth: "160px" }}
                        >
                          {addOns.map(addon => (
                            <option key={addon.id} value={addon.id}>{addon.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1.5">
                      <span className="text-xs font-bold text-slate-700">{fmt(item.price * item.qty)} <span className="text-[10px] text-slate-400 font-normal">({fmt(item.price)} / pack)</span></span>
                      
                      {/* Qty controls */}
                      <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-0.5">
                        <button type="button" onClick={() => adjustQty(idx, -1)} style={{ width: "24px", height: "24px", borderRadius: "6px", background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "14px", color: "#64748B" }}>-</button>
                        <span className="text-xs font-bold text-slate-800 w-6 text-center">{item.qty}</span>
                        <button type="button" onClick={() => adjustQty(idx, 1)} style={{ width: "24px", height: "24px", borderRadius: "6px", background: "#E85D8C", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "14px", color: "#fff" }}>+</button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {cart.length === 0 && (
                <p className="text-center py-6 text-xs text-slate-400 font-medium">Belum ada item dalam pesanan. Tambahkan item di bawah.</p>
              )}
            </div>

            {/* Inline Add Item Form */}
            <div className="mt-4 p-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
              <span className="text-[11px] font-bold text-slate-500 uppercase block mb-3">+ Tambah Produk Baru</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">Produk</label>
                  <select
                    value={newProdId}
                    onChange={e => setNewProdId(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none"
                  >
                    <option value="">-- Pilih Produk --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">Varian Rasa</label>
                  <select
                    value={newVarId}
                    onChange={e => setNewVarId(e.target.value)}
                    disabled={!newProdId}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Pilih Rasa --</option>
                    {allowedVariants.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {newProdId && !newProdId.toLowerCase().includes("full") && addOns.length > 0 && (
                <div className="mb-3">
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">Saus Bebas (Pilihan)</label>
                  <select
                    value={newSauceId}
                    onChange={e => setNewSauceId(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none"
                  >
                    {addOns.map(addon => (
                      <option key={addon.id} value={addon.id}>{addon.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-between items-center gap-4 mt-1 pt-2.5 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500">Qty:</span>
                  <div className="flex items-center gap-1.5 bg-white rounded-lg border border-slate-200 p-0.5">
                    <button type="button" onClick={() => setNewQty(q => Math.max(1, q - 1))} style={{ width: "22px", height: "22px", borderRadius: "5px", background: "#F1F5F9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#64748B" }}>-</button>
                    <span className="text-xs font-bold text-slate-800 w-5 text-center">{newQty}</span>
                    <button type="button" onClick={() => setNewQty(q => q + 1)} style={{ width: "22px", height: "22px", borderRadius: "5px", background: "#E85D8C", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#fff" }}>+</button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 text-xs font-bold rounded-lg border-none text-white cursor-pointer"
                  style={{ background: "#E85D8C" }}
                >
                  Tambah Ke Cart
                </button>
              </div>
            </div>
          </div>

          {/* CARD 2: Detail Transaksi */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: "1px solid #F1F5F9" }}>
            <h2 className="text-sm font-bold text-slate-800 mb-3.5 pb-2.5" style={{ borderBottom: "1px solid #F1F5F9" }}>Detail Pelanggan & Transaksi</h2>
            
            {/* Channel Selector */}
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1.5">Sumber Saluran / Channel</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["walkin", "whatsapp", "tiktok", "shopee"] as const).map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => {
                      setOrderChannel(ch);
                      if (ch !== "whatsapp") {
                        setShippingCost("");
                        setShippingAddress("");
                      }
                    }}
                    style={{
                      padding: "8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600", border: "none", cursor: "pointer",
                      color: orderChannel === ch ? "#fff" : "#64748B",
                      background: orderChannel === ch ? "#E85D8C" : "#F8FAFC",
                    }}
                  >
                    {ch === "walkin" ? "Walk-in" : ch === "whatsapp" ? "WhatsApp" : ch === "tiktok" ? "TikTok" : "Shopee"}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Picker */}
            <div className="mb-4 relative">
              <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">Pelanggan</label>
              <input
                type="text"
                placeholder="Cari atau ketik nama pelanggan..."
                value={customerSearch}
                onChange={e => {
                  setCustomerSearch(e.target.value);
                  setSelectedCustomer(null);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none"
              />
              
              {showCustomerDropdown && (customerSearch.trim() !== "") && (
                <div className="absolute left-0 right-0 mt-1 z-30 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                  {filteredCustomers.map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerSearch(c.name);
                        setShowCustomerDropdown(false);
                      }}
                      className="p-2.5 text-xs hover:bg-pink-50 cursor-pointer text-slate-700 font-semibold"
                    >
                      {c.name} ({c.customerType})
                    </div>
                  ))}
                  {isNewCustomer && (
                    <div
                      onClick={() => setShowCustomerDropdown(false)}
                      className="p-2.5 text-xs text-slate-400 italic hover:bg-slate-50 cursor-pointer"
                    >
                      Nama Baru: "{customerSearch.trim()}" (Otomatis dibuat reguler)
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Input Nomor PO / Referensi (Khusus B2B & Reseller atau jika sudah ada PO) */}
            {(showPoNumber || selectedCustomer?.customerType === "b2b" || selectedCustomer?.customerType === "reseller") && (
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={showPoNumber} onChange={e => { setShowPoNumber(e.target.checked); if (!e.target.checked) setPoNumber(""); }}
                    className="rounded text-pink-600 focus:ring-pink-500" />
                  <span className="text-xs font-semibold text-slate-700">Tambahkan Nomor PO / Referensi</span>
                </label>
                {showPoNumber && (
                  <input
                    type="text"
                    placeholder="Contoh: PO/2607..."
                    value={poNumber}
                    onChange={e => setPoNumber(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none"
                  />
                )}
              </div>
            )}

            {/* Custom Back-Dated Date */}
            <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={enableCustomDate}
                  onChange={e => {
                    setEnableCustomDate(e.target.checked);
                    if (!e.target.checked) setCustomOrderDate("");
                  }}
                  className="rounded text-pink-600 focus:ring-pink-500"
                />
                <span className="text-xs font-semibold text-slate-700">Tanggal Mundur (Back-date)</span>
              </label>
              {enableCustomDate && (
                <input
                  type="date"
                  value={customOrderDate}
                  onChange={e => setCustomOrderDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none"
                />
              )}
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">Catatan Tambahan</label>
              <textarea
                placeholder="Tulis catatan di sini..."
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none h-16 resize-none"
              />
            </div>

            {/* WhatsApp Shipping Details */}
            {orderChannel === "whatsapp" && (
              <div className="p-3.5 rounded-xl border border-pink-100 bg-pink-50/20 mb-2 flex flex-col gap-3">
                <span className="text-[11px] font-bold text-pink-600 uppercase block">Detail Pengiriman WhatsApp</span>

                {/* Alamat */}
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">Alamat Pengiriman</label>
                  <input
                    type="text"
                    placeholder="Tulis alamat kirim..."
                    value={shippingAddress}
                    onChange={e => setShippingAddress(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none"
                  />
                </div>

                {/* Metode Pengiriman — 3 pilihan */}
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1.5">Metode Pengiriman</label>
                  <div className="flex gap-2">
                    {([
                      { key: "pickup", label: "Pickup" },
                      { key: "self_delivery", label: "Diantar Kita" },
                      { key: "courier", label: "Kurir Online" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setDeliveryMethod(opt.key);
                          if (opt.key === "pickup") { setShippingCost(""); setShippingBorneBy("customer"); }
                        }}
                        style={{
                          flex: 1, padding: "6px 4px", borderRadius: "8px",
                          fontSize: "10px", fontWeight: "600", border: "none", cursor: "pointer",
                          color: deliveryMethod === opt.key ? "#fff" : "#64748B",
                          background: deliveryMethod === opt.key ? "#E85D8C" : "#E2E8F0",
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pickup info */}
                {deliveryMethod === "pickup" && (
                  <p className="text-[10px] font-semibold text-green-600 bg-green-50 rounded-lg px-2.5 py-1.5">
                    Pembeli akan mengambil sendiri. Tidak ada biaya ongkir.
                  </p>
                )}

                {/* Biaya ongkir + siapa yang tanggung (untuk self_delivery & courier) */}
                {(deliveryMethod === "self_delivery" || deliveryMethod === "courier") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                        {deliveryMethod === "self_delivery" ? "Biaya Antar (Rp)" : "Biaya Ongkir (Rp)"}
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={shippingCost}
                        onChange={e => setShippingCost(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 block mb-1">Ditanggung Oleh</label>
                      <div className="flex gap-1.5 mt-0.5">
                        <button
                          type="button"
                          onClick={() => setShippingBorneBy("customer")}
                          style={{
                            flex: 1, padding: "6px", borderRadius: "8px", fontSize: "10px", fontWeight: "600", border: "none", cursor: "pointer",
                            color: shippingBorneBy === "customer" ? "#fff" : "#64748B",
                            background: shippingBorneBy === "customer" ? "#E85D8C" : "#E2E8F0"
                          }}
                        >
                          Pembeli
                        </button>
                        <button
                          type="button"
                          onClick={() => setShippingBorneBy("seller")}
                          style={{
                            flex: 1, padding: "6px", borderRadius: "8px", fontSize: "10px", fontWeight: "600", border: "none", cursor: "pointer",
                            color: shippingBorneBy === "seller" ? "#fff" : "#64748B",
                            background: shippingBorneBy === "seller" ? "#E85D8C" : "#E2E8F0"
                          }}
                        >
                          Toko (Free)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Right Column - Summary & Submit */}
        <div className="flex flex-col gap-4">
          
          {/* CARD 3: Pembayaran */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: "1px solid #F1F5F9" }}>
            <h2 className="text-sm font-bold text-slate-800 mb-3.5 pb-2.5" style={{ borderBottom: "1px solid #F1F5F9" }}>Status Pembayaran</h2>
            
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setIsPaid(true)}
                className="flex items-center justify-center gap-1 flex-1"
                style={{ padding: "8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600", border: "none", cursor: "pointer",
                  color: isPaid ? "#fff" : "#16A34A", background: isPaid ? "#16A34A" : "#DCFCE7" }}
              >
                <CheckCircle2 size={12} /> Sudah Bayar
              </button>
              <button
                type="button"
                onClick={() => setIsPaid(false)}
                className="flex items-center justify-center gap-1 flex-1"
                style={{ padding: "8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600", border: "none", cursor: "pointer",
                  color: !isPaid ? "#fff" : "#DC2626", background: !isPaid ? "#DC2626" : "#FEE2E2" }}
              >
                <AlertCircle size={12} /> Belum Bayar
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">Metode Bayar</label>
              <div className="grid grid-cols-3 gap-1.5">
                {["cash", "transfer", "qris"].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    style={{
                      padding: "6px", borderRadius: "8px", fontSize: "10px", fontWeight: "600", border: "none", cursor: "pointer",
                      color: payMethod === m ? "#fff" : "#64748B",
                      background: payMethod === m ? "#E85D8C" : "#F8FAFC",
                    }}
                  >
                    {m === "cash" ? "Tunai" : m === "transfer" ? "Transfer" : "QRIS"}
                  </button>
                ))}
              </div>
            </div>

            {/* Marketplace Platform Fee Overrides (Tiktok / Shopee) */}
            {(orderChannel === "tiktok" || orderChannel === "shopee") && (
              <div className="mt-4 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                <label className="text-[10px] font-semibold text-blue-800 block mb-1">Override Fee Platform (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Bawaan Pengaturan"
                  value={platformFeeOverride}
                  onChange={e => setPlatformFeeOverride(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-blue-200 bg-white outline-none text-slate-800"
                />
              </div>
            )}
          </div>

          {/* CARD 4: Otomatis Glaze Cup Summary */}
          {totalSauces > 0 && addOns.length > 0 && (
            <div style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: "1px solid #F1F5F9" }}>
              <span className="text-[11px] font-bold text-pink-600 uppercase block mb-2.5">Rincian Saus Glaze (Otomatis)</span>
              
              <div className="flex flex-col gap-2">
                {Object.entries(computedSauceDist).map(([sauceId, qty]) => {
                  if (qty <= 0) return null;
                  const name = addOns.find(a => a.id === sauceId)?.name || sauceId;
                  return (
                    <div key={sauceId} className="flex justify-between items-center text-xs font-semibold text-slate-700 pb-2 border-b border-dashed border-slate-100">
                      <span>🍮 {name}</span>
                      <span className="font-bold text-slate-800">{qty} cup</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-3 leading-snug">
                * Kebutuhan saus dipotong dari inventaris secara otomatis saat Anda menyimpan pembaruan transaksi ini.
              </p>
            </div>
          )}

          {/* CARD 5: Total & Submit */}
          <div style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: "1px solid #F1F5F9" }}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500 font-semibold">Subtotal Produk</span>
              <span className="text-xs font-bold text-slate-700">{fmt(cartTotal)}</span>
            </div>
            {orderChannel === "whatsapp" && (parseInt(shippingCost) > 0) && (
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500 font-semibold">Ongkir (WhatsApp)</span>
                <span className="text-xs font-bold text-slate-700">{fmt(parseInt(shippingCost))}</span>
              </div>
            )}

            <div className="flex justify-between items-center mt-3 pt-3 mb-4" style={{ borderTop: "2px solid #F1F5F9" }}>
              <span className="text-sm font-bold text-slate-800">Grand Total</span>
              <span className="text-base font-extrabold text-pink-600">{fmt(grandTotal)}</span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 cursor-pointer font-bold text-white border-none py-3 rounded-xl disabled:bg-slate-300 disabled:cursor-not-allowed"
                style={{ background: "#E85D8C", fontSize: "13px" }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : "Simpan Perubahan"}
              </button>
              
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full flex items-center justify-center font-bold text-slate-500 border border-slate-200 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer bg-white"
                style={{ fontSize: "12px" }}
              >
                Batal
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
