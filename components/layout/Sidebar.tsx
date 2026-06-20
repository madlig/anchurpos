"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Factory, ShoppingCart, Archive, BarChart3, Settings, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Beranda" },
  { href: "/production", icon: Factory, label: "Produksi" },
  { href: "/pos", icon: ShoppingCart, label: "Kasir", badge: "Cepat" },
  { href: "/inventory", icon: Archive, label: "Inventori" },
  { href: "/reports", icon: BarChart3, label: "Laporan" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-stone-200 flex flex-col shrink-0 h-screen">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-stone-100">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center font-black shadow-sm shadow-emerald-600/30 text-lg">
          A
        </div>
        <div>
          <p className="text-sm font-bold text-stone-900">AnchurPOS</p>
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" /> PWA · Online
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-emerald-50 text-emerald-700" : "text-stone-600 hover:bg-stone-100"
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" size={18} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600 text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-stone-100">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-100 cursor-pointer">
          <div className="h-8 w-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 text-xs font-bold shrink-0">
            RN
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-stone-900 truncate">Rina Wulandari</p>
            <p className="text-[11px] text-stone-500 truncate">Owner · Jakarta</p>
          </div>
          <Settings className="h-3.5 w-3.5 text-stone-400 shrink-0" />
        </div>
      </div>
    </aside>
  );
}
