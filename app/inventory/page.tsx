"use client";
import Link from "next/link";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight, Edit, Sparkles } from "lucide-react";
import { materials, products } from "@/lib/mock-data";
import { formatRupiah, formatRupiahCompact } from "@/lib/utils";

export default function InventoryPage() {
  const [tab, setTab] = useState<"materials" | "products">("materials");

  return (
    <>
      <Header title="Inventori" />
      <PageWrapper>
        {/* Tab switcher */}
        <div className="mt-1 mb-4 bg-stone-100 p-1 rounded-xl flex lg:w-64">
          {(["materials", "products"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}>
              {t === "materials" ? "Bahan" : "Produk"}
            </button>
          ))}
        </div>

        {/* Desktop header */}
        <div className="hidden lg:flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Inventori</h2>
            <p className="text-sm text-stone-500">{materials.length} bahan · {products.length} produk</p>
          </div>
          <div className="flex gap-2">
            <Link href="/inventory/recipe">
              <Button variant="outline" className="gap-1.5 border-stone-200"><Sparkles size={16} /> Edit Resep</Button>
            </Link>
            <Link href="/inventory/material/new">
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1"><Plus size={16} /> Bahan baru</Button>
            </Link>
          </div>
        </div>

        {tab === "materials" && (
          <div className="space-y-4">
            {/* Mobile add button */}
            <div className="lg:hidden">
              <Link href="/inventory/material/new">
                <Button variant="outline" size="lg" className="w-full border-stone-200 gap-2">
                  <Plus size={18} /> Tambah bahan
                </Button>
              </Link>
            </div>

            {/* Mobile list */}
            <Card className="divide-y divide-stone-100 lg:hidden">
              {materials.map(m => {
                const low = m.stock < m.lowStockThreshold;
                const pct = Math.min(100, (m.stock / (m.lowStockThreshold * 4)) * 100);
                return (
                  <Link key={m.id} href={`/inventory/material/${m.id}`}
                    className="flex items-center gap-3 p-3.5 active:bg-stone-50 hover:bg-stone-50 transition-colors">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${low ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-600"}`}>
                      <span className="text-xs font-bold uppercase">{m.unit}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-medium text-stone-900 truncate">{m.name}</p>
                        {low && <Badge variant="warning">Tipis</Badge>}
                      </div>
                      <div className="mt-1.5 h-1 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${low ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-semibold text-stone-900">{m.stock.toLocaleString("id-ID")}</p>
                      <p className="text-xs text-stone-500">{m.unit}</p>
                    </div>
                  </Link>
                );
              })}
            </Card>

            {/* Desktop table */}
            <Card className="hidden lg:block overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50">
                  <tr className="text-xs text-stone-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-semibold">Bahan</th>
                    <th className="text-right font-semibold">Stok</th>
                    <th className="text-right font-semibold">Harga/unit</th>
                    <th className="text-right font-semibold">Min stok</th>
                    <th className="text-left pl-6 font-semibold">Status</th>
                    <th className="px-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {materials.map(m => {
                    const low = m.stock < m.lowStockThreshold;
                    return (
                      <tr key={m.id} className="hover:bg-stone-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${low ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-600"}`}>
                              <span className="text-[10px] font-bold uppercase">{m.unit}</span>
                            </div>
                            <span className="font-medium text-stone-900">{m.name}</span>
                          </div>
                        </td>
                        <td className="text-right font-mono">{m.stock.toLocaleString("id-ID")} {m.unit}</td>
                        <td className="text-right font-mono text-stone-600">{formatRupiah(m.costPerUnit)}</td>
                        <td className="text-right font-mono text-stone-500">{m.lowStockThreshold.toLocaleString("id-ID")} {m.unit}</td>
                        <td className="pl-6">{low ? <Badge variant="warning">Tipis</Badge> : <Badge variant="success">Aman</Badge>}</td>
                        <td className="px-5 text-right">
                          <Link href={`/inventory/material/${m.id}`}>
                            <Edit size={14} className="text-stone-400 inline hover:text-stone-600" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab === "products" && (
          <div className="space-y-3">
            {products.map(p => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl shrink-0">🥨</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-stone-900">{p.name}</p>
                    <p className="text-xs text-stone-500">{p.packSize} pcs / pack</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-stone-400">Harga</p>
                        <p className="font-mono font-semibold text-stone-900">{formatRupiahCompact(p.price)}</p>
                      </div>
                      <div>
                        <p className="text-stone-400">HPP</p>
                        <p className="font-mono font-semibold text-stone-900">{formatRupiahCompact(p.avgCost)}</p>
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

            <Link href="/inventory/recipe" className="block w-full p-4 bg-emerald-50 border border-emerald-200/60 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-emerald-900">Edit resep default</p>
                  <p className="text-xs text-emerald-700">Pre-fill form produksi</p>
                </div>
                <ChevronRight size={18} className="text-emerald-700" />
              </div>
            </Link>
          </div>
        )}
      </PageWrapper>
    </>
  );
}
