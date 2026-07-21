import { Loader2 } from "lucide-react";

interface Props {
  cartTotal: number;
  shippingCost: string;
  orderChannel: "walkin" | "whatsapp" | "tiktok" | "shopee";
  grandTotal: number;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export function OrderSummaryCard({
  cartTotal, shippingCost, orderChannel, grandTotal, submitting, onSubmit, onCancel
}: Props) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-slate-500 font-semibold">Subtotal Produk</span>
        <span className="text-xs font-bold text-slate-700">{fmt(cartTotal)}</span>
      </div>
      {orderChannel === "whatsapp" && (parseInt(shippingCost) > 0) && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-slate-500 font-semibold">Ongkir (WhatsApp)</span>
          <span className="text-xs font-bold text-slate-700">{fmt(parseInt(shippingCost))}</span>
        </div>
      )}

      <div className="flex justify-between items-center mt-3 pt-3 mb-5 border-t-2 border-slate-100">
        <span className="text-sm font-bold text-slate-800">Grand Total</span>
        <span className="text-base font-extrabold text-primary">{fmt(grandTotal)}</span>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          onClick={onSubmit}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 cursor-pointer font-bold text-white border-none py-3 rounded-xl disabled:bg-pink-300 disabled:cursor-not-allowed bg-primary hover:bg-primary transition-colors text-sm"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : "Simpan Perubahan"}
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          className="w-full flex items-center justify-center font-bold text-slate-500 border border-slate-200 py-2.5 rounded-xl hover:bg-brand-50 cursor-pointer bg-white text-xs transition-colors"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
