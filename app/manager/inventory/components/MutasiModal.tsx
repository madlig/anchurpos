"use client";

import { Loader2, X } from "lucide-react";

interface MutasiModalProps {
  isOpen: boolean;
  onClose: () => void;
  mutasiItemName: string;
  mutasiItemUnit: string;
  mutasiFilter: "hari" | "minggu" | "bulan";
  setMutasiFilter: (f: "hari" | "minggu" | "bulan") => void;
  mutasiDate: string;
  setMutasiDate: (d: string) => void;
  loadingMutasi: boolean;
  mutasiMovements: any[];
}

function getSourceTypeLabel(src: string) {
  if (src === "production") return "Produksi / Repack";
  if (src === "sale") return "Penjualan / POS";
  if (src === "opname") return "Stock Opname / Koreksi";
  if (src === "expense") return "Pembelian / Pengeluaran";
  return src;
}

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export function MutasiModal({
  isOpen,
  onClose,
  mutasiItemName,
  mutasiItemUnit,
  mutasiFilter,
  setMutasiFilter,
  mutasiDate,
  setMutasiDate,
  loadingMutasi,
  mutasiMovements,
}: MutasiModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        style={{ boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Kartu Stok / Mutasi</h3>
            <p className="text-xs text-slate-400 mt-0.5">{mutasiItemName} ({mutasiItemUnit})</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-white text-slate-500 shadow-sm hover:bg-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filter Section */}
        <div className="p-4 bg-brand-50 border-b border-slate-100 space-y-3">
          {/* Filter Type Selector */}
          <div className="flex gap-2">
            {(["hari", "minggu", "bulan"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setMutasiFilter(mode);
                  const now = new Date();
                  if (mode === "hari" || mode === "minggu") {
                    setMutasiDate(now.toISOString().split("T")[0]);
                  } else {
                    setMutasiDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
                  }
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                  mutasiFilter === mode
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Date Input Selector */}
          <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-400">Pilih Periode:</span>
            <input
              type={mutasiFilter === "bulan" ? "month" : "date"}
              value={mutasiDate}
              onChange={(e) => setMutasiDate(e.target.value)}
              className="flex-1 text-xs font-bold text-slate-700 outline-none bg-transparent"
            />
          </div>

          {/* Week Bounds Label for Mingguan */}
          {mutasiFilter === "minggu" && mutasiDate && (
            <p className="text-xs font-semibold text-slate-500 text-center">
              Rentang: {(() => {
                const d = new Date(mutasiDate);
                const day = d.getDay();
                const diffToMonday = day === 0 ? -6 : 1 - day;
                const monday = new Date(d);
                monday.setDate(d.getDate() + diffToMonday);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                return `${monday.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${sunday.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
              })()}
            </p>
          )}
        </div>

        {/* Modal Body / History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[300px]">
          {loadingMutasi ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <p className="text-xs text-slate-400 font-medium">Memuat mutasi...</p>
            </div>
          ) : mutasiMovements.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-1">
              <p className="text-xs font-semibold">Tidak ada data mutasi</p>
              <p className="text-xs">Silakan pilih periode atau filter yang lain</p>
            </div>
          ) : (
            mutasiMovements.map((move) => {
              const isPositive = move.changeAmount > 0;
              return (
                <div
                  key={move.id}
                  className="p-3 bg-white rounded-2xl border border-slate-100 flex items-center justify-between gap-3 text-left"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                      {getSourceTypeLabel(move.sourceType)}
                    </p>
                    <p className="text-xs font-semibold text-slate-700">{move.note || "Mutasi stok"}</p>
                    <p className="text-xs text-slate-400">
                      {fmtDate(move.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-xs font-bold"
                      style={{ color: isPositive ? "#16A34A" : "#DC2626" }}
                    >
                      {isPositive ? "+" : ""}
                      {new Intl.NumberFormat("id-ID").format(move.changeAmount)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Saldo: {new Intl.NumberFormat("id-ID").format(move.newStockAfter)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
