"use client";

import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import {
  Users,
  Database,
  Settings,
  ChevronRight,
  LogOut,
  FileBarChart,
  Scale,
  ClipboardList,
} from "lucide-react";

const MENU_ITEMS = [
  {
    label: "Master Data",
    description: "Produk, varian, bahan, resep",
    href: "/manager/master-data",
    icon: Database,
  },
  {
    label: "Karyawan & Payroll",
    description: "Data karyawan, absensi, gaji",
    href: "/manager/employees",
    icon: Users,
  },
  {
    label: "Riwayat Order",
    description: "Semua pesanan & detail",
    href: "/manager/orders",
    icon: ClipboardList,
  },
  {
    label: "Stock Opname Review",
    description: "Review & koreksi stok",
    href: "/manager/stock-opname-review",
    icon: Scale,
  },
  {
    label: "Laporan Stok",
    description: "Stok bahan & produk saat ini",
    href: "/owner/reports",
    icon: FileBarChart,
  },
  {
    label: "Pengaturan",
    description: "Whitelist IP, konfigurasi",
    href: "/manager/settings",
    icon: Settings,
  },
];

export default function OwnerMorePage() {
  const { user, logout } = useAuth();

  return (
    <div className="p-5">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-stone-900">Lainnya</h1>
        <p className="text-sm text-stone-500">{user?.displayName ?? "Owner"}</p>
      </div>

      <div className="space-y-2 mb-6">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="p-4 flex items-center gap-3 hover:bg-stone-50 transition-colors">
                <Icon size={20} className="text-emerald-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900">{item.label}</p>
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
