"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2,
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wifi,
} from "lucide-react";

interface TodayStatus {
  id: string;
  date: string;
  checkIn: { time: string; ipAddress: string; ipValid: boolean };
  checkOut: { time: string; ipAddress: string; ipValid: boolean } | null;
  totalHours: number | null;
  status: "belum_lengkap" | "lengkap" | "direview";
  flaggedReason: string | null;
}

interface HistoryItem {
  id: string;
  date: string;
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

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const token = await getToken();
      return fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
    },
    [getToken]
  );

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/attendance/my-status");
      if (res.ok) {
        const data = await res.json();
        setToday(data.today);
        setHistory(data.history);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  const hasCheckedIn = !!today;
  const hasCheckedOut = !!today?.checkOut?.time;

  function getStatusConfig() {
    if (!hasCheckedIn) {
      return {
        label: "Belum Absen",
        sub: "Tap tombol di bawah untuk absen masuk",
        icon: Clock,
        bg: "bg-stone-100",
        iconColor: "text-stone-500",
        textColor: "text-stone-700",
      };
    }
    if (!hasCheckedOut) {
      return {
        label: "Sedang Bekerja",
        sub: `Absen masuk pukul ${formatTime(today!.checkIn.time)}`,
        icon: CheckCircle2,
        bg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        textColor: "text-emerald-700",
      };
    }
    if (today!.status === "direview") {
      return {
        label: "Sudah Pulang — Perlu Review",
        sub: today!.flaggedReason ?? "Mohon hubungi Manager",
        icon: AlertTriangle,
        bg: "bg-amber-50",
        iconColor: "text-amber-600",
        textColor: "text-amber-700",
      };
    }
    return {
      label: "Sudah Pulang",
      sub: today!.totalHours ? `Total ${today!.totalHours.toFixed(1)} jam kerja` : "Terima kasih hari ini!",
      icon: CheckCircle2,
      bg: "bg-stone-100",
      iconColor: "text-stone-500",
      textColor: "text-stone-700",
    };
  }

  async function handleAction(type: "check-in" | "check-out") {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`/api/attendance/${type}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ??
            "Gagal absen. Pastikan terhubung ke WiFi rumah produksi, lalu coba lagi."
        );
        return;
      }
      await loadStatus();
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setSubmitting(false);
    }
  }

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="page-enter px-5 pt-6 pb-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-0.5">{todayLabel}</p>
          <h1 className="text-2xl font-black tracking-tight text-stone-900">
            Hai, {user?.displayName?.split(" ")[0] ?? "Crew"} 👋
          </h1>
        </div>
        <button
          onClick={logout}
          className="mt-1 px-3 py-1.5 rounded-xl bg-stone-100 text-xs font-semibold text-stone-500 hover:bg-stone-200 transition-colors tap-target"
          data-testid="logout-button"
        >
          Keluar
        </button>
      </div>

      {/* Status card */}
      <div
        className={`rounded-3xl ${statusConfig.bg} p-5 mb-6`}
        data-testid="attendance-status-card"
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/70 flex items-center justify-center shadow-sm shrink-0">
            <StatusIcon className={`h-7 w-7 ${statusConfig.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className={`font-bold text-base ${statusConfig.textColor}`}>{statusConfig.label}</p>
            <p className="text-sm text-stone-500 mt-0.5 leading-snug">{statusConfig.sub}</p>
            {hasCheckedIn && hasCheckedOut && today!.totalHours !== null && today!.status === "lengkap" && today!.totalHours > 8 && (
              <span className="mt-1 inline-block text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                +{(today!.totalHours - 8).toFixed(1)}j lembur
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {!hasCheckedIn && (
        <button
          onClick={() => handleAction("check-in")}
          disabled={submitting}
          className="w-full min-h-[64px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all tap-target mb-3 disabled:opacity-70"
          data-testid="attendance-check-in-btn"
        >
          {submitting ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <LogIn size={24} />
          )}
          Absen Masuk
        </button>
      )}

      {hasCheckedIn && !hasCheckedOut && (
        <button
          onClick={() => handleAction("check-out")}
          disabled={submitting}
          className="w-full min-h-[64px] rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-rose-500/25 active:scale-[0.98] transition-all tap-target mb-3 disabled:opacity-70"
          data-testid="attendance-check-out-btn"
        >
          {submitting ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <LogOut size={24} />
          )}
          Absen Pulang
        </button>
      )}

      {/* WiFi reminder */}
      <div className="flex items-center gap-2 justify-center mb-5">
        <Wifi size={13} className="text-stone-400" />
        <p className="text-xs text-stone-400">Pastikan terhubung WiFi rumah produksi</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 mb-4" data-testid="attendance-error">
          <p className="text-sm text-rose-700 font-medium">{error}</p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-3">
            Riwayat 7 Hari
          </p>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div
                key={h.id}
                className={`rounded-2xl bg-white border border-stone-100 shadow-sm px-4 py-3 flex items-center justify-between page-enter stagger-${Math.min(i + 1, 5)}`}
                data-testid={`history-item-${i}`}
              >
                <div>
                  <p className="text-sm font-semibold text-stone-900">{formatDate(h.date)}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {formatTime(h.checkIn.time)}
                    {h.checkOut?.time ? ` — ${formatTime(h.checkOut.time)}` : " — belum pulang"}
                  </p>
                </div>
                <div className="text-right">
                  {h.totalHours !== null && (
                    <p className="text-sm font-bold tabular-nums text-stone-700">{h.totalHours.toFixed(1)}j</p>
                  )}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      h.status === "lengkap"
                        ? "text-emerald-700 bg-emerald-100"
                        : h.status === "direview"
                          ? "text-amber-700 bg-amber-100"
                          : "text-stone-500 bg-stone-100"
                    }`}
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
  );
}
