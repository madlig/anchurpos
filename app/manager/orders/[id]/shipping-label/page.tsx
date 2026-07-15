"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useParams } from "next/navigation";
import { Loader2, PackageOpen, Printer, AlertTriangle } from "lucide-react";

interface OrderItem {
  id: string; productName: string; variantName: string;
  qty: number; basePrice: number; discountPerUnit: number; totalPrice: number;
}
interface OrderDetail {
  id: string; orderNumber: string; source: string;
  customerId: string | null; customerName: string; customerType: string | null; customerPhone: string | null;
  channel: string; status: string; paymentStatus: string; paymentMethod: string | null;
  shippingAddress: string | null; shippingCost: number | null; shippingCostConfirmed: boolean;
  shippingBorneBy: string | null; deliveryMethod: string | null;
  requestedDeliveryDate: string | null; orderNotes: string | null;
  createdAt: string; completedAt: string | null; items: OrderItem[];
}

export default function ShippingLabelPage() {
  const { getToken } = useAuth();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(async (url: string) => {
    const token = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [getToken]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(`/api/orders/${orderId}`);
        if (res.ok) {
          setOrder(await res.json());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchWithAuth, orderId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-slate-500">
        Order tidak ditemukan
      </div>
    );
  }

  const printLabel = () => {
    window.print();
  };

  const channelLabel = order.channel.toUpperCase();

  return (
    <div className="bg-white min-h-screen text-black">
      {/* Non-printable action bar */}
      <div className="print:hidden p-4 bg-slate-100 flex justify-end gap-3 sticky top-0 border-b border-slate-200">
        <button 
          onClick={() => window.close()}
          className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50"
        >
          Tutup
        </button>
        <button 
          onClick={printLabel}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm"
        >
          <Printer size={16} />
          Print Label (Ctrl+P)
        </button>
      </div>

      {/* Printable Area */}
      <div className="max-w-[100mm] mx-auto p-4 sm:p-6 print:p-0 print:max-w-none font-sans" id="print-area">
        
        {/* Header Label */}
        <div className="border-2 border-black p-4 rounded-xl mb-4">
          <div className="flex justify-between items-start mb-4 border-b-2 border-black pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase">ANCHUR.US</h1>
              <p className="text-[10px] font-bold mt-1 max-w-[150px]">Jl. Cempaka Putih Raya No. 123, Jakarta Pusat</p>
            </div>
            <div className="text-right">
              <div className="inline-block border-2 border-black px-2 py-1 mb-1">
                <p className="text-sm font-black uppercase">{channelLabel}</p>
              </div>
              <p className="text-xs font-bold">#{order.orderNumber.split("-").pop()}</p>
              <p className="text-[10px] mt-1">{new Date(order.createdAt).toLocaleDateString('id-ID')}</p>
            </div>
          </div>

          {/* Penerima */}
          <div className="mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest mb-1 border-b border-dashed border-black/30 inline-block pb-1">PENERIMA</h2>
            <p className="text-lg font-black leading-tight mt-1">{order.customerName}</p>
            {order.customerPhone && <p className="text-sm font-bold mt-1 font-mono">{order.customerPhone}</p>}
            <p className="text-xs mt-2 leading-snug break-words">
              {order.shippingAddress || <span className="italic text-gray-500">Alamat tidak dicantumkan</span>}
            </p>
          </div>

          {/* Pengirim */}
          <div className="mb-4 border-t-2 border-black pt-4">
             <h2 className="text-[10px] font-black uppercase tracking-widest mb-1 border-b border-dashed border-black/30 inline-block pb-1">PENGIRIM</h2>
             <p className="text-sm font-black mt-1">Anchur.us Admin</p>
             <p className="text-[10px] mt-0.5">0812-3456-7890</p>
          </div>

          {/* Fragile warning */}
          <div className="border-t-2 border-black pt-4 flex items-center justify-center gap-2">
            <AlertTriangle size={24} />
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-widest">FRAGILE - JANGAN DIBANTING</p>
              <p className="text-[10px] font-bold uppercase">Berisi Kue Kering & Dessert</p>
            </div>
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Isi Paket (Packing List) */}
        <div className="border-2 border-black p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-black">
            <PackageOpen size={16} />
            <h2 className="text-xs font-black uppercase tracking-widest">ISI PAKET (PACKING LIST)</h2>
          </div>
          
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dashed border-black/30">
                <th className="text-left font-black pb-2 w-12">QTY</th>
                <th className="text-left font-black pb-2">ITEM</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={item.id} className={idx !== order.items.length - 1 ? "border-b border-dashed border-black/20" : ""}>
                  <td className="py-2 align-top font-black text-sm">{item.qty}x</td>
                  <td className="py-2">
                    <p className="font-bold leading-tight">{item.productName}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{item.variantName}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {order.orderNotes && (
            <div className="mt-3 pt-3 border-t-2 border-black">
              <p className="text-[10px] font-black uppercase">Catatan Pembeli:</p>
              <p className="text-xs italic mt-1 font-bold">"{order.orderNotes}"</p>
            </div>
          )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white; margin: 0; padding: 0; }
          @page { margin: 0; size: auto; }
        }
      `}} />
    </div>
  );
}
