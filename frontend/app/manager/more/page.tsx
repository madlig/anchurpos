"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import {
  Users, Settings, Database, ChevronRight, LogOut,
  ClipboardList, Palette, Scale, PackageMinus,
} from "lucide-react";

const MENU_ITEMS = [
  { label: "Master Data", description: "Produk, varian, bahan, resep", href: "/manager/master-data", icon: Database },
  { label: "Karyawan", description: "Absensi & payroll", href: "/manager/employees", icon: Users },
  { label: "Riwayat Order", description: "Daftar semua pesanan", href: "/manager/orders", icon: ClipboardList },
  { label: "Rainbow Assembly", description: "Konfirmasi assembly Rainbow", href: "/manager/rainbow-assembly", icon: Palette },
  { label: "Review Stock Opname", description: "Review & koreksi stok dari opname crew", href: "/manager/stock-opname-review", icon: Scale },
  { label: "Pengeluaran Stok", description: "Sample, hadiah, rusak, konsumsi internal", href: "/manager/stock-adjustments", icon: PackageMinus },
  { label: "Pengaturan", description: "Whitelist IP absen", href: "/manager/settings", icon: Settings },
];

export default function ManagerMorePage() {
  const { user, logout } = useAuth();

  return (
    <div className="px-5 pt-6 pb-4 md:px-8 md:pt-8 page-enter">
      {/* Profile mini */}
      <div className="flex items-center gap-3 mb-6 rounded-3xl p-4 max-w-2xl md:max-w-none" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)" }}>
          <span className="text-xl font-black text-white">{(user?.displayName ?? "M")[0].toUpperCase()}</span>
        </div>
        <div>
          <p className="font-bold text-base" style={{ color: "#1C1C1E" }}>{user?.displayName ?? "Manager"}</p>
          <p className="text-xs font-semibold" style={{ color: "#E85D8C" }}>Manager</p>
        </div>
      </div>

      {/* Menu items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} data-testid={`menu-${item.label.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="rounded-2xl p-4 flex items-center gap-3 tap-target" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FEF1F5" }}>
                  <Icon size={18} style={{ color: "#E85D8C" }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>{item.label}</p>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>{item.description}</p>
                </div>
                <ChevronRight size={16} style={{ color: "#CBD5E1" }} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="flex items-center gap-2.5 w-full rounded-2xl p-4 tap-target"
        style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
        data-testid="logout-button"
      >
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "#FEE2E2" }}>
          <LogOut size={18} style={{ color: "#DC2626" }} />
        </div>
        <span className="text-sm font-semibold" style={{ color: "#DC2626" }}>Keluar</span>
      </button>
    </div>
  );
}
