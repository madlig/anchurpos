"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Scale, Clock, Wallet, ChevronRight } from "lucide-react";
import Link from "next/link";

interface StockOpname { id: string; shiftType: string; submittedByName: string; hasDiscrepancy: boolean; reviewAction: string | null; createdAt: string; }
interface AttendanceFlag { id: string; employeeName: string; date: string; issue: string; }
interface PayrollPending { id: string; month: string; employeeName: string; totalPaid: number; status: string; }

const TABS = [
  { key: "opname", label: "Stock Opname", icon: Scale },
  { key: "attendance", label: "Absensi", icon: Clock },
  { key: "payroll", label: "Payroll", icon: Wallet },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function OwnerApprovalPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<TabKey>("opname");
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [attendanceFlags, setAttendanceFlags] = useState<AttendanceFlag[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollPending[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(async (url: string) => {
    const token = await getToken();
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }, [getToken]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchWithAuth("/api/stock-opname").then((r) => r.json()),
      fetchWithAuth("/api/attendance?flagged=true").then((r) => r.json()).catch(() => []),
      fetchWithAuth("/api/payroll?status=pending").then((r) => r.json()).catch(() => []),
    ]).then(([o, a, p]) => {
      setOpnames(Array.isArray(o) ? o.filter((x: StockOpname) => x.hasDiscrepancy && !x.reviewAction) : []);
      setAttendanceFlags(Array.isArray(a) ? a : []);
      setPayrolls(Array.isArray(p) ? p : []);
    }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  const counts: Record<TabKey, number> = { opname: opnames.length, attendance: attendanceFlags.length, payroll: payrolls.length };

  return (
    <div className="px-5 pt-6 pb-4 md:px-8 md:pt-8 page-enter">
      <h1 className="text-2xl font-extrabold tracking-tight mb-5" style={{ color: "#1C1C1E" }}>Approval</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl p-1 mb-5" style={{ background: "#F1F5F9" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all tap-target relative" style={active ? { background: "#fff", color: "#E85D8C", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : { color: "#64748B" }} data-testid={`approval-tab-${t.key}`}>
              <Icon size={14} />
              <span className="hidden sm:inline">{t.label}</span>
              {counts[t.key] > 0 && (
                <span className="absolute -top-1 -right-0.5 h-4 w-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: "#E85D8C" }}>{counts[t.key]}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} /></div>
      ) : (
        <>
          {tab === "opname" && (
            <div className="space-y-2">
              {opnames.length === 0 ? <EmptyState label="Tidak ada opname bermasalah" /> : opnames.map((o) => (
                <Link key={o.id} href="/manager/stock-opname-review">
                  <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>Shift {o.shiftType}</p>
                      <p className="text-xs" style={{ color: "#64748B" }}>oleh {o.submittedByName} · {formatDate(o.createdAt)}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: "#D97706", background: "#FEF3C7" }}>Ada selisih</span>
                      <ChevronRight size={14} style={{ color: "#CBD5E1" }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {tab === "attendance" && (
            <div className="space-y-2">
              {attendanceFlags.length === 0 ? <EmptyState label="Tidak ada absensi perlu review" /> : attendanceFlags.map((a) => (
                <div key={a.id} className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
                  <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>{a.employeeName}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>{formatDate(a.date)} · {a.issue}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "payroll" && (
            <div className="space-y-2">
              {payrolls.length === 0 ? <EmptyState label="Tidak ada payroll pending" /> : payrolls.map((p) => (
                <div key={p.id} className="rounded-2xl p-4 flex items-center justify-between" style={{ background: "#fff", border: "1px solid #F1F5F9" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>{p.employeeName}</p>
                    <p className="text-xs" style={{ color: "#64748B" }}>{p.month}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "#E85D8C" }}>{fmt(p.totalPaid)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed p-10 text-center" style={{ borderColor: "#E2E8F0" }}>
      <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>{label}</p>
    </div>
  );
}
