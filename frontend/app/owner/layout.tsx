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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs ${
                active ? "text-emerald-600" : "text-stone-400"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="font-medium">{item.label}</span>
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
      <div className="min-h-screen bg-stone-50 pb-20">
        {children}
      </div>
      <OwnerNav />
    </RoleGuard>
  );
}
