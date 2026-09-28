"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MapPin, Clock, ExternalLink, User } from "lucide-react";

export interface AttendancePhotoModalData {
  isOpen: boolean;
  photoUrl: string;
  employeeName: string;
  type: "checkin" | "checkout";
  date: string;
  timeStr: string;
  locationValid?: boolean;
  distance?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface AttendancePhotoModalProps {
  data: AttendancePhotoModalData | null;
  onClose: () => void;
}

export function AttendancePhotoModal({ data, onClose }: AttendancePhotoModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (data?.isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [data?.isOpen]);

  if (!data || !data.isOpen || !mounted) return null;

  const isCheckIn = data.type === "checkin";
  const hasCoordinates =
    data.latitude !== null && data.latitude !== undefined && data.longitude !== null && data.longitude !== undefined;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-800 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isCheckIn
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              }`}
            >
              {isCheckIn ? "Selfie Absen Masuk" : "Selfie Absen Pulang"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Big Photo Preview */}
        <div className="relative bg-slate-950 flex items-center justify-center min-h-[300px] max-h-[55vh] overflow-hidden">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.photoUrl}
              alt={`Selfie ${data.employeeName}`}
              className="w-full h-full object-contain max-h-[55vh]"
            />
          ) : (
            <div className="py-20 text-slate-500 flex flex-col items-center justify-center gap-2">
              <User size={40} className="text-slate-600" />
              <p className="text-xs font-semibold">Tidak ada foto selfie terlampir</p>
            </div>
          )}
        </div>

        {/* Verification Info Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Karyawan</p>
              <p className="text-sm font-extrabold text-slate-900">{data.employeeName}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Waktu Absen</p>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1 justify-end">
                <Clock size={12} className="text-slate-400" /> {data.timeStr}
              </p>
            </div>
          </div>

          {/* Location Badge & Maps Link */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin
                size={16}
                className={`shrink-0 ${
                  data.locationValid
                    ? "text-emerald-600"
                    : data.distance !== null && data.distance !== undefined
                    ? "text-rose-600"
                    : "text-amber-500"
                }`}
              />
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800 truncate">
                  {data.locationValid
                    ? `Di Toko (${Math.round(data.distance || 0)}m)`
                    : data.distance !== null && data.distance !== undefined
                    ? `Di Luar Radius Toko (${Math.round(data.distance)}m)`
                    : "Tanpa Koordinat GPS"}
                </p>
                {hasCoordinates ? (
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                    {data.latitude?.toFixed(5)}, {data.longitude?.toFixed(5)}
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-600 mt-0.5 font-medium">GPS tidak diaktifkan saat absen</p>
                )}
              </div>
            </div>

            {hasCoordinates && (
              <a
                href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
              >
                <ExternalLink size={12} /> Buka Maps
              </a>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
