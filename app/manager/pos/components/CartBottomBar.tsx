interface Props {
  cartCount: number;
  cartTotal: number;
  onCheckout: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export function CartBottomBar({ cartCount, cartTotal, onCheckout }: Props) {
  if (cartCount === 0) return null;

  return (
    <div className="fixed left-0 right-0 z-40 bottom-16 px-4 py-2.5 bg-gradient-to-t from-[#FEF1F5] to-transparent">
      <button
        onClick={onCheckout}
        className="w-full flex items-center justify-between p-3.5 rounded-full border-none cursor-pointer"
        style={{
          background: "linear-gradient(135deg, #FCABB4, #F9A8D4)",
          boxShadow: "0 8px 30px rgba(252,171,180,0.6)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold text-pink-900 bg-pink-900/10">
            {cartCount} item
          </span>
          <span className="text-[15px] font-extrabold text-pink-900">{fmt(cartTotal)}</span>
        </div>
        <span className="text-sm font-extrabold text-pink-900">Bayar →</span>
      </button>
    </div>
  );
}
