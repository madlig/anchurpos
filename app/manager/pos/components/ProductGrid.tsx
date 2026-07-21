import { ShoppingCart, Plus } from "lucide-react";
import type { ProductItem } from "../types";

interface Props {
  products: ProductItem[];
  variantCount: number;
  onAdd: (product: ProductItem) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function startingPrice(product: ProductItem): number {
  if (!product.priceTiers.length) return 0;
  const sorted = [...product.priceTiers].sort((a, b) => a.minQty - b.minQty);
  return sorted[0].price;
}

export function ProductGrid({ products, variantCount, onAdd }: Props) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[14px] text-slate-400">Produk tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} variantCount={variantCount} onAdd={() => onAdd(product)} />
      ))}
    </div>
  );
}

function ProductCard({ product, variantCount, onAdd }: { product: ProductItem; variantCount: number; onAdd: () => void }) {
  const sp = startingPrice(product);
  return (
    <div onClick={onAdd} className="bg-white rounded-[16px] overflow-hidden border border-white/40 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col group relative">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FCABB4] to-[#F9A8D4]" />
      <div className="h-[70px] bg-brand-50 flex items-center justify-center group-hover:bg-primary/10/50 transition-colors">
        <div className="w-[38px] h-[38px] rounded-[12px] bg-white shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 group-hover:border-pink-200 transition-transform duration-300">
          <span className="text-[20px]">🍰</span>
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm font-extrabold text-slate-800 leading-[1.3] line-clamp-2">{product.name}</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1.5">{variantCount} varian</p>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/60">
          <span className="text-[14px] font-black text-[#831843]">{sp > 0 ? fmt(sp) : "—"}</span>
          <button className="w-7 h-7 rounded-[8px] bg-slate-100 text-[#831843] group-hover:bg-[#FCABB4] group-hover:text-[#831843] transition-colors flex items-center justify-center">
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
