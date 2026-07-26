"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Users, CalendarDays, Wallet } from "lucide-react";

export default function EmployeesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const TABS = [
    { id: "master", label: "Data Karyawan", icon: Users, href: "/manager/employees/master" },
    { id: "attendance", label: "Absensi", icon: CalendarDays, href: "/manager/employees/attendance" },
    { id: "payroll", label: "Payroll", icon: Wallet, href: "/manager/employees/payroll" },
  ];

  return (
    <div className="page-enter min-h-screen pb-24 md:pb-6" style={{ background: "#FCABB4" }}>
      <div className="px-5 pt-6 pb-4 bg-white/90 backdrop-blur-xl border-b border-pink-200 shadow-sm sticky top-0 z-20">
        <h1 className="text-2xl font-black mb-1" style={{ color: "#1E293B" }}>Sistem Karyawan</h1>
        <p className="text-sm font-semibold text-slate-500">Kelola data, absensi, dan penggajian</p>
        
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1.5 mt-5 overflow-x-auto hide-scrollbar">
          {TABS.map(tab => {
            const active = pathname.includes(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex items-center gap-1.5 flex-1 justify-center py-2 px-3 rounded-lg font-bold text-xs transition-all whitespace-nowrap tap-target"
                style={{
                  background: active ? "#fff" : "transparent",
                  color: active ? "#E85D8C" : "#64748B",
                  boxShadow: active ? "0 2px 4px rgba(0,0,0,0.04)" : "none",
                }}
              >
                <Icon size={14} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        {children}
      </div>
    </div>
  );
}
