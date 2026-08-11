"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { LogIn, LogOut, CheckCircle, CheckCircle2, UploadCloud, ChevronRight, MessageSquareX, Clock, Loader2, Camera, MapPin, AlertTriangle } from "lucide-react";
import imageCompression from 'browser-image-compression';
import { Skeleton } from "@/components/ui/Skeleton";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase-client";

interface TodayStatus {
  id: string; date: string;
  checkIn: { time: string; photoUrl: string | null; latitude: number | null; longitude: number | null };
  checkOut: { time: string; photoUrl: string | null; latitude: number | null; longitude: number | null } | null;
  totalHours: number | null;
  status: "belum_lengkap" | "lengkap" | "direview";
  flaggedReason: string | null;
}
interface HistoryItem {
  id: string; date: string;
  checkIn: { time: string };
  checkOut: { time: string } | null;
  totalHours: number | null;
  status: string;
}

export default function CrewAttendancePage() {
  const { user, getToken } = useAuth();
  const { confirm } = useAlertConfirm();
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingActionType, setPendingActionType] = useState<"check-in" | "check-out" | null>(null);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/attendance/my-status?month=${attendanceMonth}`);
      if (res.ok) { const d = await res.json(); setToday(d.today); setHistory(d.history); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [fetchWithAuth, attendanceMonth]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  const hasCheckedIn = !!today;
  const hasCheckedOut = !!today?.checkOut?.time;
  const isDone = hasCheckedIn && hasCheckedOut;

  const handleBtnClick = async (type: "check-in" | "check-out") => {
    if (type === "check-out" && hoursWorked < 8) {
      const confirmed = await confirm(
        "Anda baru bekerja kurang dari 8 jam. Apakah Anda yakin ingin checkout sekarang?",
        "Checkout Awal",
        { destructive: true, confirmLabel: "Ya, Pulang", cancelLabel: "Batal" }
      );
      if (!confirmed) return;
    }
    
    setError(""); 
    setSubmitting(true);

    try {
      const res = await fetchWithAuth(`/api/attendance/${type}`, { 
         method: "POST",
         body: JSON.stringify({ photoUrl: null, latitude: null, longitude: null })
      });
      const data = await res.json();
      if (!res.ok) { 
        setError(data.error ?? "Gagal memproses absen."); 
      } else {
        await loadStatus();
      }
    } catch (err: any) { 
      setError(err.message || "Gagal menghubungi server"); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  const checkInTime = today?.checkIn?.time ? new Date(today.checkIn.time).getTime() : null;
  const hoursWorked = checkInTime ? (Date.now() - checkInTime) / (1000 * 60 * 60) : 0;

  const statusCard = (() => {
    if (!hasCheckedIn) return { label: "Belum Absen", sub: "Tap tombol di bawah untuk absen masuk", gradient: "linear-gradient(135deg,#E85D8C,#F2A0B7)" };
    if (!hasCheckedOut) return {
      label: "Sedang Bekerja",
      sub: `Masuk pukul ${formatTime(today!.checkIn.time)} · ${hoursWorked.toFixed(1)} jam`,
      gradient: "linear-gradient(135deg,#3B82F6,#2563EB)",
    };
    if (today!.status === "direview") return { label: "Perlu Review", sub: today!.flaggedReason ?? "Hubungi Manager", gradient: "linear-gradient(135deg,#F59E0B,#D97706)" };
    return { label: "Sudah Pulang", sub: today!.totalHours ? `Total ${today!.totalHours.toFixed(1)} jam` : "Terima kasih!", gradient: "linear-gradient(135deg,#22C55E,#16A34A)" };
  })();

  const btnConfig = (() => {
    if (!hasCheckedIn) return { label: "MASUK", action: () => handleBtnClick("check-in"), bg: "linear-gradient(135deg,#E85D8C,#C94A73)", shadow: "0 10px 40px rgba(232,93,140,0.4)", testId: "attendance-check-in-btn", disabled: false, subLabel: "" };
    if (!hasCheckedOut) return {
      label: "PULANG",
      action: () => handleBtnClick("check-out"),
      bg: "linear-gradient(135deg,#EF4444,#DC2626)",
      shadow: "0 10px 40px rgba(220,38,38,0.35)",
      testId: "attendance-check-out-btn",
      disabled: false,
      subLabel: hoursWorked < 8 ? `Shift berjalan: ${hoursWorked.toFixed(1)} jam (Kurang dari 8 jam)` : `Shift berjalan: ${hoursWorked.toFixed(1)} jam`,
    };
    return null;
  })();

  if (loading) return (
    <div className="min-h-screen bg-slate-50/80 pb-28 px-4 pt-4 max-w-xl mx-auto space-y-4">
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div>
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="h-32 w-full rounded-3xl" />
      <div className="flex justify-center mt-6">
        <Skeleton className="w-28 h-28 rounded-full" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/80 pb-28 px-4 pt-4 max-w-xl mx-auto space-y-4 page-enter">
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
          <Clock size={22} />
        </div>
        <div>
          <h1 className="text-base font-black text-slate-800">Absensi Crew</h1>
          <p className="text-xs font-semibold text-slate-400">
            {user?.displayName?.split(" ")[0] ?? "Crew"} — {todayLabel}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div
          data-testid="attendance-status-card"
          className="p-6 rounded-3xl text-center shadow-sm"
          style={{ background: statusCard.gradient }}
        >
          <p className="text-xs text-white/80 font-semibold">Status Hari Ini</p>
          <p className="text-3xl font-black text-white mt-1 mb-1 tracking-tight">
            {statusCard.label}
          </p>
          <p className="text-xs text-white/75 font-medium">{statusCard.sub}</p>
        </div>



        {btnConfig && (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={btnConfig.disabled ? undefined : btnConfig.action}
              disabled={submitting || btnConfig.disabled}
              data-testid={btnConfig.testId}
              className={`w-32 h-32 rounded-[2rem] flex flex-col items-center justify-center tap-target shadow-lg transition-all ${submitting ? "opacity-70 scale-95" : "hover:scale-105 active:scale-95"}`}
              style={{
                background: btnConfig.bg,
                cursor: (submitting || btnConfig.disabled) ? "default" : "pointer",
              }}
            >
              {submitting ? (
                <Loader2 size={36} className="text-white animate-spin" />
              ) : (
                <>
                  <CheckCircle size={36} className="text-white mb-1" />
                  <span className="text-white font-black text-sm uppercase tracking-wider">
                    {btnConfig.label}
                  </span>
                </>
              )}
            </button>
            <div className="flex items-center gap-1.5 text-center mt-1">
              <MapPin size={12} className="text-slate-400" />
              <p className="text-[11px] font-semibold text-slate-400">
                {btnConfig.subLabel || `Ketuk tombol di atas untuk absen`}
              </p>
            </div>
          </div>
        )}

        {isDone && (
          <div className="flex justify-center mt-2">
            <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <CheckCircle2 size={18} className="text-green-600" />
              <span className="text-sm font-bold text-green-600">Absensi hari ini selesai</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-2" data-testid="attendance-error">
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}

        {today && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <h2 className="text-sm font-black text-slate-800 mb-3">Log Hari Ini</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-400">Absen Masuk</span>
                <span className="text-sm font-black text-slate-700">{formatTime(today.checkIn.time)}</span>
              </div>
              {today.checkOut && (
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-400">Absen Pulang</span>
                  <span className="text-sm font-black text-slate-700">{formatTime(today.checkOut.time)}</span>
                </div>
              )}
              {today.totalHours !== null && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-slate-400">Total Jam</span>
                  <span className="text-base font-black text-primary">{today.totalHours.toFixed(1)} jam</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
          <h2 className="text-sm font-black text-slate-800 mb-3">Riwayat Bulanan</h2>
          
          <div className="flex items-center gap-2 mb-4 bg-slate-50 p-1.5 rounded-2xl">
            <button 
              onClick={() => { 
                const d = new Date(attendanceMonth + "-01"); 
                d.setMonth(d.getMonth() - 1); 
                setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); 
              }}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-800 active:scale-95 transition-all shadow-sm"
            >
              ◀
            </button>
            <p className="flex-1 text-center text-sm font-black text-slate-700">
              {new Date(attendanceMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
            </p>
            <button 
              onClick={() => { 
                const d = new Date(attendanceMonth + "-01"); 
                d.setMonth(d.getMonth() + 1); 
                setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); 
              }}
              className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-800 active:scale-95 transition-all shadow-sm"
            >
              ▶
            </button>
          </div>

          {history.length === 0 ? (
            <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-400">Tidak ada riwayat absensi</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((h, i) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between pb-3 border-b border-slate-100 last:border-0 last:pb-0"
                  data-testid={`history-item-${i}`}
                >
                  <div>
                    <p className="text-xs font-black text-slate-700">{formatDate(h.date)}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                      {formatTime(h.checkIn.time)}{h.checkOut?.time ? ` — ${formatTime(h.checkOut.time)}` : " — belum pulang"}
                    </p>
                  </div>
                  <div className="text-right">
                    {h.totalHours !== null && (
                      <p className="text-sm font-black text-slate-800">{h.totalHours.toFixed(1)}j</p>
                    )}
                    <span
                      className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 ${
                        h.status === "lengkap" ? "bg-green-100 text-green-700" : h.status === "direview" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}
                      data-testid={`history-status-${i}`}
                    >
                      {h.status === "lengkap" ? "Lengkap" : h.status === "direview" ? "Review" : h.status === "belum_lengkap" ? "Aktif" : h.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
