"use client";

import { RoleGuard } from "@/components/shared/RoleGuard";
import { UserCheck, ChefHat, PackageOpen, ClipboardList } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Absen", href: "/crew/attendance", icon: UserCheck },
  { label: "Produksi", href: "/crew/production", icon: ChefHat },
  { label: "Pre-Pack", href: "/crew/pre-packing", icon: PackageOpen },
  { label: "Stok Opname", href: "/crew/stock-opname", icon: ClipboardList },
];

function CrewNav() {
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

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["crew"]}>
      <div className="min-h-screen bg-stone-50 pb-20">
        {children}
      </div>
      <CrewNav />
    </RoleGuard>
  );
}
