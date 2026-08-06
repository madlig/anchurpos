"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { ArrowLeft, Store, Globe, Info } from "lucide-react";

export default function OwnerSettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      <div className="bg-white sticky top-0 z-30 px-4 md:px-8 pt-4 pb-3 shadow-sm border-b border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/owner/more" className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 text-slate-600">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-extrabold text-slate-800">Pengaturan</h1>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-5xl mx-auto space-y-5 pt-5">
        {/* Profile */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center shrink-0">
              <span className="text-2xl font-black text-white">{(user?.displayName ?? "O")[0].toUpperCase()}</span>
            </div>
            <div>
              <p className="text-base font-extrabold text-slate-800">{user?.displayName ?? "Owner"}</p>
              <p className="text-xs text-slate-400">{user?.email ?? "owner@anchur.internal"}</p>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase mt-1 inline-block">Owner</span>
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Store size={14} className="text-primary" /> Informasi Aplikasi
          </h2>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-600">Aplikasi</span>
              <span className="font-bold text-slate-800">AnchurPOS v1.0</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-600">Role</span>
              <span className="font-bold text-rose-600">Owner (Monitoring)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-semibold text-slate-600">Domain</span>
              <span className="font-bold text-slate-800">anchur.internal</span>
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
          <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-bold mb-1">Mode Monitoring</p>
            <p className="leading-relaxed">
              Sebagai owner, Anda memiliki akses read-only untuk monitoring bisnis.
              Untuk operasional harian (POS, master data, pembelian bahan), silakan hubungi manager.
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2.5 rounded-2xl p-4 text-sm font-semibold transition-colors tap-target"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
        >
          Keluar dari Akun
        </button>
      </div>
    </div>
  );
}
