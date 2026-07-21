"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { X, CheckCircle2, CreditCard, MessageCircle, Store, Smartphone, ShoppingBag } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

// Types
import type { CartItem, CustomerItem } from "../types";

interface Props {
  cart: CartItem[];
  cartTotal: number;
  orderChannel: "walkin" | "whatsapp" | "tiktok" | "shopee";
  customers: CustomerItem[];
  setCustomers: React.Dispatch<React.SetStateAction<CustomerItem[]>>;
  addOns: any[];
  marketplaceFees: { tiktok: number; shopee: number };
  onClose: () => void;
  onSuccess: (orderId: string) => void;
  removeFromCart: (idx: number) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
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

export function CartCheckoutPanel({
  cart, cartTotal, orderChannel, customers, setCustomers,
  addOns, marketplaceFees, onClose, onSuccess, removeFromCart
}: Props) {
  const { getToken, role } = useAuth();
  const router = useRouter();

  // Internal states
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [saveNewCustomer, setSaveNewCustomer] = useState(false);
  const [newCustomerType, setNewCustomerType] = useState<"reguler" | "b2b" | "reseller">("reguler");
  const [payMethod, setPayMethod] = useState<"cash" | "transfer" | "qris">("cash");
  const [isPaid, setIsPaid] = useState(true);
  const [orderNotes, setOrderNotes] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [showPoNumber, setShowPoNumber] = useState(false);
  const [platformFeeOverride, setPlatformFeeOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [enableCustomDate, setEnableCustomDate] = useState(false);
  const [customOrderDate, setCustomOrderDate] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "self_delivery" | "courier">("courier");
  const [shippingCost, setShippingCost] = useState("");
  const [shippingBorneBy, setShippingBorneBy] = useState<"seller" | "customer">("customer");

  const [sauceDist, setSauceDist] = useState<Record<string, number>>({});
  
  const computedSauceDist = useMemo(() => {
    const dist: Record<string, number> = {};
    if (!addOns.length) return dist;
    const defaultCoklat = addOns.find(a => a.id === "saus-coklat" || a.id === "saus-coklat-tiktok")?.id || "saus-coklat";
    cart.forEach(item => {
      const hasSauce = item.productId.toLowerCase().includes("churros") || (item.productName || "").toLowerCase().includes("churros");
      if (hasSauce) {
        dist[defaultCoklat] = (dist[defaultCoklat] ?? 0) + item.qty;
        const chosenSauce = item.sauceId || defaultCoklat;
        dist[chosenSauce] = (dist[chosenSauce] ?? 0) + item.qty;
      }
    });
    return dist;
  }, [cart, addOns]);

  const totalSaucesNeeded = useMemo(() => Object.values(computedSauceDist).reduce((s, v) => s + v, 0), [computedSauceDist]);

  useEffect(() => {
    setSauceDist(computedSauceDist);
  }, [computedSauceDist]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers.slice(0, 8);
    return customers.filter(c => c.name.toLowerCase().includes(q) || (c.phoneNumber ?? "").includes(q)).slice(0, 8);
  }, [customers, customerSearch]);

  const isNewCustomer = customerSearch.trim() && !selectedCustomer && !customers.some(c => c.name.toLowerCase() === customerSearch.toLowerCase().trim());
  const finalCustomerName = selectedCustomer ? selectedCustomer.name : customerSearch.trim() || "Walk-in";
  const effectiveCustomerType = selectedCustomer?.customerType ?? (isNewCustomer ? newCustomerType : "reguler");
  const isB2B = effectiveCustomerType === "b2b" || effectiveCustomerType === "reseller";

  const activeFeePercent = useMemo(() => {
    if (platformFeeOverride !== "") return parseFloat(platformFeeOverride) || 0;
    if (orderChannel === "tiktok") return marketplaceFees.tiktok;
    if (orderChannel === "shopee") return marketplaceFees.shopee;
    return 0;
  }, [orderChannel, marketplaceFees, platformFeeOverride]);

  const feeAmount = useMemo(() => Math.round(cartTotal * activeFeePercent / 100), [cartTotal, activeFeePercent]);

  async function handleCheckout() {
    if (!cart.length) return;
    setError(""); setSubmitting(true);
    try {
      const token = await getToken();
      let customerId = selectedCustomer?.id ?? null;
      if (isNewCustomer && saveNewCustomer && customerSearch.trim()) {
        const saveRes = await fetch("/api/customers", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: customerSearch.trim(), customerType: newCustomerType,
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

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: finalCustomerName, customerId, customerType: isNewCustomer ? newCustomerType : (selectedCustomer?.customerType ?? null),
          source: orderChannel === "walkin" ? "walk_in" : orderChannel === "whatsapp" ? "wa_form" : "marketplace_manual",
          orderChannel, items: cart.map(c => ({ productId: c.productId, variantId: c.variantId, qty: c.qty, sauceId: c.sauceId, sauceName: c.sauceName })),
          orderNotes: orderNotes.trim() || null, paymentMethod: payMethod, paymentStatus: isPaid ? "sudah_bayar" : "belum_bayar",
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
      onSuccess(data.orderId);
    } catch { setError("Gagal menghubungi server"); } finally { setSubmitting(false); }
  }

  return (
    <div className="flex flex-col h-full bg-white">

        {/* Cart summary */}
        <div className="bg-brand-50 rounded-xl p-3 mb-4">
          {cart.map((item, i) => (
            <div key={i} className={`flex items-center justify-between ${i < cart.length - 1 ? "pb-2 mb-2 border-b border-slate-100" : ""}`}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><span className="text-xs font-bold text-primary">{item.qty}x</span></div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">{item.productName}</p>
                  <p className="text-xs text-slate-400">{item.variantName}{item.sauceName ? ` · Saus: ${item.sauceName}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">{fmt(item.price * item.qty)}</span>
                <button onClick={() => removeFromCart(i)} className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center"><X size={11} className="text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Customer Picker */}
        {orderChannel === "whatsapp" && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1.5">Pelanggan</label>
            <div className="relative">
              {selectedCustomer ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-primary bg-primary/10">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{selectedCustomer.name}</p>
                    <p className="text-xs text-primary uppercase">{selectedCustomer.customerType}</p>
                  </div>
                  <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); }} className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center"><X size={12} className="text-red-600" /></button>
                </div>
              ) : (
                <>
                  <input type="text" placeholder="Cari atau ketik baru..." value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }} onFocus={() => setShowCustomerDropdown(true)} className="w-full p-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-brand-50" />
                  {showCustomerDropdown && (filteredCustomers.length > 0 || isNewCustomer) && (
                    <div className="absolute top-[44px] left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-lg z-10 overflow-hidden">
                      {filteredCustomers.map(c => (
                        <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerDropdown(false); }} className="w-full flex items-center justify-between p-2.5 border-b border-slate-50 text-left">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                            {c.phoneNumber && <p className="text-xs text-slate-400">{c.phoneNumber}</p>}
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-brand-50 border border-slate-200 text-xs font-semibold text-slate-500">{c.customerType?.toUpperCase()}</span>
                        </button>
                      ))}
                      {customerSearch.trim() && (
                        <div className="p-2.5">
                          <p className="text-xs text-slate-500 mb-1.5">{isNewCustomer ? "Gunakan nama baru ini:" : "Gunakan nama ini:"}</p>
                          <button onClick={() => setShowCustomerDropdown(false)} className="flex items-center gap-2 w-full text-left">
                            <span className="text-sm font-bold text-slate-800">"{customerSearch.trim()}"</span>
                            <span className="text-xs text-slate-400">— tanpa simpan</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {isNewCustomer && !showCustomerDropdown && (
              <div className="mt-2">
                <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                  <input type="checkbox" checked={saveNewCustomer} onChange={e => setSaveNewCustomer(e.target.checked)} className="accent-primary" />
                  <span className="text-xs text-slate-500">Simpan "{customerSearch.trim()}" ke master</span>
                </label>
                {saveNewCustomer && (
                  <div className="flex gap-1.5">
                    {(["reguler", "b2b", "reseller"] as const).map(ct => (
                      <button key={ct} onClick={() => setNewCustomerType(ct)} className={`flex-1 p-1.5 rounded-lg text-xs font-semibold ${newCustomerType === ct ? "bg-primary/10 text-primary" : "bg-white text-slate-500"}`}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Marketplace Fee */}
        {(orderChannel === "tiktok" || orderChannel === "shopee") && (
          <div className="mb-3 p-3 rounded-xl bg-brand-50 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Potongan Platform</p>
            <div className="flex items-center gap-2">
              <input type="number" step="0.1" min="0" placeholder={`Default: ${orderChannel === "tiktok" ? marketplaceFees.tiktok : marketplaceFees.shopee}%`} value={platformFeeOverride} onChange={e => setPlatformFeeOverride(e.target.value)} className="flex-1 p-2 rounded-lg border border-slate-200 text-sm outline-none" />
              <span className="text-sm text-slate-500">%</span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Fee aktif: {activeFeePercent}% → Potongan: {fmt(feeAmount)}</p>
          </div>
        )}

        {/* Payment Status & Method */}
        {(orderChannel === "whatsapp" || orderChannel === "walkin") && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">Status & Metode Bayar</label>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setIsPaid(true)} className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-semibold ${isPaid ? "bg-green-600 text-white" : "bg-green-100 text-green-600"}`}><CheckCircle2 size={13} /> Sudah Bayar</button>
              <button onClick={() => setIsPaid(false)} className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-semibold ${!isPaid ? "bg-red-600 text-white" : "bg-red-100 text-red-600"}`}><CreditCard size={13} /> Belum Bayar</button>
            </div>
            {(orderChannel === "walkin" || (orderChannel === "whatsapp" && isPaid)) && (
              <div className="flex gap-2">
                {(["cash", "transfer", "qris"] as const).map(m => (
                  <button key={m} onClick={() => setPayMethod(m)} className={`flex-1 p-2 rounded-xl text-xs font-semibold ${payMethod === m ? "bg-primary/10 text-primary" : "bg-white text-slate-500"}`}>{m === "cash" ? "Tunai" : m === "transfer" ? "Transfer" : "QRIS"}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shipping */}
        {orderChannel === "whatsapp" && (
          <div className="mb-3 p-3 rounded-xl bg-brand-50 border border-slate-200">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-2">Metode Pengiriman</label>
            <div className="flex gap-2 mb-2">
              {([ { key: "pickup", label: "Pickup" }, { key: "self_delivery", label: "Diantar Kita" }, { key: "courier", label: "Kurir" } ] as const).map(opt => (
                <button key={opt.key} onClick={() => { setDeliveryMethod(opt.key); if (opt.key === "pickup") { setShippingCost(""); setShippingBorneBy("customer"); } }} className={`flex-1 p-1.5 rounded-lg text-xs font-semibold ${deliveryMethod === opt.key ? "bg-primary/10 text-primary" : "bg-white text-slate-500"}`}>{opt.label}</button>
              ))}
            </div>
            {(deliveryMethod === "self_delivery" || deliveryMethod === "courier") && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-slate-500 font-semibold">Rp</span>
                  <input type="number" placeholder="0" value={shippingCost} onChange={e => setShippingCost(e.target.value)} className="flex-1 p-2 rounded-lg border border-slate-200 text-sm outline-none" />
                </div>
                <p className="text-xs text-slate-400 mb-1">Ditanggung Oleh:</p>
                <div className="flex gap-2">
                  <button onClick={() => setShippingBorneBy("customer")} className={`flex-1 p-1.5 rounded-lg text-xs font-semibold ${shippingBorneBy === "customer" ? "bg-primary/10 text-primary" : "bg-white text-slate-500"}`}>Pembeli</button>
                  <button onClick={() => setShippingBorneBy("seller")} className={`flex-1 p-1.5 rounded-lg text-xs font-semibold ${shippingBorneBy === "seller" ? "bg-primary/10 text-primary" : "bg-white text-slate-500"}`}>Toko</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back-dated Order */}
        {role && (role === "owner" || role === "manager") && (
          <div className="mb-3 p-2.5 rounded-xl bg-primary/10 border border-pink-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={enableCustomDate} onChange={e => { setEnableCustomDate(e.target.checked); if (e.target.checked && !customOrderDate) setCustomOrderDate(new Date().toISOString().split("T")[0]); }} className="accent-primary" />
              <span className="text-xs font-semibold text-primary">Catat Tanggal Mundur</span>
            </label>
            {enableCustomDate && <input type="date" value={customOrderDate} onChange={e => setCustomOrderDate(e.target.value)} className="w-full mt-2 p-2 rounded-lg border border-pink-200 text-sm outline-none bg-white" />}
          </div>
        )}

        {/* Sauce Info */}
        {totalSaucesNeeded > 0 && addOns.length > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-primary/10 border border-pink-200">
            <span className="text-xs font-bold text-primary uppercase block mb-1.5">Rincian Saus (Otomatis)</span>
            <div className="flex flex-col gap-1">
              {Object.entries(sauceDist).map(([sauceId, qty]) => {
                if (qty <= 0) return null;
                const name = addOns.find(a => a.id === sauceId)?.name || sauceId;
                return <div key={sauceId} className="flex justify-between items-center text-xs font-semibold text-slate-700 border-b border-dashed border-slate-200 pb-1 pt-1"><span>🍮 {name}</span><span className="text-primary font-bold">{qty} cup</span></div>;
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        <input type="text" placeholder="Catatan (opsional)" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} className="w-full mb-3 p-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-brand-50" />

        {/* Total Price */}
        <div className="p-3 rounded-xl bg-primary/10 border border-pink-200 mb-4">
          <div className="flex justify-between items-center"><span className="text-[14px] font-semibold text-slate-500">Total Pesanan</span><span className="text-[18px] font-bold text-primary">{fmt(cartTotal)}</span></div>
          {orderChannel === "whatsapp" && deliveryMethod !== "pickup" && (parseInt(shippingCost) || 0) > 0 && (
            <div className="flex justify-between items-center mt-1"><span className="text-xs text-slate-400">Ongkir ({shippingBorneBy === "customer" ? "Ditanggung Pembeli" : "Ditanggung Kita"})</span><span className={`text-xs font-semibold ${shippingBorneBy === "customer" ? "text-green-600" : "text-red-600"}`}>{shippingBorneBy === "customer" ? "+" : "-"} {fmt(parseInt(shippingCost) || 0)}</span></div>
          )}
          {feeAmount > 0 && (
            <div className="flex justify-between items-center mt-1"><span className="text-xs text-slate-400">Fee {orderChannel} ({activeFeePercent}%)</span><span className="text-xs text-red-600">- {fmt(feeAmount)}</span></div>
          )}
          <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-pink-200"><span className="text-sm font-bold text-slate-500">{deliveryMethod !== "pickup" && shippingBorneBy === "customer" && (parseInt(shippingCost) || 0) > 0 ? "Total Tagihan" : "Pendapatan Bersih"}</span><span className="text-[16px] font-bold text-green-600">{fmt((cartTotal - feeAmount) + (orderChannel === "whatsapp" && deliveryMethod !== "pickup" && shippingBorneBy === "customer" ? (parseInt(shippingCost) || 0) : 0))}</span></div>
        </div>

        {error && <p className="text-xs text-red-600 text-center mb-2">{error}</p>}

        <button onClick={handleCheckout} disabled={submitting || !cart.length} className={`w-full p-3.5 rounded-2xl text-sm font-bold text-white ${isPaid ? "bg-primary" : "bg-amber-500"} ${submitting ? "opacity-70" : ""}`}>
          {submitting ? "Memproses..." : isPaid ? "Konfirmasi & Catat Pesanan" : "Catat Pesanan (Belum Bayar)"}
        </button>
    </div>
  );
}
