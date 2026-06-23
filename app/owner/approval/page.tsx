"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Loader2, Scale, Clock, Wallet } from "lucide-react";
import Link from "next/link";

interface StockOpname {
  id: string;
  shiftType: string;
  submittedByName: string;
  hasDiscrepancy: boolean;
  reviewAction: string | null;
  createdAt: string;
}

interface AttendanceFlag {
  id: string;
  employeeName: string;
  date: string;
  issue: string;
}

interface PayrollPending {
  id: string;
  month: string;
  employeeName: string;
  totalPaid: number;
  status: string;
}

const TABS = [
  { key: "opname", label: "Stock Opname", icon: Scale },
  { key: "attendance", label: "Absensi", icon: Clock },
  { key: "payroll", label: "Payroll", icon: Wallet },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function OwnerApprovalPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<TabKey>("opname");
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [attendanceFlags, setAttendanceFlags] = useState<AttendanceFlag[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollPending[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(
    async (url: string) => {
      const token = await getToken();
      return fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    [getToken]
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchWithAuth("/api/stock-opname").then((r) => r.json()),
      fetchWithAuth("/api/attendance?flagged=true").then((r) => r.json()).catch(() => []),
      fetchWithAuth("/api/payroll?status=pending").then((r) => r.json()).catch(() => []),
    ])
      .then(([o, a, p]) => {
        const opnameList = Array.isArray(o) ? o : [];
        setOpnames(opnameList.filter((x: StockOpname) => x.hasDiscrepancy && !x.reviewAction));
        setAttendanceFlags(Array.isArray(a) ? a : []);
        setPayrolls(Array.isArray(p) ? p : []);
      })
      .finally(() => setLoading(false));
  }, [fetchWithAuth]);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
  }

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-4">Approval</h1>

      <div className="flex gap-1 bg-stone-100 rounded-lg p-1 mb-5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count =
            t.key === "opname" ? opnames.length : t.key === "attendance" ? attendanceFlags.length : payrolls.length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium transition-colors ${
                tab === t.key ? "bg-white text-emerald-700 shadow-sm" : "text-stone-500"
              }`}
            >
              <Icon size={14} />
              {t.label}
              {count > 0 && (
                <span className="ml-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          {tab === "opname" && (
            <div className="space-y-2">
              {opnames.length === 0 ? (
                <p className="text-center text-sm text-stone-400 py-10">Tidak ada opname bermasalah</p>
              ) : (
                opnames.map((o) => (
                  <Link key={o.id} href="/manager/stock-opname-review">
                    <Card className="p-4 hover:bg-stone-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-stone-900">
                            Shift {o.shiftType}
                          </p>
                          <p className="text-xs text-stone-500">
                            oleh {o.submittedByName} &middot; {formatDate(o.createdAt)}
                          </p>
                        </div>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          Ada selisih
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          )}

          {tab === "attendance" && (
            <div className="space-y-2">
              {attendanceFlags.length === 0 ? (
                <p className="text-center text-sm text-stone-400 py-10">Tidak ada absensi perlu review</p>
              ) : (
                attendanceFlags.map((a) => (
                  <Card key={a.id} className="p-4">
                    <p className="text-sm font-medium text-stone-900">{a.employeeName}</p>
                    <p className="text-xs text-stone-500">
                      {formatDate(a.date)} &middot; {a.issue}
                    </p>
                  </Card>
                ))
              )}
            </div>
          )}

          {tab === "payroll" && (
            <div className="space-y-2">
              {payrolls.length === 0 ? (
                <p className="text-center text-sm text-stone-400 py-10">Tidak ada payroll pending</p>
              ) : (
                payrolls.map((p) => (
                  <Card key={p.id} className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-stone-900">{p.employeeName}</p>
                        <p className="text-xs text-stone-500">{p.month}</p>
                      </div>
                      <span className="text-sm font-medium text-stone-900">{formatCurrency(p.totalPaid)}</span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
