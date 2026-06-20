"use client";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Factory, ChevronRight } from "lucide-react";
import { productions, products } from "@/lib/mock-data";
import { formatRupiah, formatRupiahCompact } from "@/lib/utils";

function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}

export default function ProductionListPage() {
  const today = startOfDay(new Date());
  const sorted = [...productions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const todayPacks = productions
    .filter(p => startOfDay(new Date(p.date)).getTime() === today.getTime())
    .reduce((s, p) => s + p.packCount, 0);

  // Group by day
  const grouped = new Map<string, typeof productions>();
  sorted.forEach(p => {
    const key = startOfDay(new Date(p.date)).toISOString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  });

  const formatTime = (d: Date) => new Date(d).toTimeString().slice(0, 5);
  const formatDateShort = (d: Date) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

  return (
    <>
      <Header
        title="Produksi"
        subtitle="Riwayat batch"
        action={
          <Link href="/production/new">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1">
              <Plus size={16} /> Batch
            </Button>
          </Link>
        }
      />
      <PageWrapper>
        {/* Mobile today summary */}
        <div className="mt-1 lg:hidden">
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Hari ini</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-mono text-2xl font-bold text-stone-900">{todayPacks}</span>
              <span className="text-sm text-stone-600">pack diproduksi</span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">HPP rata-rata {formatRupiah(9420)}/pack</p>
          </Card>
        </div>

        {/* Desktop header */}
        <div className="hidden lg:flex items-baseline justify-between pt-6 pb-4 px-0">
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Produksi</h2>
            <p className="text-sm text-stone-500">Riwayat batch & kalkulasi HPP</p>
          </div>
          <Link href="/production/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1"><Plus size={16} /> Batch baru</Button>
          </Link>
        </div>

        {/* Desktop KPI */}
        <div className="hidden lg:grid grid-cols-3 gap-4 mb-5">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">Pack hari ini</p>
            <p className="font-mono text-3xl font-bold text-stone-900 mt-1">{todayPacks}</p>
            <p className="text-xs text-stone-500">dari batch hari ini</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">HPP rata-rata</p>
            <p className="font-mono text-3xl font-bold text-stone-900 mt-1">{formatRupiah(9420)}</p>
            <p className="text-xs text-emerald-600">stabil minggu ini</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">Pack siap jual</p>
            <p className="font-mono text-3xl font-bold text-emerald-700 mt-1">{products[0].stock}</p>
            <p className="text-xs text-stone-500">~3 hari penjualan</p>
          </Card>
        </div>

        {/* Mobile grouped list */}
        <div className="mt-4 space-y-4 lg:hidden">
          {Array.from(grouped.entries()).map(([key, items]) => {
            const date = new Date(key);
            const isToday = date.getTime() === today.getTime();
            return (
              <div key={key}>
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 px-1">
                  {isToday ? "Hari ini" : formatDateShort(date)}
                </div>
                <Card className="divide-y divide-stone-100">
                  {items.map(p => (
                    <Link key={p.id} href={`/production/${p.id}`} className="flex items-center gap-3 p-4 active:bg-stone-50 hover:bg-stone-50 transition-colors">
                      <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                        <Factory size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-stone-900 text-sm">Batch #{p.id.slice(-3)}</span>
                          <span className="text-xs text-stone-500">{formatTime(new Date(p.date))}</span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">{p.packCount} pack · {formatRupiah(p.costPerPack)}/pack</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-semibold text-stone-900">{formatRupiahCompact(p.totalCost)}</p>
                        <ChevronRight size={16} className="text-stone-400 ml-auto mt-1" />
                      </div>
                    </Link>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <Card className="hidden lg:block p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-500 uppercase tracking-wide">
                <th className="text-left py-2 font-semibold">Batch</th>
                <th className="text-left font-semibold">Tanggal</th>
                <th className="text-right font-semibold">Pack</th>
                <th className="text-right font-semibold">Total Cost</th>
                <th className="text-right font-semibold">HPP/pack</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sorted.map(p => (
                <tr key={p.id} className="hover:bg-stone-50 cursor-pointer">
                  <td className="py-2.5 font-mono text-xs text-stone-700">{p.id.toUpperCase()}</td>
                  <td className="text-stone-700">{formatDateShort(new Date(p.date))} · {formatTime(new Date(p.date))}</td>
                  <td className="text-right font-mono">{p.packCount}</td>
                  <td className="text-right font-mono">{formatRupiah(p.totalCost)}</td>
                  <td className="text-right font-mono font-semibold text-stone-900">{formatRupiah(p.costPerPack)}</td>
                  <td className="text-right"><ChevronRight size={14} className="text-stone-400 inline" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </PageWrapper>
    </>
  );
}
