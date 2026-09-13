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
  onAddToCart: (newItems: Omit<CartItem, "price" | "basePrice" | "appliedTier" | "discountPerUnit" | "totalPrice">[]) => void;
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
  const isService = selectedProduct.category === "service";
  const productVariants = useMemo(() => {
    return variants.filter(v => v.productId === selectedProduct.id || (!v.productId && !isService));
  }, [variants, selectedProduct, isService]);

  const [variantSelections, setVariantSelections] = useState<Record<string, number | "">>({});
  const [directQty, setDirectQty] = useState<number | "">(1);

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

  const totalVariantSelected = Object.values(variantSelections).reduce<number>((s, qty) => s + (typeof qty === "number" ? qty : (Number(qty) || 0)), 0);
  const totalItemsSelected = productVariants.length === 0
    ? (typeof directQty === "number" ? directQty : (Number(directQty) || 0))
    : totalVariantSelected;

  function addToCart() {
    if (productVariants.length === 0) {
      const qty = typeof directQty === "number" ? directQty : (Number(directQty) || 0);
      if (qty <= 0) return;
      onAddToCart([{
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        variantId: "none",
        variantName: isService ? "Jasa" : "Tanpa Varian",
        qty,
        sauceId: undefined,
        sauceName: undefined,
        freeSauceAllowance: selectedProduct.freeSauceAllowance ?? 0,
      }]);
      return;
    }

    const newItems: Omit<CartItem, "price" | "basePrice" | "appliedTier" | "discountPerUnit" | "totalPrice">[] = [];

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

  const singlePrice = startingPrice(selectedProduct);

  return (
    <BottomSheet 
      isOpen={true} 
      onClose={onClose} 
      title={selectedProduct.name}
    >
      <div className="flex flex-col gap-3">
        {productVariants.length === 0 ? (
          <div className="p-4 rounded-2xl bg-brand-50 border border-primary/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {isService ? "Jasa / Layanan (Non-Stok)" : "Tanpa Varian"}
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-800">{selectedProduct.name}</p>
                <p className="text-xs font-black text-[#831843] mt-0.5">{singlePrice > 0 ? fmt(singlePrice) : "Rp 0"}</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDirectQty(prev => Math.max(1, (Number(prev) || 1) - 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-600 hover:bg-slate-50"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  value={directQty}
                  onChange={e => {
                    const val = e.target.value;
                    setDirectQty(val === "" ? "" : Math.max(1, parseInt(val) || 1));
                  }}
                  onBlur={() => { if (directQty === "" || Number(directQty) < 1) setDirectQty(1); }}
                  className="w-14 h-8 rounded-lg border border-slate-200 bg-white text-center text-sm font-bold outline-none no-spinners"
                />
                <button
                  type="button"
                  onClick={() => setDirectQty(prev => (Number(prev) || 0) + 1)}
                  className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90"
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {selectedProduct.description && (
              <p className="text-xs text-slate-500">{selectedProduct.description}</p>
            )}
          </div>
        ) : (
          productVariants.map(v => {
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
        }))}
      </div>

      {totalItemsSelected > 0 ? (
        <button onClick={addToCart} className="w-full mt-4 p-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors">
          Tambah ke Cart ({totalItemsSelected} item)
        </button>
      ) : (
        <p className="text-center mt-4 text-xs text-slate-400">
          {productVariants.length === 0 ? "Tentukan jumlah untuk ditambah ke cart" : "Pilih varian untuk ditambah ke cart"}
        </p>
      )}
    </BottomSheet>
  );
}
