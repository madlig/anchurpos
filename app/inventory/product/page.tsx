"use client";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, ChevronRight } from "lucide-react";
import { products } from "@/lib/mock-data";
import { formatRupiah } from "@/lib/utils";

export default function ProductsListPage() {
  return (
    <>
      <Header
        title="Produk"
        action={
          <Link href="/inventory/product/new">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1">
              <Plus size={14} /> Produk
            </Button>
          </Link>
        }
      />
      <PageWrapper>
        <div className="space-y-3">
          {products.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl shrink-0">🥨</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-stone-900">{p.name}</p>
                    {!p.isActive && <Badge variant="default" className="text-[10px]">Non-aktif</Badge>}
                  </div>
                  <p className="text-xs text-stone-500">{p.packSize} pcs / pack</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-stone-400">Harga</p>
                      <p className="font-mono font-semibold text-stone-900">{formatRupiah(p.price)}</p>
                    </div>
                    <div>
                      <p className="text-stone-400">HPP</p>
                      <p className="font-mono font-semibold text-stone-900">{formatRupiah(p.avgCost)}</p>
                    </div>
                    <div>
                      <p className="text-stone-400">Stok</p>
                      <p className="font-mono font-semibold text-emerald-700">{p.stock}</p>
                    </div>
                  </div>
                </div>
                <Link href={`/inventory/product/${p.id}`}>
                  <button className="h-9 w-9 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center hover:bg-stone-200">
                    <Edit size={16} />
                  </button>
                </Link>
              </div>
            </Card>
          ))}

          <Link href="/inventory/product/new">
            <Button variant="outline" size="lg" className="w-full border-stone-200 gap-2">
              <Plus size={18} /> Tambah produk
            </Button>
          </Link>
        </div>
      </PageWrapper>
    </>
  );
}
