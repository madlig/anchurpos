import React from "react";
import { PayrollRecord } from "@/app/manager/employees/types";
import { ShieldCheck, Clock } from "lucide-react";

interface SalarySlipDocumentProps {
  payroll: PayrollRecord;
  employeeRole?: string;
  slipNumber?: string;
  printDate?: string;
  className?: string;
}

export function fmtRupiah(num: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function terbilang(n: number): string {
  if (n === 0) return "Nol";
  const b = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  n = Math.floor(Math.abs(n));
  if (n < 12) return b[n];
  if (n < 20) return (terbilang(n - 10) + " Belas").trim();
  if (n < 100) return (terbilang(Math.floor(n / 10)) + " Puluh " + (n % 10 > 0 ? terbilang(n % 10) : "")).replace(/\s+/g, " ").trim();
  if (n < 200) return ("Seratus " + (n - 100 > 0 ? terbilang(n - 100) : "")).replace(/\s+/g, " ").trim();
  if (n < 1000) return (terbilang(Math.floor(n / 100)) + " Ratus " + (n % 100 > 0 ? terbilang(n % 100) : "")).replace(/\s+/g, " ").trim();
  if (n < 2000) return ("Seribu " + (n - 1000 > 0 ? terbilang(n - 1000) : "")).replace(/\s+/g, " ").trim();
  if (n < 1000000) return (terbilang(Math.floor(n / 1000)) + " Ribu " + (n % 1000 > 0 ? terbilang(n % 1000) : "")).replace(/\s+/g, " ").trim();
  if (n < 1000000000) return (terbilang(Math.floor(n / 1000000)) + " Juta " + (n % 1000000 > 0 ? terbilang(n % 1000000) : "")).replace(/\s+/g, " ").trim();
  return (terbilang(Math.floor(n / 1000000000)) + " Miliar " + (n % 1000000000 > 0 ? terbilang(n % 1000000000) : "")).replace(/\s+/g, " ").trim();
}

function fmtDateIndo(d: Date): string {
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function SalarySlipDocument({
  payroll,
  employeeRole = "Crew Operasional & Produksi",
  slipNumber,
  printDate,
  className = "",
}: SalarySlipDocumentProps) {
  const grossPay = (payroll.totalRegularPay || 0) + (payroll.totalOvertimeBonus || 0) + (payroll.performanceBonus || 0);
  const totalDeductions = payroll.deductions || 0;
  const netPay = payroll.totalPaid ?? (grossPay - totalDeductions);

  const cleanMonth = (payroll.month || "").replace(/[^0-9]/g, "");
  const cleanId = (payroll.employeeId || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const docNumber = slipNumber || `SLIP/${cleanMonth || "2026"}/${cleanId || "EMP"}`;
  const nowFormatted = printDate || fmtDateIndo(new Date());

  return (
    <div
      className={`salary-slip-doc bg-white text-slate-900 border-2 border-slate-900 rounded-2xl p-6 md:p-8 max-w-3xl mx-auto shadow-sm print:shadow-none print:border-slate-800 print:rounded-none print:p-6 ${className}`}
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      {/* ── HEADER KOP DOKUMEN RESMI ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-900 pb-5 mb-5 gap-4">
        <div className="flex items-center gap-3.5">
          {/* Logo */}
          <div className="w-14 h-14 rounded-xl border border-slate-300 p-1 flex items-center justify-center shrink-0 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo Anchur" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-950 tracking-wider uppercase leading-none">
              ANCHUR BANDUNG
            </h1>
            <p className="text-[11px] font-semibold text-slate-600 mt-1">
              Operasional Kasir & Penggajian
            </p>
            <p className="text-[10px] font-extrabold text-brand-700 uppercase tracking-widest mt-1">
              SLIP GAJI RESMI KARYAWAN
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
          <p className="text-xs font-mono font-black text-slate-950 tracking-tight">{docNumber}</p>
          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
            Bulan: <span className="font-bold text-slate-800">{payroll.month}</span>
          </p>
          <p className="text-[11px] text-slate-500 font-semibold">
            Tgl Cetak: <span className="text-slate-800">{nowFormatted}</span>
          </p>
          <div className="mt-1.5 inline-block">
            {payroll.isLocked ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                <ShieldCheck size={11} className="text-emerald-700" /> RESMI / SUDAH DIBAYAR
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                <Clock size={11} className="text-amber-700" /> DRAFT ESTIMASI BERJALAN
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── IDENTITAS KARYAWAN & PERIODE KERJA ── */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nama Karyawan</span>
          <span className="font-extrabold text-slate-900 text-sm mt-0.5 block truncate">
            {payroll.employeeName || "-"}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Jabatan / Role</span>
          <span className="font-bold text-slate-800 mt-0.5 block truncate">
            {employeeRole}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Periode Kehadiran</span>
          <span className="font-bold text-slate-800 mt-0.5 block truncate">
            {payroll.workPeriod || "Cutoff 29 - 28"}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Kehadiran Efektif</span>
          <span className="font-black text-slate-950 mt-0.5 block">
            {payroll.workDays} Hari Kerja
          </span>
        </div>
      </div>

      {/* ── RINCIAN PEMBUKUAN (2 KOLOM: PENERIMAAN VS POTONGAN) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Kolom Kiri: Penerimaan / Pendapatan */}
        <div className="border border-slate-300 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 flex justify-between items-center">
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                A. PENERIMAAN (EARNINGS)
              </span>
              <span className="text-[10px] font-bold text-slate-500">NOMINAL (RP)</span>
            </div>
            <div className="p-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-slate-800">Gaji Pokok</p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {payroll.workDays} hari × {fmtRupiah(payroll.dailyWage)}
                  </p>
                </div>
                <p className="font-mono font-bold text-slate-900">{fmtRupiah(payroll.totalRegularPay)}</p>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-slate-800">Uang Lemburan</p>
                  <p className="text-[10px] text-slate-500 font-medium">Shift lembur & bonus durasi</p>
                </div>
                <p className="font-mono font-bold text-slate-900">{fmtRupiah(payroll.totalOvertimeBonus)}</p>
              </div>

              {payroll.performanceBonus > 0 && (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-emerald-800">Bonus Performa / Kerajinan</p>
                    {payroll.performanceBonusNote ? (
                      <p className="text-[10px] text-emerald-700 italic">Ket: {payroll.performanceBonusNote}</p>
                    ) : null}
                  </div>
                  <p className="font-mono font-bold text-emerald-800">+{fmtRupiah(payroll.performanceBonus)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border-t border-slate-300 px-3.5 py-2.5 flex justify-between items-center text-xs">
            <span className="font-extrabold text-slate-700">Subtotal Penerimaan</span>
            <span className="font-mono font-black text-slate-950 text-sm">{fmtRupiah(grossPay)}</span>
          </div>
        </div>

        {/* Kolom Kanan: Potongan */}
        <div className="border border-slate-300 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 flex justify-between items-center">
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                B. POTONGAN (DEDUCTIONS)
              </span>
              <span className="text-[10px] font-bold text-slate-500">NOMINAL (RP)</span>
            </div>
            <div className="p-3.5 space-y-2.5 text-xs">
              {(payroll.deductions || 0) > 0 ? (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-rose-700">Potongan Kasbon / Pinjaman</p>
                    {payroll.deductionNote ? (
                      <p className="text-[10px] text-rose-600 italic">Ket: {payroll.deductionNote}</p>
                    ) : null}
                  </div>
                  <p className="font-mono font-bold text-rose-700">-{fmtRupiah(payroll.deductions || 0)}</p>
                </div>
              ) : (
                <div className="py-4 text-center text-slate-400 italic text-[11px]">
                  Tidak ada potongan gaji pada periode ini.
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border-t border-slate-300 px-3.5 py-2.5 flex justify-between items-center text-xs">
            <span className="font-extrabold text-slate-700">Subtotal Potongan</span>
            <span className="font-mono font-black text-rose-700 text-sm">
              {totalDeductions > 0 ? `-${fmtRupiah(totalDeductions)}` : "Rp 0"}
            </span>
          </div>
        </div>
      </div>

      {/* ── HIGHLIGHT TAKE HOME PAY & TERBILANG ── */}
      <div className="border-2 border-slate-900 bg-slate-50 rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase text-slate-500 block">
              TOTAL GAJI BERSIH (TAKE HOME PAY)
            </span>
            <div className="mt-1 text-xs font-semibold text-slate-700 italic">
              # {terbilang(netPay)} Rupiah #
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <span className="font-mono text-2xl sm:text-3xl font-black text-slate-950 tracking-tight block">
              {fmtRupiah(netPay)}
            </span>
          </div>
        </div>
      </div>

      {/* ── PENGESAHAN TANDA TANGAN ── */}
      <div className="pt-2 grid grid-cols-2 gap-8 text-center text-xs border-t border-slate-200">
        <div>
          <p className="text-slate-500 font-semibold mb-14">Penerima (Karyawan),</p>
          <div className="border-b border-slate-800 w-3/4 mx-auto"></div>
          <p className="font-bold text-slate-900 mt-1.5">{payroll.employeeName}</p>
        </div>
        <div>
          <p className="text-slate-500 font-semibold mb-14">
            Bandung, {nowFormatted}<br />
            <span className="text-slate-600 font-bold">Diserahkan Oleh (Management),</span>
          </p>
          <div className="border-b border-slate-800 w-3/4 mx-auto"></div>
          <p className="font-bold text-slate-900 mt-1.5">Manager / Owner AnchurPOS</p>
        </div>
      </div>

      {/* ── FOOTER DISCLAIMER ── */}
      <div className="mt-6 pt-3 border-t border-dashed border-slate-300 text-center">
        <p className="text-[9px] text-slate-400 font-medium">
          Dokumen ini diterbitkan secara otomatis oleh sistem AnchurPOS dan sah sebagai bukti pembayaran upah kerja resmi tanpa memerlukan stempel basah.
        </p>
      </div>
    </div>
  );
}
