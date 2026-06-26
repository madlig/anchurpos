"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Scale, Clock, Wallet, ChevronRight } from "lucide-react";
import Link from "next/link";

interface StockOpname { id: string; submittedByName: string; hasDiscrepancy: boolean; reviewAction: string | null; createdAt: string; }
interface AttendanceFlag {
  id: string;
  employeeName: string;
  date: string;
  issue: string;
  checkIn: { time: string; ipAddress: string; ipValid: boolean };
  checkOut: { time: string; ipAddress: string; ipValid: boolean } | null;
  totalHours: number | null;
  overtimeHours: number | null;
  overtimeBonus: number | null;
  status: string;
}
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

function formatTimeOnly(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

export default function OwnerApprovalPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<TabKey>("opname");
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [attendanceFlags, setAttendanceFlags] = useState<AttendanceFlag[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollPending[]>([]);
  const [loading, setLoading] = useState(true);

  // Attendance Review States
  const [expandedAttId, setExpandedAttId] = useState<string | null>(null);
  const [editTotalHours, setEditTotalHours] = useState("");
  const [editOvertimeHours, setEditOvertimeHours] = useState("");
  const [editOvertimeBonus, setEditOvertimeBonus] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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

  const handleExpandAtt = (a: AttendanceFlag) => {
    if (expandedAttId === a.id) {
      setExpandedAttId(null);
    } else {
      setExpandedAttId(a.id);
      setEditTotalHours(String(a.totalHours ?? 8));
      setEditOvertimeHours(String(a.overtimeHours ?? 0));
      setEditOvertimeBonus(String(a.overtimeBonus ?? 0));
    }
  };

  async function handleReviewAttendance(id: string, actionType: "approve" | "adjust" | "reject") {
    setReviewingId(id);
    try {
      const token = await getToken();
      let body: any = {};
      
      if (actionType === "approve") {
        body = { status: "lengkap" };
      } else if (actionType === "adjust") {
        const tot = Number(editTotalHours) || 0;
        const ovt = Number(editOvertimeHours) || 0;
        const bonus = Number(editOvertimeBonus) || 0;
        const reg = Math.min(tot, 8);
        const blocks = Math.floor(ovt);
        
        body = {
          status: "lengkap",
          totalHours: tot,
          regularHours: reg,
          overtimeHours: ovt,
          overtimeBlocks: blocks,
          overtimeBonus: bonus,
          flaggedReason: "Disetujui dengan penyesuaian oleh Manager/Owner"
        };
      } else if (actionType === "reject") {
        body = {
          status: "lengkap",
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          overtimeBlocks: 0,
          overtimeBonus: 0,
          flaggedReason: "Ditolak oleh Manager/Owner"
        };
      }
      
      const res = await fetch(`/api/attendance/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setExpandedAttId(null);
        // refresh data
        const aRes = await fetchWithAuth("/api/attendance?flagged=true");
        const aData = await aRes.json();
        setAttendanceFlags(Array.isArray(aData) ? aData : []);
      } else {
        const errData = await res.json();
        alert(errData.error || "Gagal menyimpan review");
      }
    } catch (err) {
      alert("Kesalahan jaringan");
    } finally {
      setReviewingId(null);
    }
  }

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
                      <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>Stock Opname</p>
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
              {attendanceFlags.length === 0 ? (
                <EmptyState label="Tidak ada absensi perlu review" />
              ) : (
                attendanceFlags.map((a) => {
                  const expanded = expandedAttId === a.id;
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl p-4 transition-all"
                      style={{ background: "#fff", border: "1px solid #F1F5F9" }}
                    >
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => handleExpandAtt(a)}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>{a.employeeName}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                            {formatDate(a.date)} · <span className="font-semibold text-amber-600">{a.issue}</span>
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          style={{
                            color: "#CBD5E1",
                            transform: expanded ? "rotate(90deg)" : "none",
                            transition: "transform 0.2s"
                          }}
                        />
                      </div>

                      {expanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 text-xs">
                          {/* Log check-in and check-out */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                            <div>
                              <p className="text-slate-400 font-medium">Absen Masuk:</p>
                              <p className="font-semibold text-slate-700">
                                {formatTimeOnly(a.checkIn.time)} ({a.checkIn.ipAddress})
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-medium">Absen Pulang:</p>
                              <p className="font-semibold text-slate-700">
                                {a.checkOut ? `${formatTimeOnly(a.checkOut.time)} (${a.checkOut.ipAddress})` : "-"}
                              </p>
                            </div>
                          </div>

                          {/* Adjustment fields */}
                          <div className="space-y-3">
                            <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                              Koreksi Absensi & Lembur
                            </p>
                            
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Total Jam</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editTotalHours}
                                  onChange={(e) => setEditTotalHours(e.target.value)}
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2 font-semibold text-slate-700 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Lembur (Jam)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editOvertimeHours}
                                  onChange={(e) => setEditOvertimeHours(e.target.value)}
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2 font-semibold text-slate-700 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">Bonus Lembur (Rp)</label>
                                <input
                                  type="number"
                                  step="1000"
                                  value={editOvertimeBonus}
                                  onChange={(e) => setEditOvertimeBonus(e.target.value)}
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2 font-semibold text-slate-700 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            <button
                              disabled={reviewingId === a.id}
                              onClick={() => handleReviewAttendance(a.id, "approve")}
                              className="flex-1 min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
                            >
                              Setujui Sesuai Data
                            </button>
                            <button
                              disabled={reviewingId === a.id}
                              onClick={() => handleReviewAttendance(a.id, "adjust")}
                              className="flex-1 min-h-[36px] px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
                            >
                              Simpan Koreksi & Setujui
                            </button>
                            <button
                              disabled={reviewingId === a.id}
                              onClick={() => handleReviewAttendance(a.id, "reject")}
                              className="flex-shrink-0 min-h-[36px] px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs disabled:opacity-50 transition-all active:scale-95"
                            >
                              Tolak Absen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
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
