"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { materials as allMaterials, recipe } from "@/lib/mock-data";
import { formatRupiah } from "@/lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";

type Ingredients = Record<string, number>;

export default function NewBatchPage() {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredients>(
    Object.fromEntries(Object.entries(recipe.ingredients).map(([k, v]) => [k, v]))
  );
  const [packCount, setPackCount] = useState(recipe.outputPack);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const totalCost = useMemo(() => {
    return allMaterials.reduce((sum, m) => {
      const qty = ingredients[m.id] ?? 0;
      return sum + qty * m.costPerUnit;
    }, 0);
  }, [ingredients]);

  const costPerPack = packCount > 0 ? totalCost / packCount : 0;

  const stockErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    allMaterials.forEach((m) => {
      const qty = ingredients[m.id] ?? 0;
      if (qty > m.stock) errors[m.id] = `Stok hanya ${m.stock} ${m.unit}`;
    });
    return errors;
  }, [ingredients]);

  const hasError = Object.keys(stockErrors).length > 0 || packCount <= 0;
  const warnPackCount = packCount > 24;

  const handleSave = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    router.push("/production");
  };

  return (
    <>
      <Header title="Batch Baru" back />
      <PageWrapper>
        {/* Ingredients */}
        <Card className="mb-4 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Bahan Baku</p>
          <div className="space-y-3">
            {allMaterials.filter((m) => m.isDefault).map((m) => (
              <div key={m.id}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900">{m.name}</p>
                    <p className="text-xs text-stone-500">Stok: {m.stock} {m.unit} · {formatRupiah(m.costPerUnit)}/{m.unit}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min={0}
                      value={ingredients[m.id] ?? ""}
                      onChange={(e) => setIngredients((prev) => ({ ...prev, [m.id]: Number(e.target.value) }))}
                      className={`w-24 text-right font-mono border-stone-200 ${stockErrors[m.id] ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                    />
                    <span className="text-sm text-stone-500 w-6">{m.unit}</span>
                  </div>
                </div>
                {stockErrors[m.id] && (
                  <p className="text-xs text-red-600 mt-1">{stockErrors[m.id]}</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Pack count */}
        <Card className="mb-4 p-4">
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm font-medium text-stone-900">Jumlah Pack Output</p>
            <Input
              type="number"
              min={1}
              value={packCount}
              onChange={(e) => setPackCount(Number(e.target.value))}
              className={`w-24 text-right font-mono border-stone-200 ${packCount <= 0 ? "border-red-400" : ""}`}
            />
            <span className="text-sm text-stone-500">pack</span>
          </div>
          {packCount <= 0 && <p className="text-xs text-red-600 mt-2">Jumlah pack harus lebih dari 0</p>}
          {warnPackCount && (
            <div className="mt-2 flex items-center gap-1.5 text-amber-600">
              <AlertTriangle size={14} />
              <p className="text-xs">Jumlah pack melebihi 24, pastikan benar</p>
            </div>
          )}
        </Card>

        {/* Dark cost summary */}
        <div className="rounded-2xl bg-stone-900 text-white p-5 mb-6">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Total biaya bahan</span>
              <span className="font-mono">{formatRupiah(Math.round(totalCost))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Jumlah pack</span>
              <span className="font-mono">{packCount} pack</span>
            </div>
          </div>
          <div className="border-t border-white/10 my-3" />
          <div className="flex items-end justify-between">
            <span className="text-emerald-300 text-sm font-medium">HPP per pack</span>
            <span className="font-mono text-2xl font-bold text-emerald-300">{formatRupiah(Math.round(costPerPack))}</span>
          </div>
        </div>

        <Button
          size="lg"
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          disabled={hasError || loading}
          onClick={() => warnPackCount ? setConfirmOpen(true) : handleSave()}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Simpan Batch"}
        </Button>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Konfirmasi Jumlah Pack"
          description={`Jumlah ${packCount} pack lebih dari biasanya. Lanjutkan?`}
          confirmLabel="Ya, Simpan"
          onConfirm={handleSave}
        />
      </PageWrapper>
    </>
  );
}
