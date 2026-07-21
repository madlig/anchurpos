import { useMemo } from "react";
import type { CustomerItem } from "../types";

interface Props {
  orderChannel: "walkin" | "whatsapp" | "tiktok" | "shopee";
  setOrderChannel: (val: "walkin" | "whatsapp" | "tiktok" | "shopee") => void;
  customers: CustomerItem[];
  customerSearch: string;
  setCustomerSearch: (val: string) => void;
  selectedCustomer: CustomerItem | null;
  setSelectedCustomer: (val: CustomerItem | null) => void;
  showCustomerDropdown: boolean;
  setShowCustomerDropdown: (val: boolean) => void;
  showPoNumber: boolean;
  setShowPoNumber: (val: boolean) => void;
  poNumber: string;
  setPoNumber: (val: string) => void;
  enableCustomDate: boolean;
  setEnableCustomDate: (val: boolean) => void;
  customOrderDate: string;
  setCustomOrderDate: (val: string) => void;
  orderNotes: string;
  setOrderNotes: (val: string) => void;
  shippingAddress: string;
  setShippingAddress: (val: string) => void;
  deliveryMethod: "pickup" | "self_delivery" | "courier";
  setDeliveryMethod: (val: "pickup" | "self_delivery" | "courier") => void;
  shippingCost: string;
  setShippingCost: (val: string) => void;
  shippingBorneBy: "seller" | "customer";
  setShippingBorneBy: (val: "seller" | "customer") => void;
}

export function CustomerDetailForm({
  orderChannel, setOrderChannel,
  customers, customerSearch, setCustomerSearch, selectedCustomer, setSelectedCustomer,
  showCustomerDropdown, setShowCustomerDropdown,
  showPoNumber, setShowPoNumber, poNumber, setPoNumber,
  enableCustomDate, setEnableCustomDate, customOrderDate, setCustomOrderDate,
  orderNotes, setOrderNotes,
  shippingAddress, setShippingAddress,
  deliveryMethod, setDeliveryMethod,
  shippingCost, setShippingCost,
  shippingBorneBy, setShippingBorneBy
}: Props) {

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    return customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase().trim()));
  }, [customers, customerSearch]);

  const isNewCustomer = useMemo(() => {
    return customerSearch.trim() && !selectedCustomer && !customers.some(c => c.name.toLowerCase() === customerSearch.toLowerCase().trim());
  }, [customers, customerSearch, selectedCustomer]);

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100">
      <h2 className="text-sm font-bold text-slate-800 mb-3.5 pb-2.5 border-b border-slate-100">Detail Pelanggan & Transaksi</h2>
      
      {/* Channel Selector */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Sumber Saluran / Channel</label>
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
              className={`p-2 rounded-lg text-xs font-semibold border-none cursor-pointer ${orderChannel === ch ? "bg-primary text-white" : "bg-brand-50 text-slate-500"}`}
            >
              {ch === "walkin" ? "Walk-in" : ch === "whatsapp" ? "WhatsApp" : ch === "tiktok" ? "TikTok" : "Shopee"}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Picker */}
      <div className="mb-4 relative">
        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Pelanggan</label>
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
          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none focus:border-primary/50 focus:ring-2 focus:ring-pink-100 transition-all"
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
                className="p-2.5 text-xs hover:bg-primary/10 cursor-pointer text-slate-700 font-semibold"
              >
                {c.name} ({c.customerType})
              </div>
            ))}
            {isNewCustomer && (
              <div
                onClick={() => setShowCustomerDropdown(false)}
                className="p-2.5 text-xs text-slate-400 italic hover:bg-brand-50 cursor-pointer"
              >
                Nama Baru: "{customerSearch.trim()}" (Otomatis dibuat reguler)
              </div>
            )}
          </div>
        )}
      </div>

      {/* PO Number */}
      {(showPoNumber || selectedCustomer?.customerType === "b2b" || selectedCustomer?.customerType === "reseller") && (
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input type="checkbox" checked={showPoNumber} onChange={e => { setShowPoNumber(e.target.checked); if (!e.target.checked) setPoNumber(""); }} className="rounded accent-primary" />
            <span className="text-xs font-semibold text-slate-700">Tambahkan Nomor PO / Referensi</span>
          </label>
          {showPoNumber && (
            <input
              type="text"
              placeholder="Contoh: PO/2607..."
              value={poNumber}
              onChange={e => setPoNumber(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-primary/50 focus:ring-2 focus:ring-pink-100"
            />
          )}
        </div>
      )}

      {/* Custom Back-Dated Date */}
      <div className="mb-4 p-3 rounded-xl bg-brand-50 border border-slate-100">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={enableCustomDate}
            onChange={e => {
              setEnableCustomDate(e.target.checked);
              if (!e.target.checked) setCustomOrderDate("");
            }}
            className="rounded accent-primary"
          />
          <span className="text-xs font-semibold text-slate-700">Tanggal Mundur (Back-date)</span>
        </label>
        {enableCustomDate && (
          <input
            type="date"
            value={customOrderDate}
            onChange={e => setCustomOrderDate(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-primary/50 focus:ring-2 focus:ring-pink-100"
          />
        )}
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Catatan Tambahan</label>
        <textarea
          placeholder="Tulis catatan di sini..."
          value={orderNotes}
          onChange={e => setOrderNotes(e.target.value)}
          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none h-16 resize-none focus:border-primary/50 focus:ring-2 focus:ring-pink-100"
        />
      </div>

      {/* WhatsApp Shipping Details */}
      {orderChannel === "whatsapp" && (
        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/10/50 flex flex-col gap-3">
          <span className="text-xs font-bold text-primary uppercase block">Detail Pengiriman WhatsApp</span>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Alamat Pengiriman</label>
            <input
              type="text"
              placeholder="Tulis alamat kirim..."
              value={shippingAddress}
              onChange={e => setShippingAddress(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-primary/50 focus:ring-2 focus:ring-pink-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Metode Pengiriman</label>
            <div className="flex gap-2">
              {([ { key: "pickup", label: "Pickup" }, { key: "self_delivery", label: "Diantar Kita" }, { key: "courier", label: "Kurir Online" } ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setDeliveryMethod(opt.key);
                    if (opt.key === "pickup") { setShippingCost(""); setShippingBorneBy("customer"); }
                  }}
                  className={`flex-1 p-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer ${deliveryMethod === opt.key ? "bg-primary/10 text-primary" : "bg-white text-slate-500"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {deliveryMethod === "pickup" && (
            <p className="text-xs font-semibold text-green-600 bg-green-50 rounded-lg px-2.5 py-1.5">
              Pembeli akan mengambil sendiri. Tidak ada biaya ongkir.
            </p>
          )}

          {(deliveryMethod === "self_delivery" || deliveryMethod === "courier") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {deliveryMethod === "self_delivery" ? "Biaya Antar (Rp)" : "Biaya Ongkir (Rp)"}
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={shippingCost}
                  onChange={e => setShippingCost(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-primary/50 focus:ring-2 focus:ring-pink-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Ditanggung Oleh</label>
                <div className="flex gap-1.5 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setShippingBorneBy("customer")}
                    className={`flex-1 p-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer ${shippingBorneBy === "customer" ? "bg-primary/10 text-primary" : "bg-white text-slate-500"}`}
                  >
                    Pembeli
                  </button>
                  <button
                    type="button"
                    onClick={() => setShippingBorneBy("seller")}
                    className={`flex-1 p-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer ${shippingBorneBy === "seller" ? "bg-primary/10 text-primary" : "bg-white text-slate-500"}`}
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
  );
}
