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
    <div className="page-enter min-h-screen pb-24 md:pb-6 bg-brand-50">
      <div className="px-4 pt-6 pb-4 md:px-6 md:pt-8 bg-brand-50 sticky top-0 z-20">
        <h1 className="text-2xl font-black mb-1 text-slate-800 tracking-tight">Sistem Karyawan</h1>
        <p className="text-sm font-semibold text-slate-500">Kelola data, absensi, dan penggajian</p>
        
        {/* Tabs */}
        <div className="flex bg-white border border-slate-200/60 p-1.5 rounded-2xl gap-1.5 mt-5 overflow-x-auto hide-scrollbar shadow-sm">
          {TABS.map(tab => {
            const active = pathname.includes(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-1.5 flex-1 justify-center py-2.5 px-3 rounded-xl font-bold text-xs transition-all whitespace-nowrap tap-target ${
                  active 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
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
