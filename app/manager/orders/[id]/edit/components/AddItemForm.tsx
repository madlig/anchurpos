import { useState, useMemo, useEffect } from "react";
import type { ProductItem, Variant, AddonItem, EditCartItem } from "../types";

interface Props {
  products: ProductItem[];
  variants: Variant[];
  addOns: AddonItem[];
  onAddItem: (item: EditCartItem) => void;
  getPrice: (product: ProductItem, qty: number) => number;
}

export function AddItemForm({ products, variants, addOns, onAddItem, getPrice }: Props) {
  const [newProdId, setNewProdId] = useState("");
  const [newVarId, setNewVarId] = useState("");
  const [newSauceId, setNewSauceId] = useState("");
  const [newQty, setNewQty] = useState(1);

  const allowedVariants = useMemo(() => variants, [variants]);
  
  useEffect(() => {
    if (newProdId) {
      setNewVarId(allowedVariants[0]?.id || "");
      const hasSauce = newProdId.toLowerCase().includes("churros");
      if (hasSauce && addOns.length > 0) {
        const tiramisu = addOns.find(a => a.name.toLowerCase().includes("tiramisu") || a.id === "saus-tiramisu") || addOns[0];
        setNewSauceId(tiramisu.id);
      } else {
        setNewSauceId("");
      }
    }
  }, [newProdId, allowedVariants, addOns]);

  function handleAddItem() {
    if (!newProdId || !newVarId) {
      alert("Pilih produk dan varian rasa terlebih dahulu!");
      return;
    }
    const product = products.find(p => p.id === newProdId);
    const variant = variants.find(v => v.id === newVarId);
    if (!product || !variant) return;

    const hasSauce = product.id.toLowerCase().includes("churros");
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

    onAddItem(newItem);

    // Reset
    setNewProdId("");
    setNewVarId("");
    setNewSauceId("");
    setNewQty(1);
  }

  return (
    <div className="mt-4 p-3.5 rounded-xl border border-dashed border-slate-200 bg-brand-50/50">
      <span className="text-xs font-bold text-slate-500 uppercase block mb-3">+ Tambah Produk Baru</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Produk</label>
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
          <label className="text-xs font-semibold text-slate-500 block mb-1">Varian Rasa</label>
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

      {newProdId && newProdId.toLowerCase().includes("churros") && addOns.length > 0 && (
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-500 block mb-1">Saus Bebas (Pilihan)</label>
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
          <span className="text-xs font-semibold text-slate-500">Qty:</span>
          <div className="flex items-center gap-1.5 bg-white rounded-lg border border-slate-200 p-0.5">
            <button type="button" onClick={() => setNewQty(q => Math.max(1, q - 1))} className="w-6 h-6 rounded-md bg-white text-slate-500 shadow-sm font-bold flex items-center justify-center">-</button>
            <span className="text-xs font-bold text-slate-800 w-5 text-center">{newQty}</span>
            <button type="button" onClick={() => setNewQty(q => q + 1)} className="w-6 h-6 rounded-md bg-primary text-white font-bold flex items-center justify-center">+</button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddItem}
          className="px-4 py-2 text-xs font-bold rounded-lg border-none text-white cursor-pointer bg-primary hover:bg-primary"
        >
          Tambah Ke Cart
        </button>
      </div>
    </div>
  );
}
