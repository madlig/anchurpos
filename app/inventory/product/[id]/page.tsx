"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { products } from "@/lib/mock-data";
import { formatRupiah } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const product = products.find((p) => p.id === id);
  if (!product) notFound();

  const [name, setName] = useState(product.name);
  const [packSize, setPackSize] = useState(product.packSize);
  const [price, setPrice] = useState(product.price);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    router.push("/inventory");
  };

  return (
    <>
      <Header title="Edit Produk" back />
      <PageWrapper>
        <Card className="mb-6 p-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-stone-700">Nama Produk</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-stone-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-stone-700">Isi per pack (pcs)</Label>
              <Input
                type="number"
                value={packSize}
                onChange={(e) => setPackSize(Number(e.target.value))}
                className="font-mono border-stone-200"
              />
            </div>
            <div className="border-t border-stone-100" />
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-stone-700">Harga jual</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">Rp</span>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="pl-9 font-mono border-stone-200"
                />
              </div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <p className="text-xs text-stone-500 mb-1">HPP rata-rata (readonly)</p>
              <p className="font-mono font-semibold text-stone-900">{formatRupiah(product.avgCost)}</p>
            </div>
          </div>
        </Card>

        <Button
          size="lg"
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Simpan Perubahan"}
        </Button>
      </PageWrapper>
    </>
  );
}
