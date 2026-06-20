"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [packSize, setPackSize] = useState(12);
  const [price, setPrice] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    router.push("/inventory");
  };

  return (
    <>
      <Header title="Produk Baru" back />
      <PageWrapper>
        <Card className="mb-6 p-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-stone-700">Nama Produk</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="contoh: Churros Pack"
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
          </div>
        </Card>

        <Button
          size="lg"
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSave}
          disabled={!name || loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Tambah Produk"}
        </Button>
      </PageWrapper>
    </>
  );
}
