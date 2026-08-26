"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  LogIn,
  LogOut,
  CheckCircle,
  CheckCircle2,
  UploadCloud,
  Clock,
  Loader2,
  Camera,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Image as ImageIcon,
  CalendarDays,
  Navigation,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase-client";

interface TodayStatus {
  id: string;
  date: string;
  checkIn: { time: string; photoUrl: string | null; latitude: number | null; longitude: number | null };
  checkOut: { time: string; photoUrl: string | null; latitude: number | null; longitude: number | null } | null;
  totalHours: number | null;
  status: "belum_lengkap" | "lengkap" | "direview";
  flaggedReason: string | null;
}

interface HistoryItem {
  id: string;
  date: string;
  checkIn: { time: string; photoUrl?: string | null };
  checkOut: { time: string; photoUrl?: string | null } | null;
  totalHours: number | null;
  status: string;
}

type GeoStatus = "idle" | "locating" | "ready" | "low_accuracy" | "denied" | "timeout" | "unavailable";

export default function CrewAttendancePage() {
  const { user, getToken } = useAuth();
  const { confirm, alert } = useAlertConfirm();
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>("");
  const [error, setError] = useState("");
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingActionType, setPendingActionType] = useState<"check-in" | "check-out" | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Geolocation State Machine
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [geoErrorMsg, setGeoErrorMsg] = useState<string | null>(null);

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
      const res = await fetchWithAuth(`/api/attendance/my-status?month=${attendanceMonth}`);
      if (res.ok) {
        const d = await res.json();
        setToday(d.today);
        setHistory(d.history);
      }
    } catch (err) {
      console.error("loadStatus error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, attendanceMonth]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Eager background geolocation acquisition
  const acquireLocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoStatus("unavailable");
      setGeoErrorMsg("Perangkat tidak mendukung geolokasi");
      return;
    }

    setGeoStatus("locating");
    setGeoErrorMsg(null);

    const getPos = (opts: PositionOptions): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });
    };

    let acquiredCoords: { latitude: number; longitude: number; accuracy?: number } | null = null;

    // Phase 1: Fast network/wifi estimation (<3s timeout)
    try {
      const fastPos = await Promise.race([
        getPos({ enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("fast_timeout")), 3200)),
      ]);
      acquiredCoords = {
        latitude: fastPos.coords.latitude,
        longitude: fastPos.coords.longitude,
        accuracy: fastPos.coords.accuracy,
      };
      setGeoCoords(acquiredCoords);
      setGeoStatus(fastPos.coords.accuracy > 150 ? "low_accuracy" : "ready");
    } catch (fastErr: any) {
      if (fastErr?.code === 1) {
        // PERMISSION_DENIED
        setGeoStatus("denied");
        setGeoErrorMsg("Izin lokasi tidak diberikan");
        return;
      }
      // If fast timeout, proceed to Phase 2
    }

    // Phase 2: Accurate hardware GPS (<5.5s timeout)
    try {
      const accuratePos = await Promise.race([
        getPos({ enableHighAccuracy: true, timeout: 5500, maximumAge: 10000 }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("gps_timeout")), 6000)),
      ]);
      setGeoCoords({
        latitude: accuratePos.coords.latitude,
        longitude: accuratePos.coords.longitude,
        accuracy: accuratePos.coords.accuracy,
      });
      setGeoStatus(accuratePos.coords.accuracy > 100 ? "low_accuracy" : "ready");
    } catch (gpsErr: any) {
      if (gpsErr?.code === 1) {
        setGeoStatus("denied");
        setGeoErrorMsg("Izin lokasi tidak diberikan");
      } else if (!acquiredCoords) {
        setGeoStatus("timeout");
        setGeoErrorMsg("Sinyal GPS lemah / waktu habis");
      }
    }
  }, []);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const hasCheckedIn = !!today;
  const hasCheckedOut = !!today?.checkOut?.time;
  const isDone = hasCheckedIn && hasCheckedOut;
  const checkInTime = today?.checkIn?.time ? new Date(today.checkIn.time).getTime() : null;
  const hoursWorked = checkInTime ? (Date.now() - checkInTime) / (1000 * 60 * 60) : 0;

  const initiateAbsen = async (type: "check-in" | "check-out") => {
    if (type === "check-out" && hoursWorked < 8) {
      const confirmed = await confirm(
        "Anda baru bekerja kurang dari 8 jam. Apakah Anda yakin ingin checkout sekarang?",
        "Checkout Awal",
        { destructive: true, confirmLabel: "Ya, Pulang", cancelLabel: "Batal" }
      );
      if (!confirmed) return;
    }

    setPendingActionType(type);
    setCapturedPhoto(null);
    setError("");

    // Trigger eager location acquisition immediately
    acquireLocation();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitting(true);
    setSubmitStep("Memproses foto...");
    setError("");

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1080;
          const MAX_HEIGHT = 1080;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const resizedBase64 = canvas.toDataURL("image/jpeg", 0.7);
            setCapturedPhoto(resizedBase64);
          } else {
            setCapturedPhoto(base64data);
          }
          setSubmitting(false);
          setSubmitStep("");
        };
        img.onerror = () => {
          setCapturedPhoto(base64data);
          setSubmitting(false);
          setSubmitStep("");
        };
        img.src = base64data;
      };
      reader.onerror = () => {
        setSubmitting(false);
        setSubmitStep("");
        alert("Gagal membaca file foto.");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setSubmitting(false);
      setSubmitStep("");
      alert("Gagal memproses foto. Silakan coba lagi.");
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setPendingActionType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const submitAbsen = async () => {
    if (!pendingActionType || !capturedPhoto) return;

    setSubmitting(true);
    setError("");

    try {
      let latitude: number | null = geoCoords?.latitude ?? null;
      let longitude: number | null = geoCoords?.longitude ?? null;

      // If location is still actively locating in the background, wait at most 2.5s
      if (geoStatus === "locating" && !geoCoords && navigator.geolocation) {
        setSubmitStep("Menyinkronkan titik lokasi...");
        try {
          const quickPos = await Promise.race([
            new Promise<GeolocationPosition>((res, rej) => {
              navigator.geolocation.getCurrentPosition(res, rej, {
                timeout: 2500,
                enableHighAccuracy: false,
              });
            }),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error("quick_timeout")), 2600)),
          ]);
          latitude = quickPos.coords.latitude;
          longitude = quickPos.coords.longitude;
        } catch {
          // Proceed with null if unavailable
        }
      }

      setSubmitStep("Mengunggah foto bukti...");
      const dateStr = new Date().toISOString().split("T")[0];
      const timeMs = Date.now();
      const imageRef = ref(storage, `attendance/${user?.uid}/${dateStr}_${pendingActionType}_${timeMs}.jpg`);

      // Upload with 12s timeout guard
      await Promise.race([
        uploadString(imageRef, capturedPhoto, "data_url"),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("Batas waktu unggah foto habis. Periksa koneksi internet.")), 12000)
        ),
      ]);

      const photoUrl = await getDownloadURL(imageRef);

      setSubmitStep("Mencatat absensi...");
      const res = await fetchWithAuth(`/api/attendance/${pendingActionType}`, {
        method: "POST",
        body: JSON.stringify({ photoUrl, latitude, longitude }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Gagal memproses absen.");
      } else {
        setPendingActionType(null);
        setCapturedPhoto(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        await loadStatus();
      }
    } catch (err: any) {
      console.error("submitAbsen error:", err);
      setError(err.message || "Gagal menghubungi server");
    } finally {
      setSubmitting(false);
      setSubmitStep("");
    }
  };

  const todayLabel = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const statusCard = (() => {
    if (!hasCheckedIn)
      return {
        label: "Belum Absen",
        sub: "Siapkan kamera Anda untuk absen masuk",
        gradient: "linear-gradient(135deg,#E85D8C,#F2A0B7)",
      };
    if (!hasCheckedOut)
      return {
        label: "Sedang Bekerja",
        sub: `Masuk pukul ${formatTime(today!.checkIn.time)} · ${hoursWorked.toFixed(1)} jam`,
        gradient: "linear-gradient(135deg,#3B82F6,#2563EB)",
      };
    if (today!.status === "direview")
      return {
        label: "Perlu Review",
        sub: today!.flaggedReason ?? "Hubungi Manager",
        gradient: "linear-gradient(135deg,#F59E0B,#D97706)",
      };
    return {
      label: "Selesai",
      sub: today!.totalHours ? `Total ${today!.totalHours.toFixed(1)} jam` : "Terima kasih!",
      gradient: "linear-gradient(135deg,#10B981,#34D399)",
    };
  })();

  const btnConfig = (() => {
    if (!hasCheckedIn)
      return {
        label: "ABSEN MASUK",
        action: () => initiateAbsen("check-in"),
        bg: "linear-gradient(135deg,#0F172A,#334155)",
        icon: <LogIn size={32} />,
      };
    if (!hasCheckedOut)
      return {
        label: "ABSEN PULANG",
        action: () => initiateAbsen("check-out"),
        bg: "linear-gradient(135deg,#EF4444,#DC2626)",
        icon: <LogOut size={32} />,
      };
    return null;
  })();

  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 pb-28 px-4 pt-4 max-w-xl mx-auto space-y-4">
        <Skeleton className="h-20 w-full rounded-[20px]" />
        <Skeleton className="h-40 w-full rounded-[24px]" />
        <Skeleton className="h-20 w-full rounded-[20px]" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-28 px-4 pt-6 max-w-xl mx-auto space-y-6">
      <input
        type="file"
        accept="image/*"
        capture="user"
        ref={fileInputRef}
        onChange={handlePhotoCapture}
        className="hidden"
      />

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-[18px] bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-black shadow-sm">
          <Clock size={26} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Absensi Harian</h1>
          <p className="text-sm font-bold text-slate-500 mt-0.5">
            {user?.displayName?.split(" ")[0] ?? "Crew"} — {todayLabel}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 shadow-sm">
          <AlertTriangle size={18} className="text-rose-600 mt-0.5 shrink-0" />
          <p className="text-sm font-bold text-rose-700 leading-snug">{error}</p>
        </div>
      )}

      {capturedPhoto ? (
        <div className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center animate-in zoom-in-95 duration-300">
          <p className="text-xs font-extrabold text-slate-400 mb-4 tracking-wider uppercase">Pratinjau Foto Bukti</p>
          <div className="relative w-full aspect-[3/4] max-h-[400px] bg-slate-100 rounded-2xl overflow-hidden mb-4 border border-slate-200 shadow-inner">
            <img src={capturedPhoto} alt="Preview" className="w-full h-full object-cover" />

            {/* Dynamic Geolocation Live Status Overlay */}
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-white min-w-0">
                  {geoStatus === "locating" && (
                    <>
                      <Loader2 size={15} className="animate-spin text-amber-400 shrink-0" />
                      <span className="text-[11px] font-bold text-amber-200 truncate">Mencari koordinat GPS...</span>
                    </>
                  )}
                  {geoStatus === "ready" && (
                    <>
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span className="text-[11px] font-bold text-emerald-200 truncate">
                        Lokasi Terdeteksi {geoCoords?.accuracy ? `(±${Math.round(geoCoords.accuracy)}m)` : ""}
                      </span>
                    </>
                  )}
                  {geoStatus === "low_accuracy" && (
                    <>
                      <Navigation size={15} className="text-amber-400 shrink-0" />
                      <span className="text-[11px] font-bold text-amber-200 truncate">
                        Lokasi Estimasi {geoCoords?.accuracy ? `(±${Math.round(geoCoords.accuracy)}m)` : ""}
                      </span>
                    </>
                  )}
                  {geoStatus === "denied" && (
                    <>
                      <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                      <span className="text-[11px] font-bold text-rose-200 truncate">Izin Lokasi Ditolak</span>
                    </>
                  )}
                  {(geoStatus === "timeout" || geoStatus === "unavailable" || geoStatus === "idle") && (
                    <>
                      <MapPin size={15} className="text-amber-400 shrink-0" />
                      <span className="text-[11px] font-bold text-amber-200 truncate">
                        {geoErrorMsg ?? "GPS Tidak Terdeteksi"}
                      </span>
                    </>
                  )}
                </div>

                {geoStatus !== "ready" && geoStatus !== "locating" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      acquireLocation();
                    }}
                    className="px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[10px] font-extrabold tracking-tight shrink-0 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={10} /> Cari Ulang
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Submission progress feedback */}
          {submitting && submitStep && (
            <div className="w-full mb-3 py-2.5 px-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center gap-2">
              <Loader2 size={15} className="animate-spin text-blue-600" />
              <span className="text-xs font-bold text-blue-700">{submitStep}</span>
            </div>
          )}

          <div className="flex w-full gap-3">
            <button
              onClick={handleRetake}
              disabled={submitting}
              className="flex-1 py-4 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 tap-target hover:bg-slate-200 transition-colors"
            >
              Ulangi Foto
            </button>
            <button
              onClick={submitAbsen}
              disabled={submitting}
              className="flex-[2] py-4 rounded-xl font-black text-sm bg-blue-600 hover:bg-blue-700 text-white tap-target shadow-lg shadow-blue-200 flex justify-center items-center gap-2 transition-all active:scale-[0.98]"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
              Kirim Absen {pendingActionType === "check-in" ? "Masuk" : "Pulang"}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="p-7 rounded-[24px] text-center shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden"
          style={{ background: statusCard.gradient }}
        >
          <div className="relative z-10">
            <p className="text-[11px] text-white/80 font-extrabold tracking-widest uppercase mb-2">Status Saat Ini</p>
            <p className="text-3xl font-black text-white mb-2 tracking-tight">{statusCard.label}</p>
            <p className="text-sm text-white/90 font-medium">{statusCard.sub}</p>
          </div>

          {btnConfig && (
            <div className="mt-8 relative z-10 flex flex-col items-center">
              <button
                onClick={btnConfig.action}
                disabled={submitting}
                className="w-full h-16 rounded-2xl flex items-center justify-center gap-3 tap-target shadow-xl transition-transform active:scale-95 hover:scale-[1.02]"
                style={{ background: btnConfig.bg }}
              >
                {submitting ? (
                  <div className="flex items-center gap-2 text-white">
                    <Loader2 size={24} className="animate-spin" />
                    <span className="font-bold text-sm">{submitStep || "Memproses..."}</span>
                  </div>
                ) : (
                  <>
                    <Camera size={22} className="text-white" />
                    <span className="text-white font-black text-base tracking-wide">{btnConfig.label}</span>
                  </>
                )}
              </button>
              <p className="text-[10px] font-bold text-white/60 mt-3 text-center">
                Wajib melampirkan foto selfie secara real-time.
              </p>
            </div>
          )}
        </div>
      )}

      {isDone && !capturedPhoto && (
        <div className="flex justify-center mt-2">
          <div className="flex items-center gap-2.5 px-6 py-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <span className="text-sm font-black text-emerald-700">Absensi hari ini telah lengkap</span>
          </div>
        </div>
      )}

      {today && (
        <div className="bg-white rounded-[24px] p-5 border border-slate-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
          <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-slate-400" /> Bukti Kehadiran Hari Ini
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-300">
                {today.checkIn.photoUrl ? (
                  <img src={today.checkIn.photoUrl} alt="Check In" className="w-full h-full object-cover" />
                ) : <ImageIcon size={20} />}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Masuk</p>
                <p className="text-base font-black text-slate-800">{formatTime(today.checkIn.time)}</p>
              </div>
            </div>
            {today.checkOut && (
              <div className="flex items-center gap-4 pb-2">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-300">
                  {today.checkOut.photoUrl ? (
                    <img src={today.checkOut.photoUrl} alt="Check Out" className="w-full h-full object-cover" />
                  ) : <ImageIcon size={20} />}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pulang</p>
                  <p className="text-base font-black text-slate-800">{formatTime(today.checkOut.time)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[24px] p-5 border border-slate-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
        <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
          <CalendarDays size={16} className="text-slate-400" /> Riwayat Bulanan
        </h2>
        
        <div className="flex items-center gap-2 mb-5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
          <button 
            onClick={() => { 
              const d = new Date(attendanceMonth + "-01"); d.setMonth(d.getMonth() - 1); 
              setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); 
            }}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 tap-target shadow-sm"
          >
            ◀
          </button>
          <p className="flex-1 text-center text-sm font-black text-slate-700 tracking-wide">
            {new Date(attendanceMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
          </p>
          <button 
            onClick={() => { 
              const d = new Date(attendanceMonth + "-01"); d.setMonth(d.getMonth() + 1); 
              setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); 
            }}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 tap-target shadow-sm"
          >
            ▶
          </button>
        </div>

        {history.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center justify-center">
            <CalendarDays size={32} className="text-slate-200 mb-3" />
            <p className="text-sm font-bold text-slate-500">Belum ada riwayat</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={h.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0">
                    {h.checkIn.photoUrl ? (
                      <img src={h.checkIn.photoUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300"><ImageIcon size={14}/></div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">{formatDate(h.date)}</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                      {formatTime(h.checkIn.time)}{h.checkOut?.time ? ` — ${formatTime(h.checkOut.time)}` : " — berjalan"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {h.totalHours !== null ? (
                    <p className="text-sm font-black text-slate-800">{h.totalHours.toFixed(1)}j</p>
                  ) : (
                    <span className="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 bg-amber-100 text-amber-700">
                      LIVE
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
