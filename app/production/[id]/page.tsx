import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { productions, materials } from "@/lib/mock-data";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Factory } from "lucide-react";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = productions.find((p) => p.id === id);
  if (!batch) notFound();

  const materialMap = Object.fromEntries(materials.map((m) => [m.id, m]));

  return (
    <>
      <Header title="Detail Batch" back />
      <PageWrapper>
        {/* Summary card */}
        <Card className="mb-4 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Factory size={22} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg text-stone-900">{batch.packCount} Pack Diproduksi</p>
              <p className="text-sm text-stone-500">{formatDate(batch.date)}</p>
            </div>
            <Badge variant="success">{batch.outputQty} pcs</Badge>
          </div>
          <div className="border-t border-stone-100 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Total Biaya</span>
              <span className="font-mono font-medium text-stone-900">{formatRupiah(batch.totalCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">HPP per Pack</span>
              <span className="font-mono font-semibold text-emerald-700">{formatRupiah(batch.costPerPack)}</span>
            </div>
          </div>
        </Card>

        {/* Ingredients */}
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Bahan yang Digunakan</p>
          <div className="space-y-2">
            {Object.entries(batch.ingredients).map(([matId, qty]) => {
              const mat = materialMap[matId];
              if (!mat) return null;
              const cost = qty * mat.costPerUnit;
              return (
                <div key={matId} className="flex justify-between text-sm">
                  <div>
                    <span className="text-stone-900">{mat.name}</span>
                    <span className="text-stone-500 ml-2">{qty} {mat.unit}</span>
                  </div>
                  <span className="font-mono text-stone-500">{formatRupiah(cost)}</span>
                </div>
              );
            })}
            <div className="border-t border-stone-100 pt-2 flex justify-between font-semibold text-sm">
              <span className="text-stone-900">Total</span>
              <span className="font-mono text-stone-900">{formatRupiah(batch.totalCost)}</span>
            </div>
          </div>
        </Card>
      </PageWrapper>
    </>
  );
}
