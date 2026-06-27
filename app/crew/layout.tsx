"use client";

import { RoleGuard } from "@/components/shared/RoleGuard";
import { useAuth } from "@/lib/auth-context";
import { UserCheck, ChefHat, PackageOpen, LogOut, Settings, ClipboardList } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Absen", href: "/crew/attendance", icon: UserCheck },
  { label: "Produksi", href: "/crew/production", icon: ChefHat },
  { label: "Pre-Packing", href: "/crew/pre-packing", icon: PackageOpen },
  { label: "Packing", href: "/crew/packing", icon: PackageOpen },
  { label: "Stock Opname", href: "/crew/stock-opname", icon: ClipboardList },
  { label: "Pengaturan", href: "/crew/settings", icon: Settings },
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
            <p className="text-xs" style={{ color: "#94A3B8" }}>Crew</p>
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
              data-testid={`sidebar-crew-${item.label.toLowerCase()}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
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
            <span className="text-white font-bold text-xs">{(user?.displayName ?? "C")[0].toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "#1C1C1E" }}>{user?.displayName ?? "Crew"}</p>
            <p className="text-[11px]" style={{ color: "#E85D8C" }}>Crew</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors tap-target"
          style={{ color: "#DC2626" }}
          data-testid="sidebar-logout-crew"
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
      data-testid="crew-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`crew-nav-${item.label.toLowerCase().replace(" ", "")}`}
              className="flex flex-col items-center gap-0.5 min-w-[60px] min-h-[50px] justify-center tap-target"
            >
              <div
                className="flex items-center justify-center h-8 w-8 rounded-xl transition-all duration-200"
                style={active ? { background: "#FEF1F5" } : {}}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} style={{ color: active ? "#E85D8C" : "#94A3B8" }} />
              </div>
              <span className="text-[10px] font-semibold" style={{ color: active ? "#E85D8C" : "#94A3B8" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["owner", "manager", "crew"]}>
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
