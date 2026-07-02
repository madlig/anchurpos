"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { 
  Loader2, UserCheck, ChefHat, PackageOpen, ClipboardList, 
  Clock, Calendar
} from "lucide-react";
import { Card } from "@/components/ui/card";

interface AttendanceItem {
  time: string;
  ipAddress: string;
  ipValid: boolean;
}

interface DailyAttendance {
  id: string;
  date: string;
  checkIn: AttendanceItem | null;
  checkOut: AttendanceItem | null;
  totalHours: number | null;
  status: string;
  flaggedReason?: string | null;
}

interface AttendanceStatusResponse {
  today: DailyAttendance | null;
  history: any[];
}

export default function CrewDashboard() {
  const { user, getToken } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<AttendanceStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...opts?.headers,
      },
    });
  }, [getToken]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/attendance/my-status");
      if (res.ok) setStatus(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStatus(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadStatus();
    // Live clock
    const timer = setInterval(() => {
      const d = new Date();
      setTime(d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDate(d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    }, 1000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  async function handleCheckIn() {
    setActionLoading(true);
    try {
      const res = await fetchWithAuth("/api/attendance/check-in", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Gagal Check-in");
      } else {
        alert(data.needsReview 
          ? "Check-in berhasil diajukan! (Menunggu review manager karena berada di luar jaringan utama)"
          : "Check-in berhasil secara instan!"
        );
        loadStatus();
      }
    } catch {
      alert("Kesalahan jaringan");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!window.confirm("Apakah Anda yakin ingin Check-out (pulang) sekarang?")) return;
    setActionLoading(true);
    try {
      const res = await fetchWithAuth("/api/attendance/check-out", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Gagal Check-out");
      } else {
        alert("Check-out berhasil disimpan!");
        loadStatus();
      }
    } catch {
      alert("Kesalahan jaringan");
    } finally {
      setActionLoading(false);
    }
  }

  const MENU_ITEMS = [
    { label: "Mulai Produksi", desc: "Buat adonan & goreng churros", href: "/crew/production", icon: ChefHat, bg: "#FEF1F5", text: "#E85D8C" },
    { label: "Pre-Packing", desc: "Timbang adonan & cup saos", href: "/crew/pre-packing", icon: PackageOpen, bg: "#EFF6FF", text: "#2563EB" },
    { label: "Packing Box", desc: "Kemas churros & saos ke box", href: "/crew/packing", icon: PackageOpen, bg: "#F0FDF4", text: "#16A34A" },
    { label: "Stock Opname", desc: "Hitung & update stok fisik harian", href: "/crew/stock-opname", icon: ClipboardList, bg: "#FFFBF0", text: "#D97706" },
  ];

  const todayData = status?.today;
  const hasCheckedIn = !!todayData?.checkIn?.time;
  const hasCheckedOut = !!todayData?.checkOut?.time;
  const checkInTime = todayData?.checkIn?.time;
  const checkOutTime = todayData?.checkOut?.time;
  const ipAddress = todayData?.checkIn?.ipAddress;
  const allowedSubnet = todayData?.checkIn?.ipValid;
  const needsReview = todayData?.status === "menunggu_persetujuan" || todayData?.checkIn?.ipValid === false;

  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto space-y-5">
      {/* ── Header Welcome ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-800">Halo, {user?.displayName ?? "Crew"}! 👋</h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">Anchur Churros Workspace</p>
        </div>
        <div className="h-10 w-10 rounded-2xl flex items-center justify-center text-white font-extrabold shadow-md"
          style={{ background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)" }}>
          {(user?.displayName ?? "C")[0].toUpperCase()}
        </div>
      </div>

      {/* ── Live Clock Widget ── */}
      <div className="p-4 rounded-3xl text-white text-center relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)",
          boxShadow: "0 8px 24px rgba(232,93,140,0.25)"
        }}>
        <p className="text-xxs font-bold uppercase tracking-widest text-pink-100 opacity-80">{date || "Memuat Hari..."}</p>
        <h2 className="text-3xl font-black mt-1 tabular-nums">{time || "00:00:00"}</h2>
      </div>

      {/* ── Absensi Widget (Embed di Home) ── */}
      <Card className="p-4 rounded-3xl border-none shadow-sm space-y-4 bg-white">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
          <UserCheck className="h-4 w-4 text-pink-500" />
          <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Presensi Harian Crew</h3>
        </div>

        {loadingStatus ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-pink-500" />
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Check-In / Check-Out Timestamps */}
            <div className="grid grid-cols-2 gap-2 text-xxs font-semibold text-slate-500">
              <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Masuk</span>
                <span className="font-bold text-slate-700 text-xs mt-1">
                  {checkInTime ? new Date(checkInTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </span>
              </div>
              <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Pulang</span>
                <span className="font-bold text-slate-700 text-xs mt-1">
                  {checkOutTime ? new Date(checkOutTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </span>
              </div>
            </div>

            {/* Tombol Aksi */}
            {!hasCheckedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="w-full h-11 flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl font-bold text-xs active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <Clock size={14} />}
                Mulai Kerja (Check-In)
              </button>
            ) : !hasCheckedOut ? (
              <button
                onClick={handleCheckOut}
                disabled={actionLoading}
                className="w-full h-11 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-xs active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <Clock size={14} />}
                Selesai Kerja (Check-Out)
              </button>
            ) : (
              <div className="p-3 rounded-2xl bg-green-50 border border-green-200 text-green-700 text-center text-xs font-bold">
                ✓ Presensi Anda hari ini telah selesai dilakukan.
              </div>
            )}

            {/* Review warning */}
            {hasCheckedIn && needsReview && (
              <p className="text-[10px] text-amber-600 font-semibold text-center mt-1">
                ⚠️ Absen masuk menunggu review manager (Di luar IP Toko).
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── Fitur Kerja Grid ── */}
      <div className="space-y-2.5">
        <h3 className="text-xxs font-extrabold text-slate-500 uppercase tracking-widest pl-1">Fitur Menu Crew</h3>
        <div className="grid grid-cols-2 gap-3">
          {MENU_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Card 
                key={idx}
                onClick={() => router.push(item.href)}
                className="p-4 rounded-3xl border-none shadow-sm bg-white cursor-pointer active:scale-[0.97] transition-all flex flex-col justify-between hover:bg-slate-50 min-h-[110px]"
              >
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: item.bg, color: item.text }}>
                  <Icon size={16} />
                </div>
                <div className="mt-4">
                  <h4 className="text-xs font-bold text-slate-800">{item.label}</h4>
                  <p className="text-[9px] text-slate-400 font-semibold leading-tight mt-0.5">{item.desc}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
