"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  CalendarDays,
  User,
  X,
  Search,
  AlertTriangle,
  Plus,
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  Users,
} from "lucide-react";
import { AttendanceRecord, Employee } from "@/app/manager/employees/types";
import { StoreLocationModal } from "@/components/shared/StoreLocationModal";
import { AttendancePhotoModal, AttendancePhotoModalData } from "@/components/shared/AttendancePhotoModal";

const fmtDateFull = (dStr: string) => {
  if (!dStr) return "-";
  const [y, m, d] = dStr.split("-");
  const mos = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${mos[parseInt(m) - 1]} ${y}`;
};

const fmtTime = (iso: string) => {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function LiveShiftTimer({ checkInTime }: { checkInTime: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const start = new Date(checkInTime).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - start) / 1000));
      const hrs = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      setElapsed(`${hrs}j ${mins}m`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [checkInTime]);

  return <span className="font-mono text-emerald-700 font-extrabold">{elapsed}</span>;
}

interface AttendanceMonitoringViewProps {
  hideHeaderTitle?: boolean;
}

export function AttendanceMonitoringView({ hideHeaderTitle = false }: AttendanceMonitoringViewProps) {
  const { getToken } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [photoModalData, setPhotoModalData] = useState<AttendancePhotoModalData | null>(null);

  // Manual Attendance Modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEmpId, setManualEmpId] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [manualCheckIn, setManualCheckIn] = useState("08:00");
  const [manualCheckOut, setManualCheckOut] = useState("16:00");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState("");

  // Roster section: toggle unclocked crew list
  const [showUnclockedCrew, setShowUnclockedCrew] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "today" | "flagged">("all");

  const [expandedAttId, setExpandedAttId] = useState<string | null>(null);
  const [editTotalHours, setEditTotalHours] = useState("");
  const [editOvertimeHours, setEditOvertimeHours] = useState("");
  const [editOvertimeBonus, setEditOvertimeBonus] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchWithAuth = useCallback(
    async (url: string, opts?: RequestInit) => {
      const token = await getToken();
      return fetch(url, {
        ...opts,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers },
      });
    },
    [getToken]
  );

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

  // Today Date calculation (UTC+7)
  const todayStr = useMemo(() => {
    const now = new Date();
    const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return local.toISOString().split("T")[0];
  }, []);

  const activeCrews = useMemo(() => {
    return employees.filter((e) => e.isActive !== false && e.role === "crew");
  }, [employees]);

  const todayAttendances = useMemo(() => {
    return attendance.filter((a) => a.date === todayStr);
  }, [attendance, todayStr]);

  // Roster categories for Today
  const onDutyCrew = useMemo(() => {
    return todayAttendances.filter((a) => a.checkIn?.time && (!a.checkOut?.time || a.status === "belum_lengkap"));
  }, [todayAttendances]);

  const completedTodayCrew = useMemo(() => {
    return todayAttendances.filter((a) => a.checkOut?.time && a.status !== "belum_lengkap");
  }, [todayAttendances]);

  const unclockedCrew = useMemo(() => {
    const attendedEmpIds = new Set(todayAttendances.map((a) => a.employeeId));
    return activeCrews.filter((c) => !attendedEmpIds.has(c.id));
  }, [activeCrews, todayAttendances]);

  // 1-Click Approve handler
  const handleApproveAtt = async (a: AttendanceRecord) => {
    setApprovingId(a.id);
    try {
      // Optimistic update
      setAttendance((prev) =>
        prev.map((item) =>
          item.id === a.id
            ? { ...item, status: "lengkap", flaggedReason: "Disetujui Management" }
            : item
        )
      );

      const res = await fetchWithAuth(`/api/attendance/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "lengkap",
          flaggedReason: "Disetujui Management",
        }),
      });

      if (!res.ok) {
        loadData();
        alert("Gagal menyetujui absensi.");
      }
    } catch (e) {
      loadData();
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setApprovingId(null);
    }
  };

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
          flaggedReason: "Dikoreksi Management",
        }),
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
    if (
      !window.confirm(
        `Yakin ingin MENGHAPUS PERMANEN absen ${a.employeeName} tanggal ${fmtDateFull(a.date)}? Data yang dihapus tidak bisa dikembalikan.`
      )
    )
      return;

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
    return attendance.filter((a) => {
      const matchesSearch = a.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
      if (filterType === "today") {
        return matchesSearch && a.date === todayStr;
      }
      if (filterType === "flagged") {
        const isFlagged = a.flaggedReason?.includes("Auto-Checkout") || a.status === "direview";
        return matchesSearch && isFlagged;
      }
      return matchesSearch;
    });
  }, [attendance, searchQuery, filterType, todayStr]);

  const flaggedCount = attendance.filter(
    (a) => a.flaggedReason?.includes("Auto-Checkout") || a.status === "direview"
  ).length;

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
    <div className="animate-in fade-in pb-10 space-y-6">
      {/* ── HEADER ACTION BAR ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {!hideHeaderTitle && (
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Pantauan Absensi & Shift</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              Verifikasi kehadiran, foto selfie, koordinat GPS, dan status persetujuan.
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white shadow-xs"
          />
          <button
            onClick={() => setShowLocationModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
            title="Atur titik koordinat GPS dan radius toleransi toko"
          >
            <MapPin size={15} /> Lokasi Toko
          </button>
          <button
            onClick={() => {
              setShowManualModal(true);
              setManualError("");
              if (employees.length > 0 && !manualEmpId) setManualEmpId(employees[0].id);
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={15} /> Input Manual
          </button>
        </div>
      </div>

      {/* ── WIDGET REAL-TIME HARI INI (LIVE SHIFT ROSTER) ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-5 text-white shadow-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
              Live Shift Toko Hari Ini ({fmtDateFull(todayStr)})
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            Total {todayAttendances.length} Shift Tercatat
          </span>
        </div>

        {/* 3 Metric Cards disesuaikan dengan sistem kerja Shift */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {/* On-Duty */}
          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 text-center">
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Sedang Shift</p>
            <p className="text-2xl font-black text-white mt-1">{onDutyCrew.length}</p>
            <p className="text-[10px] text-white/60 mt-0.5">On-Duty di Toko</p>
          </div>

          {/* Selesai */}
          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 text-center">
            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Selesai Hari Ini</p>
            <p className="text-2xl font-black text-white mt-1">{completedTodayCrew.length}</p>
            <p className="text-[10px] text-white/60 mt-0.5">Sudah Checkout</p>
          </div>

          {/* Total Hadir */}
          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 text-center">
            <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Total Hadir</p>
            <p className="text-2xl font-black text-white mt-1">{todayAttendances.length}</p>
            <p className="text-[10px] text-white/60 mt-0.5">Crew Bertugas</p>
          </div>
        </div>

        {/* List of On-Duty Crew right now */}
        {onDutyCrew.length > 0 ? (
          <div className="pt-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-2">
              Crew Sedang Bertugas Saat Ini:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {onDutyCrew.map((c) => (
                <div
                  key={c.id}
                  className="bg-white/5 border border-emerald-500/30 rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {c.checkIn?.photoUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPhotoModalData({
                            isOpen: true,
                            photoUrl: c.checkIn!.photoUrl!,
                            employeeName: c.employeeName,
                            type: "checkin",
                            date: c.date,
                            timeStr: fmtTime(c.checkIn!.time),
                            locationValid: c.checkIn?.locationValid,
                            distance: c.checkIn?.distance,
                            latitude: c.checkIn?.latitude,
                            longitude: c.checkIn?.longitude,
                          })
                        }
                        className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-emerald-400/50 cursor-pointer relative group"
                        title="Klik untuk lihat selfie"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.checkIn.photoUrl} alt="Selfie" className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                        <User size={14} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.employeeName}</p>
                      <p className="text-[10px] text-slate-300">
                        Masuk: {fmtTime(c.checkIn!.time)} · Durasi:{" "}
                        <LiveShiftTimer checkInTime={c.checkIn!.time} />
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      c.checkIn?.locationValid
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {c.checkIn?.locationValid ? "Di Toko" : "Luar Radius"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : todayAttendances.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-2 italic">
            Belum ada crew yang melakukan absen shift hari ini.
          </p>
        ) : null}

        {/* Collapsible untuk melihat crew yang belum ada absen hari ini (off-duty / jadwal shift nanti) */}
        {unclockedCrew.length > 0 && (
          <div className="pt-1 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowUnclockedCrew((prev) => !prev)}
              className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Users size={13} />
              <span>
                Lihat Crew yang Belum Absen Hari Ini ({unclockedCrew.length} crew)
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showUnclockedCrew ? "rotate-180" : ""}`}
              />
            </button>

            {showUnclockedCrew && (
              <div className="mt-2.5 p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap gap-2 animate-in fade-in">
                {unclockedCrew.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700"
                  >
                    <User size={12} className="text-slate-400" />
                    <span>{c.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">({c.role})</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── FILTER & SEARCH SECTION ── */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cari nama crew..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-xs"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterType("all")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Semua Bulan Ini ({attendance.length})
          </button>
          <button
            onClick={() => setFilterType("today")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === "today"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50"
            }`}
          >
            Hari Ini ({todayAttendances.length})
          </button>
          <button
            onClick={() => setFilterType("flagged")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              filterType === "flagged"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50"
            }`}
          >
            <AlertTriangle size={14} /> Perlu Review {flaggedCount > 0 && `(${flaggedCount})`}
          </button>
        </div>
      </div>

      {/* ── CARD LIST ABSENSI ── */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : filteredAttendance.length === 0 ? (
        <div className="bg-white rounded-3xl py-14 px-6 text-center border border-slate-200/80 shadow-xs flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 text-slate-400">
            <Search size={26} />
          </div>
          <p className="text-sm font-extrabold text-slate-800">Tidak ada data absensi</p>
          <p className="text-xs text-slate-500 mt-1">Belum ada riwayat absensi yang cocok dengan filter yang dipilih.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredAttendance.map((a) => {
            const isAutoCheckout = a.flaggedReason?.includes("Auto-Checkout");
            const needsReview = a.status === "direview" || isAutoCheckout;
            const isApproved = a.status === "lengkap";

            return (
              <div
                key={a.id}
                className={`bg-white rounded-3xl p-5 transition-all ${
                  needsReview
                    ? "border-2 border-amber-300 shadow-xs"
                    : "border border-slate-200/80 shadow-xs hover:border-slate-300"
                }`}
              >
                {/* Header Card: Nama & Tanggal */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-900">{a.employeeName}</p>
                      {isAutoCheckout && (
                        <span className="text-[10px] bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex items-center gap-1">
                          <AlertTriangle size={10} /> Auto-Checkout
                        </span>
                      )}
                      {needsReview && !isAutoCheckout && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                          Menunggu Review
                        </span>
                      )}
                      {isApproved && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex items-center gap-1">
                          <CheckCircle2 size={11} className="text-emerald-600" /> Sah / Disetujui
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                      <CalendarDays size={13} />
                      <span className="text-xs font-semibold">
                        {fmtDateFull(a.date)}{" "}
                        {a.flaggedReason && !isAutoCheckout ? `· ${a.flaggedReason}` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Button: 1-Click Approve */}
                  {needsReview && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={approvingId === a.id}
                        onClick={() => handleApproveAtt(a)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                        title="Sahkan shift ini agar otomatis masuk perhitungan payroll"
                      >
                        {approvingId === a.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                        Setujui Shift
                      </button>
                    </div>
                  )}
                </div>

                {/* Section Bukti Foto Selfie & Titik Lokasi Masuk vs Pulang */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {/* Blok Masuk */}
                  <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center gap-3">
                    {/* Thumbnail Selfie Masuk */}
                    {a.checkIn?.photoUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPhotoModalData({
                            isOpen: true,
                            photoUrl: a.checkIn!.photoUrl!,
                            employeeName: a.employeeName,
                            type: "checkin",
                            date: a.date,
                            timeStr: fmtTime(a.checkIn!.time),
                            locationValid: a.checkIn?.locationValid,
                            distance: a.checkIn?.distance,
                            latitude: a.checkIn?.latitude,
                            longitude: a.checkIn?.longitude,
                          })
                        }
                        className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-300 relative group cursor-pointer shadow-2xs"
                        title="Klik untuk perbesar foto selfie masuk"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.checkIn.photoUrl} alt="Selfie Masuk" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Camera size={14} />
                        </div>
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-200/70 flex items-center justify-center shrink-0 text-slate-400">
                        <Camera size={18} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Absen Masuk</p>
                      <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                        {a.checkIn?.time ? fmtTime(a.checkIn.time) : "--:--"}
                      </p>
                      <div className="mt-1">
                        {a.checkIn ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              a.checkIn.locationValid
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : a.checkIn.distance !== null && a.checkIn.distance !== undefined
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            <MapPin size={10} />
                            {a.checkIn.locationValid
                              ? `Di Toko (${Math.round(a.checkIn.distance || 0)}m)`
                              : a.checkIn.distance !== null && a.checkIn.distance !== undefined
                              ? `Luar Radius (${Math.round(a.checkIn.distance)}m)`
                              : "Tanpa GPS"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold">-</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Blok Pulang */}
                  <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center gap-3">
                    {/* Thumbnail Selfie Pulang */}
                    {a.checkOut?.photoUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPhotoModalData({
                            isOpen: true,
                            photoUrl: a.checkOut!.photoUrl!,
                            employeeName: a.employeeName,
                            type: "checkout",
                            date: a.date,
                            timeStr: fmtTime(a.checkOut!.time!),
                            locationValid: a.checkOut?.locationValid,
                            distance: a.checkOut?.distance,
                            latitude: a.checkOut?.latitude,
                            longitude: a.checkOut?.longitude,
                          })
                        }
                        className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-300 relative group cursor-pointer shadow-2xs"
                        title="Klik untuk perbesar foto selfie pulang"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.checkOut.photoUrl} alt="Selfie Pulang" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Camera size={14} />
                        </div>
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-200/70 flex items-center justify-center shrink-0 text-slate-400">
                        <Camera size={18} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Absen Pulang</p>
                      <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                        {a.checkOut?.time ? fmtTime(a.checkOut.time) : a.date === todayStr ? "Sedang Shift" : "--:--"}
                      </p>
                      <div className="mt-1">
                        {a.checkOut?.time ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              a.checkOut.locationValid
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : a.checkOut.distance !== null && a.checkOut.distance !== undefined
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            <MapPin size={10} />
                            {a.checkOut.locationValid
                              ? `Di Toko (${Math.round(a.checkOut.distance || 0)}m)`
                              : a.checkOut.distance !== null && a.checkOut.distance !== undefined
                              ? `Luar Radius (${Math.round(a.checkOut.distance)}m)`
                              : "Tanpa GPS"}
                          </span>
                        ) : a.date === todayStr ? (
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Aktif Bekerja
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Metrik Jam Kerja */}
                <div className="grid grid-cols-3 gap-2.5 mb-3">
                  <div className="text-center bg-slate-50 border border-slate-200/70 rounded-xl py-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Total Jam</p>
                    <p className="text-xs sm:text-sm font-black text-slate-800">
                      {a.totalHours ?? 0} <span className="text-[10px] text-slate-500 font-medium">Jam</span>
                    </p>
                  </div>
                  <div className="text-center bg-slate-50 border border-slate-200/70 rounded-xl py-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Jam Lembur</p>
                    <p className="text-xs sm:text-sm font-black text-slate-800">
                      {a.overtimeHours ?? 0} <span className="text-[10px] text-slate-500 font-medium">Jam</span>
                    </p>
                  </div>
                  <div className="text-center bg-emerald-50/70 border border-emerald-200/70 rounded-xl py-2">
                    <p className="text-[9px] font-black text-emerald-700 uppercase tracking-wide">Uang Lembur</p>
                    <p className="text-xs sm:text-sm font-black text-emerald-700">
                      {a.overtimeBonus ? `Rp ${a.overtimeBonus.toLocaleString("id-ID")}` : "-"}
                    </p>
                  </div>
                </div>

                {/* Tombol Expand Koreksi Manual */}
                <button
                  type="button"
                  onClick={() => handleExpandAtt(a)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all tap-target cursor-pointer ${
                    expandedAttId === a.id
                      ? "bg-slate-100 text-slate-800"
                      : "bg-white text-slate-500 border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  {expandedAttId === a.id ? (
                    <>
                      <ChevronUp size={14} /> Tutup Form Koreksi
                    </>
                  ) : (
                    <>
                      <Pencil size={13} /> Koreksi Jam Kerja Manual
                    </>
                  )}
                </button>

                {/* Form Koreksi Jam Manual */}
                {expandedAttId === a.id && (
                  <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 block mb-1 tracking-wide">
                          EDIT TOTAL JAM
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={editTotalHours}
                          onChange={(e) => setEditTotalHours(e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 px-3 font-bold text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 block mb-1 tracking-wide">
                          EDIT LEMBUR (JAM)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={editOvertimeHours}
                          onChange={(e) => setEditOvertimeHours(e.target.value)}
                          className="w-full h-10 rounded-xl border border-slate-200 px-3 font-bold text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 block mb-1 tracking-wide">
                          EDIT UANG LEMBUR (RP)
                        </label>
                        <input
                          type="number"
                          step="1000"
                          value={editOvertimeBonus}
                          onChange={(e) => setEditOvertimeBonus(e.target.value)}
                          className="w-full h-10 rounded-xl border border-emerald-200 px-3 font-bold text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-emerald-800 bg-emerald-50/50"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleDeleteAtt(a)}
                        disabled={deletingId === a.id}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors tap-target cursor-pointer"
                      >
                        {deletingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Hapus
                        Absen
                      </button>
                      <div className="flex w-full sm:w-auto gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedAttId(null)}
                          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white text-slate-600 font-bold text-xs border border-slate-200 hover:bg-slate-50 tap-target cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveCorrection(a)}
                          disabled={savingId === a.id}
                          className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 tap-target shadow-xs shadow-emerald-200 transition-colors cursor-pointer"
                        >
                          {savingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan
                          Koreksi
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

      {/* ── MODAL INPUT ABSEN MANUAL (PORTAL KE BODY) ── */}
      {showManualModal && mounted && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="text-slate-900" size={18} />
                <h3 className="font-extrabold text-base text-slate-900">Input Absen Manual</h3>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {manualError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
                {manualError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  Karyawan (Crew)
                </label>
                <select
                  value={manualEmpId}
                  onChange={(e) => setManualEmpId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 px-3 font-bold text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 px-3 font-bold text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    Jam Masuk
                  </label>
                  <input
                    type="time"
                    value={manualCheckIn}
                    onChange={(e) => setManualCheckIn(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 font-bold text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    Jam Pulang
                  </label>
                  <input
                    type="time"
                    value={manualCheckOut}
                    onChange={(e) => setManualCheckOut(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 font-bold text-xs bg-white text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs tap-target cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={manualSubmitting}
                className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md tap-target cursor-pointer"
              >
                {manualSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan Absen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL ATUR LOKASI TOKO ── */}
      <StoreLocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSaved={loadData}
      />

      {/* ── MODAL LIGHTBOX FOTO SELFIE & GOOGLE MAPS ── */}
      <AttendancePhotoModal
        data={photoModalData}
        onClose={() => setPhotoModalData(null)}
      />
    </div>
  );
}
