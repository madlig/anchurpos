"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";
import { formatRupiah, formatRupiahCompact } from "@/lib/utils";
import { products } from "@/lib/mock-data";

function ConfirmContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const qty = Number(params.get("qty") ?? 1);
  const totalPrice = Number(params.get("totalPrice") ?? 0);
  const totalCost = Number(params.get("totalCost") ?? 0);
  const profit = Number(params.get("profit") ?? 0);
  const product = products[0];

  const handleConfirm = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setConfirmed(true);
    setLoading(false);
    setTimeout(() => router.push("/pos"), 1500);
  };

  if (confirmed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-stone-50">
        <div className="h-24 w-24 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 size={48} className="text-emerald-600" />
        </div>
        <p className="text-xl font-bold text-stone-900">Transaksi Berhasil!</p>
        <p className="font-mono text-2xl font-bold text-stone-900">{formatRupiah(totalPrice)}</p>
        <p className="text-sm text-stone-500">+{formatRupiahCompact(profit)} profit</p>
      </div>
    );
  }

  return (
    <>
      <Header title="Konfirmasi" back />
      <PageWrapper>
        {/* Product row */}
        <Card className="mb-4 p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl shrink-0">🥨</div>
            <div className="flex-1">
              <p className="font-semibold text-stone-900">{product.name}</p>
              <p className="text-sm text-stone-500">{qty} pack × {formatRupiah(product.price)}</p>
            </div>
          </div>
        </Card>

        {/* Dark summary */}
        <div className="rounded-2xl bg-stone-900 text-white p-5 mb-6">
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
              <p className="text-xs text-stone-400">Total dibayar</p>
              <p className="font-mono text-3xl font-bold mt-0.5">{formatRupiah(totalPrice)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-400">Profit</p>
              <p className="font-mono font-semibold text-emerald-400">+{formatRupiahCompact(profit)}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12 border-stone-200" onClick={() => router.back()}>
            Batal
          </Button>
          <Button
            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Konfirmasi"}
          </Button>
        </div>
      </PageWrapper>
    </>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  );
}
