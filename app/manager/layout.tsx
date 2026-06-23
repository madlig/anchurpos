"use client";

import { RoleGuard } from "@/components/shared/RoleGuard";
import { LayoutDashboard, ShoppingCart, Package, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
  { label: "Kasir", href: "/manager/pos", icon: ShoppingCart },
  { label: "Inventori", href: "/manager/inventory", icon: Package },
  { label: "Lainnya", href: "/manager/more", icon: MoreHorizontal },
];

function ManagerNav() {
  const pathname = usePathname();
  return (
    <nav
      data-testid="manager-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(0,0,0,0.06)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`manager-nav-${item.label.toLowerCase()}`}
              className="flex flex-col items-center gap-1 min-w-[60px] min-h-[52px] justify-center tap-target relative"
            >
              <div
                className="flex items-center justify-center h-9 w-9 rounded-2xl transition-all duration-200"
                style={active ? { background: "#FEF1F5" } : {}}
              >
                <Icon size={21} strokeWidth={active ? 2.5 : 1.8} style={{ color: active ? "#E85D8C" : "#94A3B8" }} />
              </div>
              <span className="text-[11px] font-semibold transition-colors" style={{ color: active ? "#E85D8C" : "#94A3B8" }}>
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
    <RoleGuard allowedRoles={["manager"]}>
      <div className="min-h-screen pb-24" style={{ background: "#F0EDE8" }}>
        {children}
      </div>
      <ManagerNav />
    </RoleGuard>
  );
}
