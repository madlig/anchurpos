"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function NewMaterialPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<"g" | "ml" | "pcs">("g");
  const [stock, setStock] = useState(0);
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [lowThreshold, setLowThreshold] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    router.push("/inventory");
  };

  return (
    <>
      <Header title="Bahan Baru" back />
      <PageWrapper>
        <Card className="mb-6 p-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-stone-700">Nama Bahan</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="contoh: Tepung Terigu"
                className="border-stone-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-stone-700">Satuan</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as "g" | "ml" | "pcs")}>
                <SelectTrigger className="border-stone-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">gram (g)</SelectItem>
                  <SelectItem value="ml">mililiter (ml)</SelectItem>
                  <SelectItem value="pcs">buah (pcs)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t border-stone-100" />
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-stone-700">Stok Awal</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className="font-mono border-stone-200"
                />
                <span className="text-sm text-stone-500 w-8 shrink-0">{unit}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-stone-700">Harga per {unit}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">Rp</span>
                <Input
                  type="number"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(Number(e.target.value))}
                  className="pl-9 font-mono border-stone-200"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-stone-700">Batas stok rendah</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  value={lowThreshold}
                  onChange={(e) => setLowThreshold(Number(e.target.value))}
                  className="font-mono border-stone-200"
                />
                <span className="text-sm text-stone-500 w-8 shrink-0">{unit}</span>
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
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Tambah Bahan"}
        </Button>
      </PageWrapper>
    </>
  );
}
