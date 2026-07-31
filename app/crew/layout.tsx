"use client";

import { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { useAuth } from "@/lib/auth-context";
import { LayoutDashboard, User, LogOut, ChefHat, PackageOpen, ClipboardList } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function DesktopSidebar({ navItems }: { navItems: any[] }) {
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
        {navItems.map((item) => {
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
            <p className="text-xs" style={{ color: "#E85D8C" }}>Crew</p>
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

function MobileBottomNav({ navItems }: { navItems: any[] }) {
  const pathname = usePathname();
  return (
    <nav
      data-testid="crew-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/90 backdrop-blur-xl border-t border-slate-100 pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-2 h-16">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`crew-nav-${item.label.toLowerCase().replace(" ", "")}`}
              className="flex flex-col items-center gap-1 w-16 h-14 justify-center tap-target relative"
            >
              <div
                className={`flex items-center justify-center h-8 w-14 rounded-full transition-all duration-300 ${active ? 'bg-primary/10' : ''}`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} className={active ? "text-primary" : "text-slate-400"} />
              </div>
              <span className={`text-[10px] font-bold transition-colors ${active ? "text-primary" : "text-slate-400"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

import { FCMProvider } from "@/components/shared/FCMProvider";

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  
  const checkStatus = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/attendance/my-status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHasCheckedIn(!!data?.today?.checkIn?.time);
      }
    } catch (e) {
      console.error("Failed to check status", e);
    }
  }, [getToken]);

  useEffect(() => {
    checkStatus();
    const handleStatusUpdate = () => checkStatus();
    window.addEventListener('attendance-updated', handleStatusUpdate);
    return () => window.removeEventListener('attendance-updated', handleStatusUpdate);
  }, [checkStatus]);

  const NAV_ITEMS = [
    { label: "Tugas", href: "/crew/dashboard", icon: LayoutDashboard },
    ...(hasCheckedIn ? [
      { label: "SFM", href: "/crew/sfm", icon: ChefHat },
      { label: "Opname", href: "/crew/stock-opname", icon: ClipboardList },
    ] : []),
    { label: "Profil", href: "/crew/settings", icon: User },
  ];

  return (
    <RoleGuard allowedRoles={["owner", "manager", "crew"]}>
      <FCMProvider />
      <div className="min-h-screen bg-slate-50">
        <DesktopSidebar navItems={NAV_ITEMS} />
        <div className="md:ml-60 pb-24 md:pb-6">
          {children}
        </div>
      </div>
      <MobileBottomNav navItems={NAV_ITEMS} />
    </RoleGuard>
  );
}
