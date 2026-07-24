"use client";

import { RoleGuard } from "@/components/shared/RoleGuard";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, ShoppingCart, Package, User,
  ClipboardList, LogOut, Banknote, ChefHat, Beaker, Settings, BookOpen
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Beranda", href: "/manager/dashboard", icon: LayoutDashboard },
  { label: "Transaksi", href: "/manager/orders", icon: ClipboardList },
  { label: "Buku Kas", href: "/manager/expenses", icon: Banknote },
  { label: "Kasir", href: "/manager/pos", icon: ShoppingCart, isPosButton: true },
  { label: "Belanja", href: "/manager/purchases", icon: Package },
  { label: "Profil", href: "/manager/profile", icon: User },
];

function DesktopSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  return (
    <aside
      className="hidden md:flex fixed top-0 left-0 bottom-0 w-60 flex-col z-40"
      style={{ background: "#fff", borderRight: "1px solid #F1F5F9", boxShadow: "2px 0 12px rgba(0,0,0,0.04)" }}
    >
      <div className="px-5 py-5" style={{ borderBottom: "1px solid #F1F5F9" }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl overflow-hidden flex items-center justify-center bg-slate-100">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#1C1C1E" }}>AnchurPOS</p>
            <p className="text-xs" style={{ color: "#94A3B8" }}>Manager</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`sidebar-${item.label.toLowerCase()}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={active ? { background: "#FEF1F5", color: "#E85D8C" } : { color: "#64748B" }}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-sm font-semibold">{item.label}</span>
            </Link>
          );
        })}
        
        <div className="mt-6 mb-2 px-3">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Operasional & Gudang</p>
        </div>
        {[
          { label: "Pre-Packing", href: "/manager/pre-packing", icon: ClipboardList },
          { label: "Packing (Kirim)", href: "/manager/packing", icon: Package },
          { label: "Produksi", href: "/manager/production", icon: ChefHat },
          { label: "BOM & Resep", href: "/manager/bom", icon: BookOpen },
          { label: "Inventory", href: "/manager/inventory", icon: ClipboardList },
          { label: "Stock Opname", href: "/manager/inventory/stock-opname", icon: ClipboardList },
          { label: "Pengaturan", href: "/manager/settings", icon: Settings },
        ].map((item) => {
          const active = pathname === item.href || (pathname.startsWith(item.href + '/') && !['/manager/inventory', '/manager/pre-packing'].includes(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all tap-target"
              style={active ? { background: "#FEF1F5", color: "#E85D8C" } : { color: "#64748B" }}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-sm font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-3" style={{ borderTop: "1px solid #F1F5F9" }}>
        <div className="flex items-center gap-3 px-3 py-2 mb-1.5">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#E85D8C,#C94A73)" }}>
            <span className="text-white font-bold text-xs">{(user?.displayName ?? "M")[0].toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "#1C1C1E" }}>{user?.displayName ?? "Manager"}</p>
            <p className="text-xs" style={{ color: "#E85D8C" }}>Manager</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors tap-target"
          style={{ color: "#DC2626" }}
          data-testid="sidebar-logout"
        >
          <LogOut size={14} />
          Keluar
        </button>
      </div>
    </aside>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      data-testid="manager-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden animate-fade-in"
      style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="relative flex items-end justify-around px-1 pt-1 pb-1.5 min-h-[58px]">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;

          if (item.isPosButton) {
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`manager-nav-${item.label.toLowerCase()}`}
                className="relative flex flex-col items-center justify-center tap-target -translate-y-3.5"
                style={{ zIndex: 35 }}
              >
                <div
                  className="flex items-center justify-center rounded-full transition-all duration-300 active:scale-95"
                  style={{
                    width: "54px",
                    height: "54px",
                    background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
                    boxShadow: "0 6px 18px rgba(232,93,140,0.42)",
                    border: "4px solid #fff"
                  }}
                >
                  <Icon size={20} className="text-white" strokeWidth={2.5} />
                </div>
                <span className="text-xs font-bold mt-1" style={{ color: active ? "#E85D8C" : "#94A3B8" }}>
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`manager-nav-${item.label.toLowerCase()}`}
              className="flex flex-col items-center gap-0.5 min-w-[50px] min-h-[50px] justify-center tap-target -translate-y-1.5"
            >
              <div
                className="flex items-center justify-center h-8 w-8 rounded-xl transition-all duration-200"
                style={active ? { background: "#FEF1F5" } : {}}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} style={{ color: active ? "#E85D8C" : "#94A3B8" }} />
              </div>
              <span className="text-xs font-bold" style={{ color: active ? "#E85D8C" : "#94A3B8" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["owner", "manager"]}>
      <div className="min-h-screen" style={{ background: "#FCABB4" }}>
        <DesktopSidebar />
        <div className="md:ml-60 pb-24 md:pb-6">
          {children}
        </div>
      </div>
      <MobileBottomNav />
    </RoleGuard>
  );
}
