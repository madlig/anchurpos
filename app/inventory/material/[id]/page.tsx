"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { materials } from "@/lib/mock-data";
import { formatRupiah } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function AdjustMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const mat = materials.find((m) => m.id === id);
  if (!mat) notFound();

  const [adjustQty, setAdjustQty] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    router.push("/inventory");
  };

  const newStock = mat.stock + adjustQty;

  return (
    <>
      <Header title="Sesuaikan Stok" back />
      <PageWrapper>
        {/* Material info */}
        <Card className="mb-4 p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Nama</span>
              <span className="font-medium text-stone-900">{mat.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Stok saat ini</span>
              <span className="font-mono font-semibold text-stone-900">{mat.stock} {mat.unit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Harga/unit</span>
              <span className="font-mono text-stone-900">{formatRupiah(mat.costPerUnit)}/{mat.unit}</span>
            </div>
          </div>
        </Card>

        {/* Adjust input */}
        <Card className="mb-6 p-4">
          <p className="text-sm font-medium text-stone-700 mb-3">Tambah / Kurangi Stok</p>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(Number(e.target.value))}
              className="font-mono text-center text-lg border-stone-200"
              placeholder="0"
            />
            <span className="text-stone-500">{mat.unit}</span>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Gunakan angka negatif untuk mengurangi.
          </p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
            <span className="text-sm text-stone-500">Stok baru</span>
            <span className={`font-mono font-semibold text-sm ${newStock < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {newStock} {mat.unit}
            </span>
          </div>
          {newStock < 0 && <p className="text-xs text-red-600 mt-1">Stok tidak bisa negatif</p>}
        </Card>

        <Button
          size="lg"
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSave}
          disabled={loading || newStock < 0}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Simpan Perubahan"}
        </Button>
      </PageWrapper>
    </>
  );
}
