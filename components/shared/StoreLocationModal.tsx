"use client";

import { useState, useEffect } from "react";
import { MapPin, Navigation, Save, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface StoreLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function StoreLocationModal({ isOpen, onClose, onSaved }: StoreLocationModalProps) {
  const { getToken } = useAuth();
  const [storeLat, setStoreLat] = useState<string>("");
  const [storeLng, setStoreLng] = useState<string>("");
  const [radiusMeter, setRadiusMeter] = useState<string>("100");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchConfig = async () => {
      setLoading(true);
      setFeedback(null);
      try {
        const token = await getToken();
        const res = await fetch("/api/settings/attendance", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setStoreLat(data.storeLat !== null && data.storeLat !== undefined ? String(data.storeLat) : "-6.953500");
            setStoreLng(data.storeLng !== null && data.storeLng !== undefined ? String(data.storeLng) : "107.671000");
            setRadiusMeter(data.radiusMeter !== null && data.radiusMeter !== undefined ? String(data.radiusMeter) : "100");
          }
        }
      } catch (err) {
        console.error("Gagal memuat konfigurasi lokasi:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, [isOpen, getToken]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setFeedback({ type: "error", message: "Browser Anda tidak mendukung deteksi lokasi (Geolocation API)." });
      return;
    }

    setDetecting(true);
    setFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStoreLat(pos.coords.latitude.toFixed(6));
        setStoreLng(pos.coords.longitude.toFixed(6));
        setDetecting(false);
        setFeedback({
          type: "success",
          message: `Berhasil mendeteksi titik koordinat perangkat Anda (Akurasi: ±${Math.round(pos.coords.accuracy)}m).`,
        });
      },
      (err) => {
        setDetecting(false);
        let msg = "Gagal mengambil titik GPS.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Izin akses lokasi ditolak oleh browser. Mohon aktifkan izin GPS di browser Anda.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Deteksi GPS kehabisan waktu (timeout). Coba lagi.";
        }
        setFeedback({ type: "error", message: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(storeLat);
    const lngNum = parseFloat(storeLng);
    const radiusNum = parseInt(radiusMeter, 10);

    if (isNaN(latNum) || isNaN(lngNum)) {
      setFeedback({ type: "error", message: "Koordinat Latitude dan Longitude harus berupa angka yang valid." });
      return;
    }
    if (isNaN(radiusNum) || radiusNum < 10) {
      setFeedback({ type: "error", message: "Radius toleransi minimal 10 meter." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const token = await getToken();
      const res = await fetch("/api/settings/attendance", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storeLat: latNum,
          storeLng: lngNum,
          radiusMeter: radiusNum,
        }),
      });

      if (res.ok) {
        setFeedback({ type: "success", message: "Pengaturan titik lokasi toko berhasil disimpan!" });
        if (onSaved) onSaved();
        setTimeout(() => {
          onClose();
        }, 900);
      } else {
        const errData = await res.json().catch(() => ({}));
        setFeedback({ type: "error", message: errData.error || "Gagal menyimpan lokasi toko." });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "Terjadi kesalahan jaringan saat menyimpan." });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Atur Titik Lokasi & Radius Toko</h3>
              <p className="text-[11px] text-slate-400">Pusat absensi masuk & pulang crew</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-xs font-semibold">Memuat data koordinat toko...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Feedback Alert */}
              {feedback && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 border ${
                    feedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Quick Auto-Detect Button */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-indigo-950">Sedang berada di Toko Fisik?</p>
                  <p className="text-[11px] text-indigo-700/80 mt-0.5">
                    Gunakan GPS perangkat Anda saat ini sebagai titik pusat absensi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detecting}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  {detecting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Mengambil GPS...
                    </>
                  ) : (
                    <>
                      <Navigation size={14} /> Ambil Titik Saya
                    </>
                  )}
                </button>
              </div>

              {/* Form Input Koordinat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={storeLat}
                    onChange={(e) => setStoreLat(e.target.value)}
                    placeholder="-6.953500"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={storeLng}
                    onChange={(e) => setStoreLng(e.target.value)}
                    placeholder="107.671000"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Radius Input */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                  Radius Toleransi Absensi (Meter)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={radiusMeter}
                    onChange={(e) => setRadiusMeter(e.target.value)}
                    placeholder="100"
                    required
                    className="w-full pl-3.5 pr-14 py-2.5 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Meter
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Jika crew absen di luar radius ini, status otomatis diberi catatan &apos;Luar Radius&apos;.
                </p>
              </div>

              {/* Google Maps link preview */}
              {storeLat && storeLng && !isNaN(parseFloat(storeLat)) && !isNaN(parseFloat(storeLng)) && (
                <div className="pt-1">
                  <a
                    href={`https://www.google.com/maps?q=${storeLat},${storeLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    <MapPin size={13} /> Buka Posisi Ini di Google Maps
                  </a>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs tap-target transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all tap-target cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Simpan Pengaturan
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
