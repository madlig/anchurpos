"use client";

import { useState, useMemo } from "react";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/shared/BottomSheet";
import type { ProductItem, Variant, AddonItem, CartItem } from "../types";

interface Props {
  selectedProduct: ProductItem;
  variants: Variant[];
  productStocks: any[];
  addOns: AddonItem[];
  orderChannel: string;
  onClose: () => void;
  onAddToCart: (newItems: Omit<CartItem, "price">[]) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function startingPrice(product: ProductItem): number {
  if (!product.priceTiers.length) return 0;
  const sorted = [...product.priceTiers].sort((a, b) => a.minQty - b.minQty);
  return sorted[0].price;
}

export function VariantSelectorModal({
  selectedProduct, variants, productStocks, addOns, orderChannel, onClose, onAddToCart
}: Props) {
  const [variantSelections, setVariantSelections] = useState<Record<string, number | "">>({});

  function updateVariantSelectionQty(variantId: string, delta: number) {
    setVariantSelections(prev => {
      const current = prev[variantId];
      const currentQty = typeof current === "number" ? current : 0;
      const nextQty = Math.max(0, currentQty + delta);
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[variantId];
        return copy;
      }
      return { ...prev, [variantId]: nextQty };
    });
  }

  function setVariantSelectionQtyDirect(variantId: string, val: string) {
    setVariantSelections(prev => {
      if (val === "") return { ...prev, [variantId]: "" };
      const num = parseInt(val);
      if (isNaN(num) || num <= 0) {
        const copy = { ...prev };
        delete copy[variantId];
        return copy;
      }
      return { ...prev, [variantId]: num };
    });
  }

  const totalVariantSelected = Object.values(variantSelections).reduce((s, qty) => s + (typeof qty === "number" ? qty : 0), 0);

  function addToCart() {
    const newItems: Omit<CartItem, "price">[] = [];
    const hasSauce = selectedProduct.id.toLowerCase().includes("churros");

    for (const [variantId, qty] of Object.entries(variantSelections)) {
      if (typeof qty !== "number" || qty <= 0) continue;
      const variant = variants.find(v => v.id === variantId);
      newItems.push({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        variantId,
        variantName: variant?.name ?? variantId,
        qty: qty,
        sauceId: undefined,
        sauceName: undefined,
        freeSauceAllowance: (variant && typeof variant.freeSauceAllowance === "number") 
          ? variant.freeSauceAllowance 
          : (selectedProduct.freeSauceAllowance ?? 0),
      });
    }

    onAddToCart(newItems);
  }

  return (
    <BottomSheet 
      isOpen={true} 
      onClose={onClose} 
      title={selectedProduct.name}
    >
      <div className="flex flex-col gap-3">
        {variants.map(v => {
          const qty = variantSelections[v.id] ?? 0;
          const stockId = `${selectedProduct.id}_${v.id}`;
          const stockItem = productStocks.find(s => s.id === stockId);
          const currentStock = stockItem ? stockItem.currentStock : 0;
          const minStock = stockItem ? stockItem.minStock : v.minStock;
          const isLowStock = currentStock < minStock;

          return (
            <div key={v.id} className={`flex flex-col gap-2 p-3 rounded-xl border ${qty !== 0 ? "bg-primary/10 border-primary/50" : "bg-brand-50 border-slate-100"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{v.name}</p>
                  <p className={`text-xs mt-0.5 ${isLowStock ? "text-red-600" : "text-slate-400"}`}>Stok: {currentStock} pcs {isLowStock ? "⚠ Rendah" : ""}</p>
                </div>
                
                <div className="flex items-center gap-1.5">
                  {qty !== 0 ? (
                    <>
                      <button onClick={() => updateVariantSelectionQty(v.id, -1)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"><Minus size={13} className="text-slate-500" /></button>
                      <input type="number" value={qty} placeholder="0" onChange={e => setVariantSelectionQtyDirect(v.id, e.target.value)}
                        onBlur={() => { if (qty === "") setVariantSelectionQtyDirect(v.id, "0"); }}
                        className="w-14 h-7 rounded-lg border border-slate-200 text-center text-sm font-bold outline-none no-spinners" />
                      <button onClick={() => updateVariantSelectionQty(v.id, 1)} className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center"><Plus size={13} className="text-white" strokeWidth={2.5} /></button>
                      <button onClick={() => updateVariantSelectionQty(v.id, typeof qty === "number" ? -qty : 0)} className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center ml-1"><Trash2 size={13} className="text-red-600" /></button>
                    </>
                  ) : (
                    <button onClick={() => updateVariantSelectionQty(v.id, 1)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold flex items-center gap-1"><Plus size={13} strokeWidth={2.5} /> Tambah</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalVariantSelected > 0 ? (
        <button onClick={addToCart} className="w-full mt-4 p-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors">
          Tambah ke Cart ({totalVariantSelected} item)
        </button>
      ) : (
        <p className="text-center mt-4 text-xs text-slate-400">Pilih varian untuk ditambah ke cart</p>
      )}
    </BottomSheet>
  );
}
