"use client";

import { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { useAuth } from "@/lib/auth-context";
import { ChefHat, ClipboardList, Clock, ReceiptText, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// DesktopSidebar removed

function MobileBottomNav({ navItems }: { navItems: any[] }) {
  const pathname = usePathname();
  return (
    <nav
      data-testid="crew-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-100 pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-2 h-16 max-w-2xl mx-auto">
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
    { label: "Absen", href: "/crew/attendance", icon: Clock },
    ...(hasCheckedIn ? [
      { label: "SFM", href: "/crew/sfm", icon: ChefHat },
    ] : []),
    { label: "Gaji", href: "/crew/payroll", icon: ReceiptText },
    { label: "Profil", href: "/crew/settings", icon: User },
  ];

  return (
    <RoleGuard allowedRoles={["owner", "manager", "crew"]}>
      <FCMProvider />
      <div className="min-h-screen bg-slate-50 pb-24">
        {children}
      </div>
      <MobileBottomNav navItems={NAV_ITEMS} />
    </RoleGuard>
  );
}
