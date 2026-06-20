"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { materials, recipe } from "@/lib/mock-data";
import { formatRupiah } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function EditRecipePage() {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Record<string, number>>(recipe.ingredients);
  const [outputPack, setOutputPack] = useState(recipe.outputPack);
  const [loading, setLoading] = useState(false);

  const totalCost = materials.reduce((sum, m) => {
    return sum + (ingredients[m.id] ?? 0) * m.costPerUnit;
  }, 0);
  const costPerPack = outputPack > 0 ? totalCost / outputPack : 0;

  const handleSave = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    router.push("/inventory");
  };

  return (
    <>
      <Header title="Edit Resep Default" back />
      <PageWrapper>
        <Card className="mb-4 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Bahan per batch</p>
          <div className="space-y-3">
            {materials.filter((m) => m.isDefault).map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900">{m.name}</p>
                  <p className="text-xs text-stone-500">{formatRupiah(m.costPerUnit)}/{m.unit}</p>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={ingredients[m.id] ?? 0}
                  onChange={(e) => setIngredients((prev) => ({ ...prev, [m.id]: Number(e.target.value) }))}
                  className="w-24 text-right font-mono border-stone-200"
                />
                <span className="text-sm text-stone-500 w-6 shrink-0">{m.unit}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="mb-4 p-4">
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm font-medium text-stone-900">Output default (pack)</p>
            <Input
              type="number"
              min={1}
              value={outputPack}
              onChange={(e) => setOutputPack(Number(e.target.value))}
              className="w-24 text-right font-mono border-stone-200"
            />
          </div>
        </Card>

        {/* Dark HPP preview */}
        <div className="rounded-2xl bg-stone-900 text-white p-5 mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-stone-400">Total biaya bahan</span>
            <span className="font-mono">{formatRupiah(Math.round(totalCost))}</span>
          </div>
          <div className="border-t border-white/10 my-3" />
          <div className="flex items-end justify-between">
            <span className="text-emerald-300 text-sm font-medium">Estimasi HPP/pack</span>
            <span className="font-mono text-2xl font-bold text-emerald-300">{formatRupiah(Math.round(costPerPack))}</span>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Simpan Resep"}
        </Button>
      </PageWrapper>
    </>
  );
}
