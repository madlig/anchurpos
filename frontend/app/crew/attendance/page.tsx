"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, LogIn, LogOut, Clock, CheckCircle2, AlertTriangle, Wifi } from "lucide-react";

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
  const { user, getToken, logout } = useAuth();
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/attendance/my-status");
      if (res.ok) { const d = await res.json(); setToday(d.today); setHistory(d.history); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [fetchWithAuth]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
  }

  const hasCheckedIn = !!today;
  const hasCheckedOut = !!today?.checkOut?.time;

  function getStatusConfig() {
    if (!hasCheckedIn) return { label: "Belum Absen", sub: "Tap tombol di bawah untuk absen masuk", icon: Clock, bg: "#F8FAFC", iconBg: "#F1F5F9", iconColor: "#64748B", textColor: "#334155" };
    if (!hasCheckedOut) return { label: "Sedang Bekerja", sub: `Absen masuk pukul ${formatTime(today!.checkIn.time)}`, icon: CheckCircle2, bg: "#FEF1F5", iconBg: "#FCDCE8", iconColor: "#E85D8C", textColor: "#C94A73" };
    if (today!.status === "direview") return { label: "Sudah Pulang — Perlu Review", sub: today!.flaggedReason ?? "Mohon hubungi Manager", icon: AlertTriangle, bg: "#FFFBEB", iconBg: "#FEF3C7", iconColor: "#D97706", textColor: "#92400E" };
    return { label: "Sudah Pulang", sub: today!.totalHours ? `Total ${today!.totalHours.toFixed(1)} jam kerja` : "Terima kasih hari ini!", icon: CheckCircle2, bg: "#F0FDF4", iconBg: "#DCFCE7", iconColor: "#16A34A", textColor: "#166534" };
  }

  async function handleAction(type: "check-in" | "check-out") {
    setError(""); setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/attendance/${type}`, { method: "POST", body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal absen. Pastikan terhubung ke WiFi rumah produksi."); return; }
      await loadStatus();
    } catch { setError("Gagal menghubungi server"); } finally { setSubmitting(false); }
  }

  const sc = getStatusConfig();
  const StatusIcon = sc.icon;

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: "#E85D8C" }} /></div>;

  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="page-enter px-5 pt-6 pb-4 md:px-8 md:pt-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 max-w-2xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94A3B8" }}>{todayLabel}</p>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#1C1C1E" }}>
            Hai, {user?.displayName?.split(" ")[0] ?? "Crew"} 👋
          </h1>
        </div>
        <button onClick={logout} className="mt-1 px-3 py-1.5 rounded-xl text-xs font-semibold tap-target" style={{ background: "#F1F5F9", color: "#64748B" }} data-testid="logout-button">
          Keluar
        </button>
      </div>

      <div className="md:grid md:grid-cols-[1fr_360px] md:gap-6 max-w-5xl">
        {/* Left: Status + Action */}
        <div>
      {/* Status card */}
      <div className="rounded-3xl p-5 mb-6" style={{ background: sc.bg }} data-testid="attendance-status-card">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: sc.iconBg }}>
            <StatusIcon className="h-7 w-7" style={{ color: sc.iconColor }} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-base" style={{ color: sc.textColor }}>{sc.label}</p>
            <p className="text-sm mt-0.5 leading-snug" style={{ color: "#64748B" }}>{sc.sub}</p>
            {hasCheckedIn && hasCheckedOut && today!.totalHours !== null && today!.status === "lengkap" && today!.totalHours > 8 && (
              <span className="mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: "#E85D8C", background: "#FEF1F5" }}>
                +{(today!.totalHours - 8).toFixed(1)}j lembur
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Check-in button */}
      {!hasCheckedIn && (
        <button
          onClick={() => handleAction("check-in")}
          disabled={submitting}
          className="w-full min-h-[64px] rounded-2xl font-bold text-lg text-white flex items-center justify-center gap-3 tap-target disabled:opacity-70 mb-3"
          style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)", boxShadow: "0 8px 24px rgba(232,93,140,0.35)" }}
          data-testid="attendance-check-in-btn"
        >
          {submitting ? <Loader2 size={24} className="animate-spin" /> : <LogIn size={24} />}
          Absen Masuk
        </button>
      )}

      {/* Check-out button */}
      {hasCheckedIn && !hasCheckedOut && (
        <button
          onClick={() => handleAction("check-out")}
          disabled={submitting}
          className="w-full min-h-[64px] rounded-2xl font-bold text-lg text-white flex items-center justify-center gap-3 tap-target disabled:opacity-70 mb-3"
          style={{ background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)", boxShadow: "0 8px 24px rgba(220,38,38,0.25)" }}
          data-testid="attendance-check-out-btn"
        >
          {submitting ? <Loader2 size={24} className="animate-spin" /> : <LogOut size={24} />}
          Absen Pulang
        </button>
      )}

      {/* WiFi hint */}
      <div className="flex items-center gap-2 justify-center mb-5">
        <Wifi size={12} style={{ color: "#94A3B8" }} />
        <p className="text-xs" style={{ color: "#94A3B8" }}>Pastikan terhubung WiFi rumah produksi</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }} data-testid="attendance-error">
          <p className="text-sm font-medium" style={{ color: "#DC2626" }}>{error}</p>
        </div>
      )}
        </div>

        {/* Right: History */}
        {history.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#94A3B8" }}>Riwayat 7 Hari</p>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div
                  key={h.id}
                  className={`rounded-2xl px-4 py-3 flex items-center justify-between page-enter stagger-${Math.min(i + 1, 5)}`}
                  style={{ background: "#fff", border: "1px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                  data-testid={`history-item-${i}`}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#1C1C1E" }}>{formatDate(h.date)}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                      {formatTime(h.checkIn.time)}{h.checkOut?.time ? ` — ${formatTime(h.checkOut.time)}` : " — belum pulang"}
                    </p>
                  </div>
                  <div className="text-right">
                    {h.totalHours !== null && <p className="text-sm font-bold tabular-nums" style={{ color: "#334155" }}>{h.totalHours.toFixed(1)}j</p>}
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{
                        color: h.status === "lengkap" ? "#16A34A" : h.status === "direview" ? "#D97706" : "#64748B",
                        background: h.status === "lengkap" ? "#DCFCE7" : h.status === "direview" ? "#FEF3C7" : "#F1F5F9",
                      }}
                      data-testid={`history-status-${i}`}
                    >
                      {h.status === "lengkap" ? "Lengkap" : h.status === "direview" ? "Review" : "Belum"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
