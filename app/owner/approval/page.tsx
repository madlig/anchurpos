"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Scale, Clock, Wallet, ChevronRight, Check, X } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTimeOnly, calcHoursBetween, addHoursToTime } from "@/lib/formatters";
import { BUSINESS } from "@/lib/constants";

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
  overtimeClassification?: "lembur" | "molor" | "none" | null;
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

export default function OwnerApprovalPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<TabKey>("opname");
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [attendanceFlags, setAttendanceFlags] = useState<AttendanceFlag[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollPending[]>([]);
  const [loading, setLoading] = useState(true);

  // Attendance Review States
  const [expandedAttId, setExpandedAttId] = useState<string | null>(null);
  const [editCheckInTime, setEditCheckInTime] = useState("08:00");
  const [editCheckOutTime, setEditCheckOutTime] = useState("16:00");
  const [editTotalHours, setEditTotalHours] = useState("");
  const [editOvertimeHours, setEditOvertimeHours] = useState("");
  const [editOvertimeBonus, setEditOvertimeBonus] = useState("");
  const [editClassification, setEditClassification] = useState<"lembur" | "molor" | "none" | null>(null);
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
      const inTime = formatTimeOnly(a.checkIn?.time) || "08:00";
      const tot = a.totalHours ?? 8;
      const outTime = formatTimeOnly(a.checkOut?.time) || addHoursToTime(inTime, tot);

      setEditCheckInTime(inTime);
      setEditCheckOutTime(outTime);
      setEditTotalHours(String(tot));
      setEditOvertimeHours(
        String(
          a.overtimeHours ??
            (tot > BUSINESS.REGULAR_HOURS_PER_SHIFT
              ? Math.round((tot - BUSINESS.REGULAR_HOURS_PER_SHIFT) * 10) / 10
              : 0)
        )
      );
      setEditOvertimeBonus(String(a.overtimeBonus ?? 0));
      setEditClassification(
        a.overtimeClassification ??
          (Number(a.overtimeBonus) > 0 || Number(a.overtimeHours) > 0 ? "lembur" : null)
      );
    }
  };

  const handleMarkClassification = (type: "lembur" | "molor") => {
    setEditClassification(type);
    if (type === "lembur") {
      const currentTot = parseFloat(editTotalHours) || 8;
      const ovt = Math.max(0, Math.round((currentTot - BUSINESS.REGULAR_HOURS_PER_SHIFT) * 10) / 10);
      setEditOvertimeHours(String(ovt));
      const blocks = Math.floor(ovt);
      const suggestedBonus = blocks * BUSINESS.OVERTIME_BONUS_PER_BLOCK;
      if (Number(editOvertimeBonus) === 0 && suggestedBonus > 0) {
        setEditOvertimeBonus(String(suggestedBonus));
      }
    } else if (type === "molor") {
      setEditOvertimeHours("0");
      setEditOvertimeBonus("0");
    }
  };

  const handleCheckInChange = (newInTime: string) => {
    setEditCheckInTime(newInTime);
    if (newInTime && editCheckOutTime) {
      const hours = calcHoursBetween(newInTime, editCheckOutTime);
      setEditTotalHours(String(hours));
      if (editClassification !== "molor") {
        const ovt = Math.max(0, Math.round((hours - BUSINESS.REGULAR_HOURS_PER_SHIFT) * 10) / 10);
        setEditOvertimeHours(String(ovt));
      }
    }
  };

  const handleCheckOutChange = (newOutTime: string) => {
    setEditCheckOutTime(newOutTime);
    if (editCheckInTime && newOutTime) {
      const hours = calcHoursBetween(editCheckInTime, newOutTime);
      setEditTotalHours(String(hours));
      if (editClassification !== "molor") {
        const ovt = Math.max(0, Math.round((hours - BUSINESS.REGULAR_HOURS_PER_SHIFT) * 10) / 10);
        setEditOvertimeHours(String(ovt));
      }
    }
  };

  const handleTotalHoursChange = (val: string | number) => {
    const hours = typeof val === "number" ? val : parseFloat(val) || 0;
    setEditTotalHours(String(val));
    if (editCheckInTime) {
      const newOut = addHoursToTime(editCheckInTime, hours);
      setEditCheckOutTime(newOut);
    }
    if (editClassification !== "molor") {
      const ovt = Math.max(0, Math.round((hours - BUSINESS.REGULAR_HOURS_PER_SHIFT) * 10) / 10);
      setEditOvertimeHours(String(ovt));
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
        const reg = editClassification === "molor" ? 8 : Math.min(tot, BUSINESS.REGULAR_HOURS_PER_SHIFT);
        const blocks = Math.floor(ovt);
        const reason =
          editClassification === "molor"
            ? "Shift Molor (Tanpa Lembur)"
            : editClassification === "lembur"
            ? "Lembur Disetujui Owner"
            : "Disetujui dengan penyesuaian oleh Manager/Owner";
        
        body = {
          status: "lengkap",
          checkInTime: editCheckInTime,
          checkOutTime: editCheckOutTime,
          totalHours: tot,
          regularHours: reg,
          overtimeHours: ovt,
          overtimeBlocks: blocks,
          overtimeBonus: bonus,
          overtimeClassification: editClassification,
          flaggedReason: reason,
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
                <span className="absolute -top-1 -right-0.5 h-4 w-4 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ background: "#E85D8C" }}>{counts[t.key]}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {tab === "opname" && (
            <div className="space-y-2">
              {opnames.length === 0 ? <EmptyState label="Tidak ada opname bermasalah" /> : opnames.map((o) => (
                <Link key={o.id} href="/manager/inventory?tab=opname">
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>{a.employeeName}</p>
                            {a.overtimeClassification === "lembur" ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Lembur Disetujui (+{a.overtimeHours ?? 0}j)
                              </span>
                            ) : a.overtimeClassification === "molor" ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                Shift Molor (Tanpa Lembur)
                              </span>
                            ) : (a.totalHours ?? 0) > 8 ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                Perlu Ditandai (&gt;8j)
                              </span>
                            ) : null}
                          </div>
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-brand-50 rounded-xl">
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

                          {/* Panel Pilihan Lembur vs Molor */}
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <span className="text-xs font-bold text-slate-700">
                                Klasifikasi Kelebihan Jam Shift
                              </span>
                              {editClassification === "lembur" && (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 w-fit">
                                  Lembur Disetujui
                                </span>
                              )}
                              {editClassification === "molor" && (
                                <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 w-fit">
                                  Shift Molor
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleMarkClassification("lembur")}
                                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                  editClassification === "lembur"
                                    ? "bg-slate-900 text-white shadow-xs"
                                    : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                                }`}
                              >
                                <Check size={14} /> Lembur Valid (Hitung Bonus)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkClassification("molor")}
                                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                  editClassification === "molor"
                                    ? "bg-amber-600 text-white shadow-xs"
                                    : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                                }`}
                              >
                                <X size={14} /> Shift Molor (Tanpa Bonus Lembur)
                              </button>
                            </div>

                            {editClassification === "lembur" && (
                              <p className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                                Lembur terhitung dan uang lembur akan masuk ke payroll.
                              </p>
                            )}
                            {editClassification === "molor" && (
                              <p className="text-[11px] text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                                Jam lembur di-nolkan. Karyawan hanya dibayar shift reguler standar tanpa tambahan lembur.
                              </p>
                            )}
                          </div>

                          {/* Adjustment fields */}
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <p className="font-bold text-slate-700 text-xs">
                                Koreksi Jam Masuk, Keluar & Durasi
                              </p>
                              <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 w-fit">
                                {editCheckInTime || "--:--"} → {editCheckOutTime || "--:--"} ({editTotalHours} jam)
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Jam Masuk</label>
                                <input
                                  type="time"
                                  value={editCheckInTime}
                                  onChange={(e) => handleCheckInChange(e.target.value)}
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2 font-mono font-semibold text-slate-700 focus:outline-none focus:border-slate-400"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Jam Keluar</label>
                                <input
                                  type="time"
                                  value={editCheckOutTime}
                                  onChange={(e) => handleCheckOutChange(e.target.value)}
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2 font-mono font-semibold text-slate-700 focus:outline-none focus:border-slate-400"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Total Jam Kerja</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editTotalHours}
                                  onChange={(e) => handleTotalHoursChange(e.target.value)}
                                  className="w-full h-9 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white focus:outline-none focus:border-slate-400"
                                />
                              </div>
                            </div>

                            {/* Preset Chips */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 mr-1">Preset Durasi:</span>
                              {[7, 8, 8.5, 9, 10].map((dur) => (
                                <button
                                  key={dur}
                                  type="button"
                                  onClick={() => handleTotalHoursChange(dur)}
                                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    Number(editTotalHours) === dur
                                      ? "bg-slate-900 text-white"
                                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {dur} jam {dur === 8 && "(Normal)"}
                                </button>
                              ))}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Lembur (Jam)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editOvertimeHours}
                                  onChange={(e) => setEditOvertimeHours(e.target.value)}
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2 font-mono font-semibold text-slate-700 focus:outline-none focus:border-slate-400"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Uang Lembur (Rp)</label>
                                <input
                                  type="number"
                                  step="1000"
                                  value={editOvertimeBonus}
                                  onChange={(e) => setEditOvertimeBonus(e.target.value)}
                                  className="w-full h-9 rounded-lg border border-slate-200 px-2 font-mono font-semibold text-slate-800 bg-white focus:outline-none focus:border-slate-400"
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
