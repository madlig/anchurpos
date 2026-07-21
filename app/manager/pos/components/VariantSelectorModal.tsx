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
  const [variantSelections, setVariantSelections] = useState<Record<string, { id: string; qty: number | ""; sauceId: string }[]>>({});

  const filteredAddOns = useMemo(() => {
    return addOns.filter(a => !a.channels?.length || a.channels.includes(orderChannel));
  }, [addOns, orderChannel]);

  const defaultSauce = useMemo(() => {
    if (!filteredAddOns.length) return null;
    const tiramisu = filteredAddOns.find(a => a.name.toLowerCase().includes("tiramisu") || a.id === "saus-tiramisu");
    if (tiramisu) return tiramisu;
    return filteredAddOns[0];
  }, [filteredAddOns]);

  function addVariantSelectionRow(variantId: string, initialQty: number = 1) {
    const newRowId = Math.random().toString(36).substr(2, 9);
    const defSauce = defaultSauce?.id || (addOns[0]?.id ?? "");
    setVariantSelections(prev => {
      const currentRows = prev[variantId] || [];
      return { ...prev, [variantId]: [...currentRows, { id: newRowId, qty: initialQty, sauceId: defSauce }] };
    });
  }

  function updateVariantSelectionQty(variantId: string, rowId: string, delta: number) {
    setVariantSelections(prev => {
      const currentRows = prev[variantId] || [];
      const newRows = currentRows.map(r => {
        const currentQty = typeof r.qty === "number" ? r.qty : 1;
        return { ...r, qty: Math.max(1, currentQty + delta) };
      });
      return { ...prev, [variantId]: newRows };
    });
  }

  function setVariantSelectionQtyDirect(variantId: string, rowId: string, val: string) {
    setVariantSelections(prev => {
      const currentRows = prev[variantId] || [];
      const newRows: { id: string; qty: number | ""; sauceId: string }[] = currentRows.map(r => {
        if (r.id !== rowId) return r;
        if (val === "") return { ...r, qty: "" };
        return { ...r, qty: Math.max(1, parseInt(val) || 1) };
      });
      return { ...prev, [variantId]: newRows };
    });
  }

  function removeVariantSelectionRow(variantId: string, rowId: string) {
    setVariantSelections(prev => {
      const currentRows = prev[variantId] || [];
      const newRows = currentRows.filter(r => r.id !== rowId);
      return { ...prev, [variantId]: newRows };
    });
  }

  function updateVariantSelectionSauce(variantId: string, rowId: string, newSauceId: string) {
    setVariantSelections(prev => {
      const currentRows = prev[variantId] || [];
      const newRows = currentRows.map(r => r.id === rowId ? { ...r, sauceId: newSauceId } : r);
      return { ...prev, [variantId]: newRows };
    });
  }

  const totalVariantSelected = Object.values(variantSelections).flatMap(r => r).reduce((s, r) => s + (typeof r.qty === "number" ? r.qty : 0), 0);

  function addToCart() {
    const newItems: Omit<CartItem, "price">[] = [];
    const hasSauce = selectedProduct.id.toLowerCase().includes("churros");

    for (const [variantId, rows] of Object.entries(variantSelections)) {
      const variant = variants.find(v => v.id === variantId);
      for (const row of rows) {
        if (typeof row.qty !== "number" || row.qty <= 0) continue;
        const sId = hasSauce ? row.sauceId : undefined;
        const sName = sId ? (addOns.find(a => a.id === sId)?.name || sId) : undefined;

        newItems.push({
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          variantId,
          variantName: variant?.name ?? variantId,
          qty: row.qty,
          sauceId: sId,
          sauceName: sName,
        });
      }
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
          const rows = variantSelections[v.id] || [];
          const qty = rows.reduce((s, r) => s + (typeof r.qty === "number" ? r.qty : 0), 0);
          const stockId = `${selectedProduct.id}_${v.id}`;
          const stockItem = productStocks.find(s => s.id === stockId);
          const currentStock = stockItem ? stockItem.currentStock : 0;
          const minStock = stockItem ? stockItem.minStock : v.minStock;
          const isLowStock = currentStock < minStock;
          const hasSauce = selectedProduct.id.toLowerCase().includes("churros") || (selectedProduct.name || "").toLowerCase().includes("churros");

          return (
            <div key={v.id} className={`flex flex-col gap-2 p-3 rounded-xl border ${qty > 0 ? "bg-primary/10 border-primary/50" : "bg-brand-50 border-slate-100"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{v.name}</p>
                  <p className={`text-xs mt-0.5 ${isLowStock ? "text-red-600" : "text-slate-400"}`}>Stok: {currentStock} pcs {isLowStock ? "⚠ Rendah" : ""}</p>
                </div>
                
                {(!hasSauce || rows.length === 0) && (
                  <div className="flex items-center gap-1.5">
                    {qty > 0 ? (
                      <>
                        <button onClick={() => { if (rows.length > 0) updateVariantSelectionQty(v.id, rows[0].id, -1); }} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"><Minus size={13} className="text-slate-500" /></button>
                        <input type="number" value={qty} placeholder="0" onChange={e => {
                          if (rows.length > 0) setVariantSelectionQtyDirect(v.id, rows[0].id, e.target.value);
                          else if (parseInt(e.target.value) > 0) addVariantSelectionRow(v.id, parseInt(e.target.value));
                        }} className="w-14 h-7 rounded-lg border border-slate-200 text-center text-sm font-bold outline-none" />
                        <button onClick={() => { if (rows.length > 0) updateVariantSelectionQty(v.id, rows[0].id, 1); else addVariantSelectionRow(v.id, 1); }} className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center"><Plus size={13} className="text-white" strokeWidth={2.5} /></button>
                        <button onClick={() => { if (rows.length > 0) removeVariantSelectionRow(v.id, rows[0].id); }} className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center ml-1"><Trash2 size={13} className="text-red-600" /></button>
                      </>
                    ) : (
                      <button onClick={() => addVariantSelectionRow(v.id, 1)} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold flex items-center gap-1"><Plus size={13} strokeWidth={2.5} /> Tambah</button>
                    )}
                  </div>
                )}

                {hasSauce && rows.length > 0 && <div className="text-sm font-bold text-primary">Total: {qty}</div>}
              </div>

              {hasSauce && rows.length > 0 && (
                <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-pink-200 border-dashed">
                  {rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-primary/20">
                      <select value={row.sauceId} onChange={e => updateVariantSelectionSauce(v.id, row.id, e.target.value)} className="flex-1 mr-2 px-2 py-1 rounded-lg border border-primary/50 text-xs outline-none bg-white cursor-pointer">
                        {addOns.map(addon => <option key={addon.id} value={addon.id}>{addon.name}</option>)}
                      </select>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateVariantSelectionQty(v.id, row.id, -1)} className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center"><Minus size={11} className="text-slate-500" /></button>
                        <input type="number" value={row.qty} placeholder="0" onChange={e => setVariantSelectionQtyDirect(v.id, row.id, e.target.value)} className="w-10 h-6 rounded-md border border-slate-200 text-center text-[12px] font-bold outline-none" />
                        <button onClick={() => updateVariantSelectionQty(v.id, row.id, 1)} className="w-6 h-6 rounded-md bg-primary flex items-center justify-center"><Plus size={11} className="text-white" strokeWidth={2.5} /></button>
                        <button onClick={() => removeVariantSelectionRow(v.id, row.id)} className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center ml-1"><Trash2 size={13} className="text-red-600" /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => addVariantSelectionRow(v.id, 1)} className="mt-1 py-1.5 text-xs font-semibold text-primary bg-transparent border border-dashed border-primary/50 rounded-lg w-full text-center">+ Tambah Kombinasi Saus</button>
                </div>
              )}
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
