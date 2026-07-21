import { Trash2 } from "lucide-react";
import type { EditCartItem, AddonItem } from "../types";

interface Props {
  cart: EditCartItem[];
  addOns: AddonItem[];
  onRemoveItem: (index: number) => void;
  onAdjustQty: (index: number, delta: number) => void;
  onSauceChange: (index: number, newSauceId: string) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export function EditCartList({ cart, addOns, onRemoveItem, onAdjustQty, onSauceChange }: Props) {
  if (cart.length === 0) {
    return (
      <p className="text-center py-6 text-xs text-slate-400 font-medium">Belum ada item dalam pesanan. Tambahkan item di bawah.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cart.map((item, idx) => {
        const hasSauce = item.productId.toLowerCase().includes("churros");
        return (
          <div key={idx} className="p-3 rounded-xl bg-brand-50 border border-slate-100 flex flex-col gap-2.5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-800">{item.productName}</p>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">{item.variantName}</p>
              </div>
              <button type="button" onClick={() => onRemoveItem(idx)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border-none cursor-pointer">
                <Trash2 size={13} />
              </button>
            </div>

            {hasSauce && addOns.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase">Saus Bebas (Pilihan):</span>
                <select
                  value={item.sauceId || ""}
                  onChange={e => onSauceChange(idx, e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-200 text-xs outline-none text-slate-800 bg-white cursor-pointer max-w-[160px]"
                >
                  {addOns.map(addon => (
                    <option key={addon.id} value={addon.id}>{addon.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-between items-center pt-1.5">
              <span className="text-xs font-bold text-slate-700">{fmt(item.price * item.qty)} <span className="text-xs text-slate-400 font-normal">({fmt(item.price)} / pack)</span></span>
              
              <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-0.5">
                <button type="button" onClick={() => onAdjustQty(idx, -1)} className="w-6 h-6 rounded-md bg-white text-slate-500 shadow-sm font-bold flex items-center justify-center">-</button>
                <span className="text-xs font-bold text-slate-800 w-6 text-center">{item.qty}</span>
                <button type="button" onClick={() => onAdjustQty(idx, 1)} className="w-6 h-6 rounded-md bg-primary text-white font-bold flex items-center justify-center">+</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
