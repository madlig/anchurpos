"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Clock, CheckCircle2, AlertTriangle, Wifi } from "lucide-react";

interface TodayStatus {
  id: string; date: string;
  checkIn: { time: string; ipAddress: string; ipValid: boolean };
  checkOut: { time: string; ipAddress: string; ipValid: boolean } | null;
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
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

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

  async function handleAction(type: "check-in" | "check-out") {
    setError(""); setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/attendance/${type}`, { 
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal absen. Pastikan terhubung ke WiFi rumah produksi."); return; }
      await loadStatus();
    } catch { setError("Gagal menghubungi server"); } finally { setSubmitting(false); }
  }

  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  // Hitung sudah berapa jam sejak check-in
  const checkInTime = today?.checkIn?.time ? new Date(today.checkIn.time).getTime() : null;
  const hoursWorked = checkInTime ? (Date.now() - checkInTime) / (1000 * 60 * 60) : 0;

  // Status config for the gradient card
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

  // Button config — tombol PULANG selalu aktif
  const btnConfig = (() => {
    if (!hasCheckedIn) return { label: "MASUK", action: () => handleAction("check-in"), bg: "linear-gradient(135deg,#E85D8C,#C94A73)", shadow: "0 10px 40px rgba(232,93,140,0.4)", testId: "attendance-check-in-btn", disabled: false, subLabel: "" };
    if (!hasCheckedOut) return {
      label: "PULANG",
      action: () => {
        if (hoursWorked < 8) {
          if (window.confirm("Anda baru shift kurang dari 8 jam. Ingin diakhiri?")) {
            handleAction("check-out");
          }
        } else {
          handleAction("check-out");
        }
      },
      bg: "linear-gradient(135deg,#EF4444,#DC2626)",
      shadow: "0 10px 40px rgba(220,38,38,0.35)",
      testId: "attendance-check-out-btn",
      disabled: false,
      subLabel: hoursWorked < 8 ? `Shift berjalan: ${hoursWorked.toFixed(1)} jam (Kurang dari 8 jam)` : `Shift berjalan: ${hoursWorked.toFixed(1)} jam`,
    };
    return null;
  })();

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#FCABB4" }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} />
    </div>
  );

  return (
    <div className="page-enter min-h-screen" style={{ background: "#FCABB4" }}>

      {/* Header (white) */}
      <div className="px-5 pt-4 pb-4" style={{ background: "#fff" }}>
        <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#1C1C1E" }}>Absensi</h1>
        <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>
          {user?.displayName?.split(" ")[0] ?? "Crew"} — {todayLabel}
        </p>
      </div>

      <div className="px-4 pt-4 pb-4 md:px-8 md:max-w-2xl">

        {/* Status Card — gradient pink */}
        <div
          data-testid="attendance-status-card"
          style={{
            padding: "18px 20px",
            borderRadius: "16px",
            background: statusCard.gradient,
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", fontWeight: "500" }}>Status Hari Ini</p>
          <p style={{ fontSize: "24px", fontWeight: "700", color: "#fff", marginTop: "6px", marginBottom: "4px" }}>
            {statusCard.label}
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)" }}>{statusCard.sub}</p>
        </div>



        {/* Circular Clock-in/out Button */}
        {btnConfig && (
          <div className="flex flex-col items-center gap-3" style={{ marginBottom: "20px" }}>
            <button
              onClick={btnConfig.disabled ? undefined : btnConfig.action}
              disabled={submitting || btnConfig.disabled}
              data-testid={btnConfig.testId}
              style={{
                width: "120px", height: "120px", borderRadius: "50%",
                background: btnConfig.bg, boxShadow: btnConfig.shadow,
                border: "none", cursor: (submitting || btnConfig.disabled) ? "default" : "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                opacity: submitting ? 0.7 : 1, transition: "transform 0.15s, opacity 0.15s",
              }}
              className="tap-target"
            >
              {submitting ? (
                <Loader2 size={30} color="#fff" className="animate-spin" />
              ) : (
                <>
                  <Clock size={30} color="#fff" />
                  <span style={{ color: "#fff", fontWeight: "700", fontSize: "13px", marginTop: "6px", letterSpacing: "1px" }}>
                    {btnConfig.label}
                  </span>
                </>
              )}
            </button>
            <div className="flex items-center gap-1.5 text-center">
              <Wifi size={12} style={{ color: "#94A3B8" }} />
              <p style={{ fontSize: "11px", color: "#64748B" }}>
                {btnConfig.subLabel || `Tekan untuk absen ${btnConfig.label === "MASUK" ? "masuk" : "pulang"}`}
              </p>
            </div>
          </div>
        )}

        {/* Done state */}
        {isDone && (
          <div className="flex justify-center mb-4">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", borderRadius: "100px", background: "#fff", border: "1px solid #F1F5F9" }}>
              <CheckCircle2 size={18} style={{ color: "#16A34A" }} />
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#16A34A" }}>Absensi hari ini selesai</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "12px 14px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: "12px" }} data-testid="attendance-error">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: "#DC2626" }} />
              <p style={{ fontSize: "13px", color: "#DC2626" }}>{error}</p>
            </div>
          </div>
        )}

        {/* Log Hari Ini */}
        {today && (
          <div style={{ marginBottom: "20px" }}>
            <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E", marginBottom: "10px" }}>Log Hari Ini</p>
            <div style={{ background: "#fff", borderRadius: "14px", overflow: "hidden", border: "1px solid #F1F5F9" }}>
              <div className="flex items-center justify-between" style={{ padding: "12px 14px", borderBottom: "1px solid #F8FAFC" }}>
                <span style={{ fontSize: "13px", color: "#64748B" }}>Absen Masuk</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{formatTime(today.checkIn.time)}</span>
              </div>
              {today.checkOut && (
                <div className="flex items-center justify-between" style={{ padding: "12px 14px", borderBottom: "1px solid #F8FAFC" }}>
                  <span style={{ fontSize: "13px", color: "#64748B" }}>Absen Pulang</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{formatTime(today.checkOut.time)}</span>
                </div>
              )}
              {today.totalHours !== null && (
                <div className="flex items-center justify-between" style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: "13px", color: "#64748B" }}>Total Jam</span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#E85D8C" }}>{today.totalHours.toFixed(1)} jam</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Riwayat Absensi Bulanan */}
        <div>
          <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E", marginBottom: "10px" }}>Riwayat Absensi Bulanan</p>
          
          {/* Month picker */}
          <div className="flex items-center gap-2 mb-3">
            <button 
              onClick={() => { 
                const d = new Date(attendanceMonth + "-01"); 
                d.setMonth(d.getMonth() - 1); 
                setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); 
              }}
              style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}
            >
              ‹
            </button>
            <p style={{ flex: 1, textAlign: "center", fontSize: "13px", fontWeight: "700", color: "#1C1C1E" }}>
              {new Date(attendanceMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
            </p>
            <button 
              onClick={() => { 
                const d = new Date(attendanceMonth + "-01"); 
                d.setMonth(d.getMonth() + 1); 
                setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); 
              }}
              style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}
            >
              ›
            </button>
          </div>

          {history.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: "14px", padding: "24px 16px", textAlign: "center", border: "1px solid #F1F5F9" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: "#94A3B8" }}>Tidak ada riwayat absensi di bulan ini</p>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: "14px", overflow: "hidden", border: "1px solid #F1F5F9" }}>
              {history.map((h, i) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between"
                  style={{ padding: "12px 14px", borderBottom: i < history.length - 1 ? "1px solid #F8FAFC" : "none" }}
                  data-testid={`history-item-${i}`}
                >
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: "600", color: "#1C1C1E" }}>{formatDate(h.date)}</p>
                    <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                      {formatTime(h.checkIn.time)}{h.checkOut?.time ? ` — ${formatTime(h.checkOut.time)}` : " — belum pulang"}
                    </p>
                  </div>
                  <div className="text-right">
                    {h.totalHours !== null && (
                      <p style={{ fontSize: "13px", fontWeight: "700", color: "#334155" }}>{h.totalHours.toFixed(1)}j</p>
                    )}
                    <span
                      style={{
                        fontSize: "10px", fontWeight: "600", padding: "2px 8px", borderRadius: "100px",
                        color: h.status === "lengkap" ? "#16A34A" : h.status === "direview" ? "#D97706" : "#64748B",
                        background: h.status === "lengkap" ? "#DCFCE7" : h.status === "direview" ? "#FEF3C7" : "#F1F5F9",
                      }}
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
