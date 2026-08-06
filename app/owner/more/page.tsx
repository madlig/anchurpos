"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import {
  BarChart3, ClipboardList, Package, Users,
  History, Settings, LogOut, ChevronRight,
} from "lucide-react";

const MENU_ITEMS = [
  { label: "Analisis Omzet", description: "Penjualan per channel & metode bayar", href: "/owner/omzet", icon: BarChart3 },
  { label: "Riwayat Order", description: "Semua pesanan & detail transaksi", href: "/owner/orders", icon: ClipboardList },
  { label: "Stok & Bahan", description: "Stok bahan baku & alert menipis", href: "/owner/inventory", icon: Package },
  { label: "Karyawan & Payroll", description: "Data karyawan, absensi, gaji bulan ini", href: "/owner/employees", icon: Users },
  { label: "Buku Stok / Audit", description: "Audit trail pergerakan barang", href: "/owner/stock-history", icon: History },
  { label: "Pengaturan", description: "Info bisnis & konfigurasi", href: "/owner/settings", icon: Settings },
];

export default function OwnerMorePage() {
  const { user, logout } = useAuth();

  return (
    <div className="px-5 pt-6 pb-4 md:px-8 md:pt-8 max-w-2xl md:max-w-none page-enter">
      {/* Profile card */}
      <div className="flex items-center gap-3 mb-6 rounded-3xl p-4" style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)" }}>
          <span className="text-xl font-black text-white">{(user?.displayName ?? "O")[0].toUpperCase()}</span>
        </div>
        <div className="flex-1">
          <p className="font-bold text-base" style={{ color: "#1C1C1E" }}>{user?.displayName ?? "Owner"}</p>
          <p className="text-xs font-semibold" style={{ color: "#E85D8C" }}>Owner</p>
        </div>
      </div>

      {/* Menu grid — all links now point to /owner/* */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} data-testid={`owner-menu-${item.label.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="rounded-2xl p-4 flex items-center gap-3 tap-target" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FEF1F5" }}>
                  <Icon size={18} style={{ color: "#E85D8C" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>{item.label}</p>
                  <p className="text-xs truncate" style={{ color: "#94A3B8" }}>{item.description}</p>
                </div>
                <ChevronRight size={16} style={{ color: "#CBD5E1" }} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Logout */}
      <button onClick={logout} className="flex items-center gap-2.5 w-full rounded-2xl p-4 tap-target" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }} data-testid="owner-logout-button">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "#FEE2E2" }}>
          <LogOut size={18} style={{ color: "#DC2626" }} />
        </div>
        <span className="text-sm font-semibold" style={{ color: "#DC2626" }}>Keluar</span>
      </button>
    </div>
  );
}
