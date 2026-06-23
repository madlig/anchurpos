"use client";

import { RoleGuard } from "@/components/shared/RoleGuard";
import { LayoutDashboard, FileText, CheckCircle, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/owner/dashboard", icon: LayoutDashboard },
  { label: "Laporan", href: "/owner/reports", icon: FileText },
  { label: "Approval", href: "/owner/approval", icon: CheckCircle },
  { label: "Lainnya", href: "/owner/more", icon: MoreHorizontal },
];

function OwnerNav() {
  const pathname = usePathname();
  return (
    <nav
      data-testid="owner-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-stone-100"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`owner-nav-${item.label.toLowerCase()}`}
              className="relative flex flex-col items-center gap-1 min-w-[60px] min-h-[48px] justify-center tap-target"
            >
              <div className={`flex items-center justify-center h-8 w-8 rounded-2xl transition-all duration-200 ${
                active ? "bg-emerald-50 scale-110" : ""
              }`}>
                <Icon
                  size={22}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={active ? "text-emerald-600" : "text-stone-400"}
                />
              </div>
              <span className={`text-[11px] font-semibold transition-colors ${
                active ? "text-emerald-600" : "text-stone-400"
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["owner"]}>
      <div className="min-h-screen bg-stone-50 pb-24">
        {children}
      </div>
      <OwnerNav />
    </RoleGuard>
  );
}
