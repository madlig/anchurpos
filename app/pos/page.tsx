"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { StepperInput } from "@/components/shared/StepperInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { products, transactions } from "@/lib/mock-data";
import { formatRupiah, formatRupiahCompact, formatShortDate } from "@/lib/utils";
import { Wallet, AlertTriangle } from "lucide-react";

export default function POSPage() {
  const router = useRouter();
  const product = products[0];
  const [qty, setQty] = useState(1);

  const totalPrice = qty * product.price;
  const totalCost = qty * product.avgCost;
  const profit = totalPrice - totalCost;
  const stockOk = qty <= product.stock;

  const handleCharge = () => {
    const params = new URLSearchParams({
      qty: qty.toString(),
      totalPrice: totalPrice.toString(),
      totalCost: totalCost.toString(),
      profit: profit.toString(),
    });
    router.push(`/pos/confirm?${params}`);
  };

  const todayTx = transactions.filter(t => !t.voided).slice(0, 4);

  return (
    <>
      <Header title="Kasir" subtitle="Tap untuk jualan cepat" />

      {/* Mobile layout */}
      <div className="lg:hidden px-5 pb-36 space-y-4">
        {/* Product card */}
        <Card className="overflow-hidden">
          <div className="h-36 bg-gradient-to-br from-amber-100 via-orange-100 to-amber-50 relative flex items-center justify-center">
            <div className="text-7xl">🥨</div>
            <Badge variant="success" className="absolute top-3 left-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" /> Stok {product.stock}
            </Badge>
          </div>
          <div className="p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Best Seller</p>
                <h2 className="text-lg font-bold text-stone-900 mt-0.5">{product.name}</h2>
                <p className="text-xs text-stone-500 mt-0.5">{product.packSize} pcs / pack</p>
              </div>
              <div className="font-mono text-xl font-bold text-stone-900">{formatRupiah(product.price)}</div>
            </div>
          </div>
        </Card>

        {/* Qty stepper */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Jumlah</p>
            <p className="text-xs text-stone-400 mt-0.5">Maks {product.stock} pack</p>
          </div>
          <StepperInput value={qty} onChange={setQty} min={1} max={product.stock} />
        </div>

        {/* Dark price preview */}
        <div className="rounded-2xl bg-stone-900 text-white p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-400">Subtotal ({qty}×)</span>
            <span className="font-mono">{formatRupiah(totalPrice)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1.5">
            <span className="text-stone-400">HPP</span>
            <span className="font-mono text-stone-300">{formatRupiah(totalCost)}</span>
          </div>
          <div className="border-t border-white/10 my-3" />
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-stone-400">Total dibayar</p>
              <p className="font-mono text-3xl font-bold mt-0.5">{formatRupiah(totalPrice)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-400">Profit</p>
              <p className="font-mono text-base font-semibold text-emerald-400">+{formatRupiahCompact(profit)}</p>
            </div>
          </div>
        </div>

        {!stockOk && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            <AlertTriangle size={14} /> Stok tidak cukup
          </div>
        )}
      </div>

      {/* Mobile charge button */}
      <div className="lg:hidden fixed bottom-20 inset-x-0 px-5 pb-2 z-20">
        <Button
          size="xl"
          className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 gap-2"
          onClick={handleCharge}
          disabled={!stockOk}
        >
          <Wallet size={20} />
          Charge · {formatRupiah(totalPrice)}
        </Button>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:grid p-6 grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Produk aktif</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <button className="aspect-square rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-emerald-500 p-4 flex flex-col text-left ring-4 ring-emerald-500/10">
                <div className="text-5xl">🥨</div>
                <div className="mt-auto">
                  <p className="text-xs font-semibold text-stone-900">Churros Pack</p>
                  <p className="font-mono text-sm font-bold text-emerald-700">{formatRupiah(product.price)}</p>
                  <p className="text-xs text-stone-500">stok {product.stock}</p>
                </div>
              </button>
              <button className="aspect-square rounded-2xl bg-stone-100 border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-500">
                <span className="text-3xl font-light">+</span>
                <span className="text-xs font-medium mt-1">Produk baru</span>
              </button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-stone-900 mb-3">Transaksi hari ini ({todayTx.length})</h3>
            <div className="space-y-2">
              {todayTx.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-stone-50">
                  <div className="h-9 w-9 rounded-lg bg-white text-stone-600 flex items-center justify-center font-mono text-xs font-bold">{t.qty}×</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-900">Churros Pack</p>
                    <p className="text-xs text-stone-500">{formatShortDate(t.date)} · {t.id}</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-stone-900">{formatRupiah(t.totalPrice)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Order panel */}
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Pesanan</p>
            <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-stone-50">
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">🥨</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-stone-900">Churros Pack</p>
                <p className="text-xs text-stone-500">{formatRupiah(product.price)}/pack</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-stone-500">Jumlah</span>
              <StepperInput value={qty} onChange={setQty} min={1} max={product.stock} />
            </div>
          </Card>

          <div className="rounded-2xl bg-stone-900 text-white p-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-400">Subtotal</span>
                <span className="font-mono">{formatRupiah(totalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">HPP</span>
                <span className="font-mono text-stone-300">{formatRupiah(totalCost)}</span>
              </div>
            </div>
            <div className="border-t border-white/10 my-3" />
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-stone-400">Total</p>
                <p className="font-mono text-3xl font-bold">{formatRupiah(totalPrice)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-emerald-400">Profit</p>
                <p className="font-mono font-bold text-emerald-400">+{formatRupiahCompact(profit)}</p>
              </div>
            </div>
          </div>

          <Button size="xl" className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={handleCharge} disabled={!stockOk}>
            <Wallet size={20} /> Charge {formatRupiah(totalPrice)}
          </Button>
        </div>
      </div>
    </>
  );
}
