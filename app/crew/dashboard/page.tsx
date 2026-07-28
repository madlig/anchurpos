"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { 
  Loader2, CheckCircle2, ChevronRight, PackageOpen, ChefHat, ClipboardList, Clock
} from "lucide-react";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";

export default function CrewDashboard() {
  const { user, getToken } = useAuth();
  const router = useRouter();
  const { alert, confirm } = useAlertConfirm();
  const [status, setStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  const fetchWithAuth = useCallback(async (url: string, opts?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      cache: 'no-store', // Prevent browser/Next.js from serving stale cached data
      ...opts,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers },
    });
  }, [getToken]);

  const loadData = useCallback(async () => {
    try {
      const [statusRes, tasksRes] = await Promise.all([
        fetchWithAuth("/api/attendance/my-status"),
        fetchWithAuth("/api/tasks?status=pending")
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStatus(false);
      setLoadingTasks(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      const d = new Date();
      setTime(d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDate(d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" }));
    }, 1000);
    
    // Listen for incoming FCM messages (if app was open in foreground)
    const handleFcmMessage = () => {
      console.log("Auto-refreshing dashboard due to new FCM message");
      loadData();
    };
    window.addEventListener('fcm_message', handleFcmMessage);
    
    // FAILSAFE: Auto-poll data every 15 seconds if the app is active in foreground
    // This handles mobile browsers that aggressively block foreground WebSockets/Push Events
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    }, 15000);
    
    // Listen for app coming back to foreground (if app was in background when notif arrived)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("App resumed, refreshing data...");
        loadData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      clearInterval(timer);
      clearInterval(pollInterval);
      window.removeEventListener('fcm_message', handleFcmMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData]);

  async function handleCheckIn() {
    setActionLoading(true);
    try {
      const res = await fetchWithAuth("/api/attendance/check-in", { method: "POST" });
      const data = await res.json();
      if (!res.ok) await alert(data.error ?? "Gagal Check-in", "Absensi Gagal", "danger");
      else {
        await alert(data.needsReview ? "Check-in berhasil diajukan! (Menunggu review)" : "Check-in berhasil!", "Sukses", "success");
        window.dispatchEvent(new Event('attendance-updated'));
        loadData();
      }
    } catch {
      await alert("Kesalahan jaringan", "Error", "danger");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut() {
    const ok = await confirm("Apakah Anda yakin ingin Check-out (pulang) sekarang?", "Konfirmasi Check-out", { destructive: true, confirmLabel: "Ya, Check-out", cancelLabel: "Batal" });
    if (!ok) return;
    setActionLoading(true);
    try {
      const res = await fetchWithAuth("/api/attendance/check-out", { method: "POST" });
      const data = await res.json();
      if (!res.ok) await alert(data.error ?? "Gagal Check-out", "Absensi Gagal", "danger");
      else {
        await alert("Check-out berhasil disimpan!", "Sukses", "success");
        loadData();
      }
    } catch {
      await alert("Kesalahan jaringan", "Error", "danger");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteTask(taskId: string, type: string) {
    if (type === "stock_opname") {
      return router.push("/crew/stock-opname");
    }
    
    const ok = await confirm("Apakah Anda yakin telah menyelesaikan tugas ini?", "Konfirmasi");
    if (!ok) return;

    setActionLoading(true);
    try {
      const res = await fetchWithAuth(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" })
      });
      if (res.ok) {
        await alert("Tugas berhasil diselesaikan!", "Sukses", "success");
        loadData();
      } else {
        const data = await res.json();
        await alert(data.error || "Gagal menyelesaikan tugas", "Error", "danger");
      }
    } catch {
      await alert("Terjadi kesalahan koneksi", "Error", "danger");
    } finally {
      setActionLoading(false);
    }
  }

  const todayData = status?.today;
  const hasCheckedIn = !!todayData?.checkIn?.time;
  const hasCheckedOut = !!todayData?.checkOut?.time;

  if (loadingStatus) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }

  // JIKA BELUM ABSEN MASUK, HALAMAN FULL ABSEN MASUK
  if (!hasCheckedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary to-rose-600">
        <div className="text-white text-center mb-10">
          <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">{date}</p>
          <h1 className="text-5xl font-black tabular-nums">{time}</h1>
          <p className="mt-4 font-medium text-lg">Halo, {user?.displayName}!</p>
          <p className="opacity-80 text-sm">Silakan Absen Masuk untuk melihat tugas hari ini.</p>
        </div>
        
        <button
          onClick={handleCheckIn}
          disabled={actionLoading}
          className="w-full max-w-xs h-20 rounded-full bg-white text-primary font-black text-xl shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-80"
        >
          {actionLoading ? <Loader2 className="animate-spin" size={28} /> : "ABSEN MASUK"}
        </button>
      </div>
    );
  }

  // JIKA SUDAH ABSEN MASUK -> MUNCULKAN DAFTAR TUGAS
  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* HEADER KECIL */}
      <div className="bg-white px-5 pt-6 pb-4 rounded-b-[32px] shadow-sm mb-6 border-b border-slate-100">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{date}</p>
            <h1 className="text-lg font-black text-slate-800">Tugas Anda Hari Ini</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-primary">{time}</p>
            <p className="text-[10px] text-slate-400 font-medium">Status: Bekerja</p>
          </div>
        </div>
      </div>

      {/* DAFTAR TUGAS */}
      <div className="px-5 space-y-4 max-w-md mx-auto">
        {loadingTasks ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
            <CheckCircle2 size={48} className="mx-auto text-slate-200 mb-3" />
            <h3 className="font-bold text-slate-800">Hore! Tidak ada tugas</h3>
            <p className="text-xs text-slate-400 mt-1">Standby untuk instruksi selanjutnya.</p>
          </div>
        ) : (
          tasks.map(t => (
            <div key={t.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden transition-all hover:shadow-md">
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${t.type === 'produksi' ? 'bg-emerald-500' : t.type === 'pre_packing' ? 'bg-blue-500' : 'bg-amber-500'}`} />
              
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded-2xl ${t.type === 'produksi' ? 'bg-emerald-50 text-emerald-600' : t.type === 'pre_packing' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                  {t.type === 'produksi' ? <ChefHat size={24} /> : t.type === 'pre_packing' ? <PackageOpen size={24} /> : <ClipboardList size={24} />}
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{t.type.replace('_', ' ')}</span>
                  <h3 className="font-bold text-slate-800 text-lg leading-tight mt-0.5">{t.title}</h3>
                  {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                  {t.productionData && <p className="text-xs font-bold text-emerald-600 mt-1.5 bg-emerald-50 inline-block px-2 py-0.5 rounded-md">Target: {t.productionData.batches} Adonan {t.productionData.variantName}</p>}
                </div>
              </div>

              <button 
                onClick={() => handleCompleteTask(t.id, t.type)}
                disabled={actionLoading}
                className="mt-5 w-full h-12 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-slate-900/20 disabled:opacity-70 text-sm"
              >
                {t.type === 'stock_opname' ? "BUKA FORM OPNAME" : "LAPOR SELESAI"} <ChevronRight size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* CHECK OUT BUTTON (GHOST STYLE) */}
      <div className="px-5 mt-10 max-w-md mx-auto">
        <button 
          onClick={handleCheckOut}
          disabled={actionLoading}
          className="w-full py-4 text-xs font-bold text-slate-400 hover:text-slate-600 active:scale-95 transition-all flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-2xl bg-white/50"
        >
          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : "Selesai Kerja (Check Out)"}
        </button>
      </div>
    </div>
  );
}
