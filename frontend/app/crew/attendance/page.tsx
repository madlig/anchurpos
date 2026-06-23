"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
  AlertTriangle,
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

  function getStatusInfo() {
    if (!hasCheckedIn) {
      return {
        label: "Belum Absen",
        color: "text-stone-500",
        bgColor: "bg-stone-50",
        icon: Clock,
      };
    }
    if (!hasCheckedOut) {
      return {
        label: `Sedang Bekerja sejak ${formatTime(today!.checkIn.time)}`,
        color: "text-emerald-700",
        bgColor: "bg-emerald-50",
        icon: CheckCircle2,
      };
    }
    if (today!.status === "direview") {
      return {
        label: "Sudah Pulang — Perlu Review",
        color: "text-amber-700",
        bgColor: "bg-amber-50",
        icon: AlertTriangle,
      };
    }
    return {
      label: "Sudah Pulang",
      color: "text-stone-600",
      bgColor: "bg-stone-50",
      icon: CheckCircle2,
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
            "Gagal absen. Pastikan kamu terhubung ke WiFi rumah produksi, lalu coba lagi. Kalau masih gagal, hubungi Manager."
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

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Absen</h1>
          <p className="text-sm text-stone-500">
            Halo, {user?.displayName ?? "Crew"}
          </p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          Keluar
        </button>
      </div>

      <Card className={`p-5 mb-5 ${statusInfo.bgColor}`}>
        <div className="flex items-center gap-3">
          <StatusIcon className={`h-8 w-8 ${statusInfo.color}`} />
          <div>
            <p className={`font-semibold ${statusInfo.color}`}>
              {statusInfo.label}
            </p>
            {hasCheckedIn && hasCheckedOut && today!.totalHours !== null && (
              <p className="text-sm text-stone-500 mt-0.5">
                Total: {today!.totalHours.toFixed(1)} jam
                {today!.status === "lengkap" && today!.totalHours > 8 && (
                  <span className="text-emerald-600 ml-1">
                    (+{(today!.totalHours - 8).toFixed(1)}j lembur)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </Card>

      {!hasCheckedIn && (
        <Button
          onClick={() => handleAction("check-in")}
          disabled={submitting}
          className="w-full min-h-[56px] text-lg gap-3 bg-emerald-600 hover:bg-emerald-700"
          size="lg"
        >
          {submitting ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <LogIn size={22} />
          )}
          Absen Masuk
        </Button>
      )}

      {hasCheckedIn && !hasCheckedOut && (
        <Button
          onClick={() => handleAction("check-out")}
          disabled={submitting}
          className="w-full min-h-[56px] text-lg gap-3 bg-rose-600 hover:bg-rose-700"
          size="lg"
        >
          {submitting ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <LogOut size={22} />
          )}
          Absen Pulang
        </Button>
      )}

      <p className="text-xs text-stone-400 text-center mt-2">
        Pastikan terhubung WiFi rumah produksi
      </p>

      {error && (
        <Card className="p-4 mt-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-stone-900 mb-3">
            Riwayat 7 hari terakhir
          </h2>
          <div className="space-y-2">
            {history.map((h) => (
              <Card key={h.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {formatDate(h.date)}
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatTime(h.checkIn.time)}
                      {h.checkOut?.time
                        ? ` — ${formatTime(h.checkOut.time)}`
                        : " — belum pulang"}
                    </p>
                  </div>
                  <div className="text-right">
                    {h.totalHours !== null && (
                      <p className="text-sm font-mono text-stone-700">
                        {h.totalHours.toFixed(1)}j
                      </p>
                    )}
                    <span
                      className={`text-xs ${
                        h.status === "lengkap"
                          ? "text-emerald-600"
                          : h.status === "direview"
                            ? "text-amber-600"
                            : "text-stone-400"
                      }`}
                    >
                      {h.status === "lengkap"
                        ? "Lengkap"
                        : h.status === "direview"
                          ? "Direview"
                          : "Belum lengkap"}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
