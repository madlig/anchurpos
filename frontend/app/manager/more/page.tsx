"use client";

import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import {
  Users,
  Settings,
  Database,
  ChevronRight,
  LogOut,
  ClipboardList,
  Palette,
  Scale,
  PackageMinus,
} from "lucide-react";

const MENU_ITEMS = [
  {
    label: "Master Data",
    description: "Produk, varian, bahan, resep",
    href: "/manager/master-data",
    icon: Database,
  },
  {
    label: "Karyawan",
    description: "Absensi & payroll",
    href: "/manager/employees",
    icon: Users,
  },
  {
    label: "Riwayat Order",
    description: "Daftar semua pesanan",
    href: "/manager/orders",
    icon: ClipboardList,
  },
  {
    label: "Rainbow Assembly",
    description: "Konfirmasi assembly Rainbow",
    href: "/manager/rainbow-assembly",
    icon: Palette,
  },
  {
    label: "Review Stock Opname",
    description: "Review & koreksi stok dari opname crew",
    href: "/manager/stock-opname-review",
    icon: Scale,
  },
  {
    label: "Pengeluaran Stok",
    description: "Sample, hadiah, rusak, konsumsi internal",
    href: "/manager/stock-adjustments",
    icon: PackageMinus,
  },
  {
    label: "Pengaturan",
    description: "Whitelist IP absen",
    href: "/manager/settings",
    icon: Settings,
  },
];

export default function ManagerMorePage() {
  const { user, logout } = useAuth();

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Lainnya</h1>
          <p className="text-sm text-stone-500">
            {user?.displayName ?? "Manager"}
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="p-4 flex items-center gap-3 hover:bg-stone-50 transition-colors">
                <Icon size={20} className="text-emerald-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900">
                    {item.label}
                  </p>
                  <p className="text-xs text-stone-500">{item.description}</p>
                </div>
                <ChevronRight size={16} className="text-stone-400" />
              </Card>
            </Link>
          );
        })}
      </div>

      <button
        onClick={logout}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-red-600 transition-colors px-1"
      >
        <LogOut size={16} />
        Keluar
      </button>
    </div>
  );
}
