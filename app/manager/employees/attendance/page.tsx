"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { Loader2, ChevronDown, ChevronUp, Pencil, Check, CalendarDays, User, X } from "lucide-react";
import { AttendanceRecord, Employee } from "../types";

const fmtDateFull = (dStr: string) => {
  const [y, m, d] = dStr.split("-");
  const mos = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${mos[parseInt(m) - 1]} ${y}`;
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function AttendancePage() {
  const { getToken } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [expandedAttId, setExpandedAttId] = useState<string | null>(null);
  const [editTotalHours, setEditTotalHours] = useState("");
  const [editOvertimeHours, setEditOvertimeHours] = useState("");
  const [editOvertimeBonus, setEditOvertimeBonus] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load employees for mapping names
      const empRes = await fetchWithAuth("/api/employees");
      if (empRes.ok) {
        setEmployees(await empRes.json());
      }
      // Load attendance
      const attRes = await fetchWithAuth(`/api/attendance?month=${selectedMonth}`);
      if (attRes.ok) {
        const data = await attRes.json();
        // Trust by Default: We just show all of them.
        setAttendance(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExpandAtt = (a: AttendanceRecord) => {
    if (expandedAttId === a.id) {
      setExpandedAttId(null);
    } else {
      setExpandedAttId(a.id);
      setEditTotalHours(String(a.totalHours ?? 8));
      setEditOvertimeHours(String(a.overtimeHours ?? 0));
      setEditOvertimeBonus(String(a.overtimeBonus ?? 0));
    }
  };

  const handleSaveCorrection = async (a: AttendanceRecord) => {
    setSavingId(a.id);
    try {
      const res = await fetchWithAuth(`/api/attendance/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "completed",
          totalHours: Number(editTotalHours),
          overtimeHours: Number(editOvertimeHours),
          overtimeBonus: Number(editOvertimeBonus),
          flaggedReason: "Dikoreksi Manager"
        })
      });
      if (res.ok) {
        setExpandedAttId(null);
        loadData();
      } else {
        alert("Gagal menyimpan koreksi");
      }
    } catch (e) {
      alert("Error jaringan");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-black text-slate-800">Pantauan Absensi</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Data absensi bulanan crew otomatis valid.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "13px", fontWeight: "700", color: "#334155", outline: "none", background: "#fff" }}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : attendance.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "14px", padding: "32px 16px", textAlign: "center", border: "1px solid #F1F5F9" }}>
          <p style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>Belum ada riwayat absensi pada bulan ini</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {attendance.map(a => {
            const isAutoCheckout = a.flaggedReason?.includes("Auto-Checkout");
            return (
              <div key={a.id} style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: isAutoCheckout ? "2px solid #FECACA" : "1px solid #F1F5F9", boxShadow: "0 2px 10px rgba(0,0,0,0.015)" }}>
                <div className="flex items-start justify-between border-b border-slate-50 pb-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p style={{ fontSize: "14px", fontWeight: "800", color: "#1C1C1E" }}>{a.employeeName}</p>
                      {isAutoCheckout && (
                        <span style={{ fontSize: "10px", background: "#FEF2F2", color: "#DC2626", padding: "2px 6px", borderRadius: "4px", fontWeight: "800" }}>⚠️ AUTO-CHECKOUT</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                      <CalendarDays size={12} />
                      <span style={{ fontSize: "11px", fontWeight: "600" }}>
                        {fmtDateFull(a.date)} {a.flaggedReason && !isAutoCheckout ? `· ${a.flaggedReason}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    {a.checkIn && (
                      <p style={{ fontSize: "11px", color: "#64748B", background: "#F1F5F9", padding: "2px 8px", borderRadius: "100px", fontWeight: "600" }}>
                        Masuk: <span className="text-slate-700">{fmtTime(a.checkIn.time)}</span>
                      </p>
                    )}
                    {a.checkOut?.time && (
                      <p style={{ fontSize: "11px", color: "#64748B", background: "#F1F5F9", padding: "2px 8px", borderRadius: "100px", fontWeight: "600" }}>
                        Pulang: <span className="text-slate-700">{fmtTime(a.checkOut.time)}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center bg-slate-50 rounded-lg py-2">
                    <p style={{ fontSize: "10px", fontWeight: "800", color: "#94A3B8", marginBottom: "2px" }}>TOTAL JAM</p>
                    <p style={{ fontSize: "13px", fontWeight: "800", color: "#334155" }}>{a.totalHours ?? 0} Jam</p>
                  </div>
                  <div className="text-center bg-slate-50 rounded-lg py-2">
                    <p style={{ fontSize: "10px", fontWeight: "800", color: "#94A3B8", marginBottom: "2px" }}>LEMBUR</p>
                    <p style={{ fontSize: "13px", fontWeight: "800", color: "#334155" }}>{a.overtimeHours ?? 0} Jam</p>
                  </div>
                  <div className="text-center bg-slate-50 rounded-lg py-2">
                    <p style={{ fontSize: "10px", fontWeight: "800", color: "#94A3B8", marginBottom: "2px" }}>LEMBUR</p>
                    <p style={{ fontSize: "14px", fontWeight: "900", color: "#1E293B" }}>{a.overtimeBonus ? `Rp ${a.overtimeBonus.toLocaleString("id-ID")}` : "-"}</p>
                  </div>
                </div>

                <button 
                  onClick={() => handleExpandAtt(a)}
                  style={{ width: "100%", padding: "8px", borderRadius: "10px", background: expandedAttId === a.id ? "#F1F5F9" : "transparent", border: expandedAttId === a.id ? "none" : "1px dashed #CBD5E1", color: "#64748B", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", cursor: "pointer" }}
                >
                  <Pencil size={13} /> {expandedAttId === a.id ? "Tutup Edit" : "Koreksi Jam Kerja (Adjustment)"}
                </button>

                {expandedAttId === a.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">EDIT TOTAL JAM</label>
                        <input type="number" step="0.1" value={editTotalHours} onChange={(e) => setEditTotalHours(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 pl-3 pr-2 font-bold focus:outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300 text-xs text-slate-700" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">EDIT LEMBUR</label>
                        <input type="number" step="0.1" value={editOvertimeHours} onChange={(e) => setEditOvertimeHours(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 pl-3 pr-2 font-bold focus:outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300 text-xs text-slate-700" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">EDIT LEMBUR (Rp)</label>
                        <input type="number" step="1000" value={editOvertimeBonus} onChange={(e) => setEditOvertimeBonus(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 pl-3 pr-2 font-bold focus:outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300 text-xs text-slate-700" />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => handleSaveCorrection(a)} disabled={savingId === a.id} style={{ padding: "8px 16px", borderRadius: "8px", background: "#10B981", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                        {savingId === a.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan Koreksi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
