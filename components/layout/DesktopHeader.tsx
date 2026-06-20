"use client";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

const routeLabels: Record<string, string> = {
  "/": "Beranda",
  "/production": "Produksi",
  "/pos": "Kasir",
  "/inventory": "Inventori",
  "/reports": "Laporan",
};

export function DesktopHeader() {
  const pathname = usePathname();
  const label = Object.entries(routeLabels).find(([k]) => k === pathname || (k !== "/" && pathname.startsWith(k)))?.[1] ?? "AnchurPOS";

  return (
    <header className="h-14 bg-white border-b border-stone-200 px-6 flex items-center gap-4 shrink-0 sticky top-0 z-20">
      <h1 className="text-sm font-semibold text-stone-900">{label}</h1>
      <div className="flex-1" />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <input
          placeholder="Cari transaksi, bahan…"
          className="h-9 w-72 rounded-lg border border-stone-200 pl-9 pr-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-white"
        />
      </div>
      <Link href="/pos">
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
          <Plus className="h-4 w-4" /> Transaksi
        </Button>
      </Link>
    </header>
  );
}
