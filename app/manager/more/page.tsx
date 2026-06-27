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
  {label: "Review Stock Opname", description: "Review & koreksi stok dari opname crew", href: "/manager/inventory?tab=opname", icon: Scale },
  { label: "Pengeluaran Stok", description: "Sample, hadiah, rusak, konsumsi internal", href: "/manager/stock-adjustments", icon: PackageMinus },
  { label: "Pengaturan", description: "Whitelist IP absen", href: "/manager/settings", icon: Settings },
];

export default function ManagerMorePage() {
  const { user, logout } = useAuth();

  return (
    <div className="page-enter min-h-screen" style={{ background: "#FCABB4" }}>

      {/* Header (white) */}
      <div className="px-5 pt-4 pb-4" style={{ background: "#fff" }}>
        <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Lainnya</h1>
      </div>

      <div className="px-4 pt-4 pb-4 md:px-8 md:max-w-3xl">

      {/* Profile Card */}
      <div
        className="flex items-center gap-3"
        style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #F1F5F9", marginBottom: "12px" }}
      >
        <div style={{
          width: "46px", height: "46px", borderRadius: "12px", flexShrink: 0,
          background: "linear-gradient(135deg,#E85D8C,#C94A73)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <span style={{ fontSize: "20px", fontWeight: "800", color: "#fff" }}>
            {(user?.displayName ?? "M")[0].toUpperCase()}
          </span>
        </div>
        <div>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>{user?.displayName ?? "Manager"}</p>
          <p style={{ fontSize: "12px", fontWeight: "500", color: "#E85D8C" }}>Manager</p>
        </div>
      </div>

      {/* Menu Items */}
      <div style={{ background: "#fff", borderRadius: "14px", overflow: "hidden", border: "1px solid #F1F5F9", marginBottom: "12px" }}>
        {MENU_ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} data-testid={`menu-${item.label.toLowerCase().replace(/\s/g, "-")}`}>
              <div
                className="flex items-center gap-3 tap-target"
                style={{ padding: "13px 14px", borderBottom: i < MENU_ITEMS.length - 1 ? "1px solid #F8FAFC" : "none" }}
              >
                <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} style={{ color: "#E85D8C" }} />
                </div>
                <div className="flex-1">
                  <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{item.label}</p>
                  <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{item.description}</p>
                </div>
                <ChevronRight size={15} style={{ color: "#CBD5E1" }} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="flex items-center gap-3 w-full tap-target"
        style={{ background: "#fff", borderRadius: "14px", padding: "14px", border: "1px solid #FECACA" }}
        data-testid="logout-button"
      >
        <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <LogOut size={16} style={{ color: "#DC2626" }} />
        </div>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#DC2626" }}>Keluar</span>
      </button>

      </div>
    </div>
  );
}
