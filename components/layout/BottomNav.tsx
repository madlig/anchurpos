"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Factory, ShoppingCart, Archive, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Beranda" },
  { href: "/production", icon: Factory, label: "Produksi" },
  { href: "/pos", icon: ShoppingCart, label: "POS", primary: true },
  { href: "/inventory", icon: Archive, label: "Inventori" },
  { href: "/reports", icon: BarChart3, label: "Laporan" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t border-stone-200/80 pb-6 pt-2 px-2 z-30">
      <div className="flex items-end justify-around">
        {navItems.map(({ href, icon: Icon, label, primary }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          if (primary) {
            return (
              <Link key={href} href={href} className="relative -mt-7 flex flex-col items-center">
                <div className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/30",
                  active ? "bg-emerald-700" : "bg-emerald-600"
                )}>
                  <Icon size={26} className="text-white" />
                </div>
                <span className="mt-1 text-xs font-semibold text-emerald-700">{label}</span>
              </Link>
            );
          }
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-1 py-1 px-3">
              <Icon size={22} className={active ? "text-emerald-600" : "text-stone-400"} />
              <span className={cn("text-xs font-medium", active ? "text-emerald-700" : "text-stone-500")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
