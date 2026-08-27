"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { Loader2, ChevronDown, ChevronUp, Pencil, Check, CalendarDays, User, X, Search, Filter, AlertTriangle, Plus, Clock } from "lucide-react";
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

  // Manual Attendance Modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEmpId, setManualEmpId] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [manualCheckIn, setManualCheckIn] = useState("08:00");
  const [manualCheckOut, setManualCheckOut] = useState("16:00");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState("");
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "flagged">("all");

  const [expandedAttId, setExpandedAttId] = useState<string | null>(null);
  const [editTotalHours, setEditTotalHours] = useState("");
  const [editOvertimeHours, setEditOvertimeHours] = useState("");
  const [editOvertimeBonus, setEditOvertimeBonus] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const empRes = await fetchWithAuth("/api/employees");
      if (empRes.ok) setEmployees(await empRes.json());

      const attRes = await fetchWithAuth(`/api/attendance?month=${selectedMonth}`);
      if (attRes.ok) {
        setAttendance(await attRes.json());
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
          status: "lengkap",
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

  const handleDeleteAtt = async (a: AttendanceRecord) => {
    if (!window.confirm(`Yakin ingin MENGHAPUS PERMANEN absen anomali ${a.employeeName} tanggal ${fmtDateFull(a.date)}? Data yang dihapus tidak bisa dikembalikan.`)) return;
    
    setDeletingId(a.id);
    try {
      const res = await fetchWithAuth(`/api/attendance/${a.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setExpandedAttId(null);
        loadData();
      } else {
        alert("Gagal menghapus absensi");
      }
    } catch (e) {
      alert("Error jaringan");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAttendance = useMemo(() => {
    return attendance.filter(a => {
      const matchesSearch = a.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
      const isFlagged = a.flaggedReason?.includes("Auto-Checkout") || a.status === "direview";
      const matchesFilter = filterType === "all" ? true : isFlagged;
      return matchesSearch && matchesFilter;
    });
  }, [attendance, searchQuery, filterType]);

  const flaggedCount = attendance.filter(a => a.flaggedReason?.includes("Auto-Checkout") || a.status === "direview").length;

  const handleManualSubmit = async () => {
    if (!manualEmpId || !manualDate || !manualCheckIn || !manualCheckOut) {
      setManualError("Semua field wajib diisi");
      return;
    }
    setManualSubmitting(true);
    setManualError("");
    try {
      const res = await fetchWithAuth("/api/attendance/manual", {
        method: "POST",
        body: JSON.stringify({
          employeeId: manualEmpId,
          date: manualDate,
          checkInTime: manualCheckIn,
          checkOutTime: manualCheckOut,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualError(data.error || "Gagal menyimpan absen manual");
      } else {
        setShowManualModal(false);
        loadData();
      }
    } catch (e: any) {
      setManualError("Kesalahan jaringan");
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Pantauan Absensi</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Data absensi bulanan crew otomatis valid.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white shadow-sm"
          />
          <button
            onClick={() => {
              setShowManualModal(true);
              setManualError("");
              if (employees.length > 0 && !manualEmpId) setManualEmpId(employees[0].id);
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus size={15} /> Input Absen Manual
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cari nama karyawan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setFilterType("all")} 
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${filterType === "all" ? "bg-slate-800 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            Semua ({attendance.length})
          </button>
          <button 
            onClick={() => setFilterType("flagged")} 
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${filterType === "flagged" ? "bg-rose-600 text-white shadow-md" : "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50"}`}
          >
            <AlertTriangle size={14} /> Perlu Review {flaggedCount > 0 && `(${flaggedCount})`}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : filteredAttendance.length === 0 ? (
        <div className="bg-white rounded-[16px] py-12 px-6 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
            <Search className="text-slate-400" size={24} />
          </div>
          <p className="text-sm font-bold text-slate-700">Tidak ada data absen</p>
          <p className="text-xs text-slate-500 mt-1">Belum ada riwayat absensi yang cocok dengan filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredAttendance.map(a => {
            const isAutoCheckout = a.flaggedReason?.includes("Auto-Checkout");
            return (
              <div key={a.id} className={`bg-white rounded-[16px] p-4 transition-all ${isAutoCheckout ? "border-2 border-rose-300 shadow-sm" : "border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:border-slate-200 hover:shadow-md"}`}>
                <div className="flex items-start justify-between border-b border-slate-50 pb-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-slate-900">{a.employeeName}</p>
                      {isAutoCheckout && (
                        <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wide flex items-center gap-1">
                          <AlertTriangle size={10} /> AUTO-CHECKOUT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-slate-500">
                      <CalendarDays size={12} />
                      <span className="text-[11px] font-semibold">
                        {fmtDateFull(a.date)} {a.flaggedReason && !isAutoCheckout ? `· ${a.flaggedReason}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 text-right">
                    {a.checkIn && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md font-semibold border border-slate-100">
                        Masuk: <span className="text-slate-800 font-bold ml-1">{fmtTime(a.checkIn.time)}</span>
                      </p>
                    )}
                    {a.checkOut?.time && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md font-semibold border border-slate-100">
                        Pulang: <span className="text-slate-800 font-bold ml-1">{fmtTime(a.checkOut.time)}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center bg-slate-50 border border-slate-100 rounded-xl py-2.5">
                    <p className="text-[10px] font-extrabold text-slate-400 mb-0.5 tracking-wide">TOTAL JAM</p>
                    <p className="text-sm font-black text-slate-800">{a.totalHours ?? 0} <span className="text-xs font-semibold text-slate-500">Jam</span></p>
                  </div>
                  <div className="text-center bg-slate-50 border border-slate-100 rounded-xl py-2.5">
                    <p className="text-[10px] font-extrabold text-slate-400 mb-0.5 tracking-wide">JAM LEMBUR</p>
                    <p className="text-sm font-black text-slate-800">{a.overtimeHours ?? 0} <span className="text-xs font-semibold text-slate-500">Jam</span></p>
                  </div>
                  <div className="text-center bg-emerald-50 border border-emerald-100 rounded-xl py-2.5">
                    <p className="text-[10px] font-extrabold text-emerald-600/70 mb-0.5 tracking-wide">UANG LEMBUR</p>
                    <p className="text-sm font-black text-emerald-700">{a.overtimeBonus ? `Rp ${a.overtimeBonus.toLocaleString("id-ID")}` : "-"}</p>
                  </div>
                </div>

                <button 
                  onClick={() => handleExpandAtt(a)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all tap-target ${expandedAttId === a.id ? "bg-slate-100 text-slate-700" : "bg-white text-slate-500 border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50"}`}
                >
                  {expandedAttId === a.id ? (
                    <><ChevronUp size={14} /> Tutup Koreksi</>
                  ) : (
                    <><Pencil size={13} /> Koreksi Jam Kerja</>
                  )}
                </button>

                {expandedAttId === a.id && (
                  <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 block mb-1.5 tracking-wide">EDIT TOTAL JAM</label>
                        <input type="number" step="0.1" value={editTotalHours} onChange={(e) => setEditTotalHours(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 px-3 font-bold text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 bg-white" />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 block mb-1.5 tracking-wide">EDIT LEMBUR</label>
                        <input type="number" step="0.1" value={editOvertimeHours} onChange={(e) => setEditOvertimeHours(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 px-3 font-bold text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 bg-white" />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 block mb-1.5 tracking-wide">EDIT UANG LEMBUR (Rp)</label>
                        <input type="number" step="1000" value={editOvertimeBonus} onChange={(e) => setEditOvertimeBonus(e.target.value)} className="w-full h-10 rounded-xl border border-emerald-200 px-3 font-bold text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-emerald-800 bg-emerald-50/50" />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                      <button onClick={() => handleDeleteAtt(a)} disabled={deletingId === a.id} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors tap-target">
                        {deletingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Hapus Absen
                      </button>
                      <div className="flex w-full sm:w-auto gap-2">
                        <button onClick={() => setExpandedAttId(null)} className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white text-slate-600 font-bold text-xs border border-slate-200 hover:bg-slate-50 tap-target">
                          Batal
                        </button>
                        <button onClick={() => handleSaveCorrection(a)} disabled={savingId === a.id} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border-none cursor-pointer text-xs font-bold flex items-center justify-center gap-2 tap-target shadow-sm shadow-emerald-200 transition-colors">
                          {savingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan Koreksi
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL INPUT ABSEN MANUAL */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-800">Input Absen Manual</h3>
                <p className="text-xs font-semibold text-slate-400">Tambahkan kehadiran kru yang lupa absen / maintenance.</p>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {manualError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold text-xs">
                {manualError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-500 block mb-1">Pilih Karyawan</label>
                <select
                  value={manualEmpId}
                  onChange={(e) => setManualEmpId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  {employees.filter(e => e.isActive !== false).map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-500 block mb-1">Tanggal Absensi</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Jam Masuk</label>
                  <input
                    type="time"
                    value={manualCheckIn}
                    onChange={(e) => setManualCheckIn(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Jam Pulang</label>
                  <input
                    type="time"
                    value={manualCheckOut}
                    onChange={(e) => setManualCheckOut(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800 text-[11px] font-semibold">
                ✨ Absensi akan langsung tercatat sebagai <strong>Hadir Lengkap (8 Jam)</strong> dan tersinkronisasi ke slip gaji payroll.
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={manualSubmitting}
                className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                {manualSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan Kehadiran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
