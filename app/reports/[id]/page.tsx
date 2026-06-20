"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { transactions, products } from "@/lib/mock-data";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Ban, Loader2 } from "lucide-react";

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const tx = transactions.find((t) => t.id === id);
  if (!tx) notFound();

  const product = products.find((p) => p.id === tx.productId);
  const [voided, setVoided] = useState(tx.voided);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVoid = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setVoided(true);
    setLoading(false);
  };

  return (
    <>
      <Header title="Detail Transaksi" back />
      <PageWrapper>
        <Card className="mb-4 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-base text-stone-900">{product?.name ?? "Produk"}</p>
            {voided
              ? <Badge variant="destructive">Void</Badge>
              : <Badge variant="success">Berhasil</Badge>
            }
          </div>
          <p className="text-xs text-stone-500 mb-4">{formatDate(tx.date)}</p>

          <div className="border-t border-stone-100 pt-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Jumlah</span>
              <span className="text-stone-900">{tx.qty} pack</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Harga/pack</span>
              <span className="font-mono text-stone-900">{formatRupiah(tx.priceEach)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span className="text-stone-500">Total penjualan</span>
              <span className="font-mono text-emerald-700">{formatRupiah(tx.totalPrice)}</span>
            </div>
            <div className="border-t border-stone-100 pt-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">HPP/pack (snapshot)</span>
                <span className="font-mono text-stone-900">{formatRupiah(tx.costEach)}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-stone-500">Total HPP</span>
                <span className="font-mono text-stone-500">{formatRupiah(tx.totalCost)}</span>
              </div>
            </div>
            <div className="border-t border-stone-100 pt-2.5 flex justify-between font-semibold text-sm">
              <span className="text-stone-900">Profit</span>
              <span className="font-mono text-emerald-700">{formatRupiah(tx.profit)}</span>
            </div>
          </div>

          {voided && tx.voidedAt && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              Divoid pada {formatDate(tx.voidedAt)}
            </div>
          )}
        </Card>

        {!voided && (
          <Button
            variant="outline"
            size="lg"
            className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            onClick={() => setConfirmOpen(true)}
            disabled={loading}
          >
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : <><Ban size={16} /> Void Transaksi</>
            }
          </Button>
        )}

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Void Transaksi?"
          description="Stok akan dikembalikan. Aksi ini tidak bisa dibatalkan."
          confirmLabel="Ya, Void"
          destructive
          onConfirm={handleVoid}
        />
      </PageWrapper>
    </>
  );
}
