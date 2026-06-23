"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Lock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import type { Attendance, Payroll } from "@/types";

type Tab = "absensi" | "payroll";

function getMonthStr(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(m: string) {
  const [y, mon] = m.split("-").map(Number);
  return new Date(y, mon - 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function ManagerEmployeesPage() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("absensi");
  const [month, setMonth] = useState(getMonthStr());
  const [monthOffset, setMonthOffset] = useState(0);

  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payrollList, setPayrollList] = useState<Payroll[]>([]);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setMonth(getMonthStr(monthOffset));
  }, [monthOffset]);

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

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/attendance?month=${month}`);
      if (res.ok) setAttendance(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, month]);

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/payroll?month=${month}`);
      if (res.ok) setPayrollList(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, month]);

  useEffect(() => {
    if (tab === "absensi") loadAttendance();
    else loadPayroll();
  }, [tab, month, loadAttendance, loadPayroll]);

  async function handleGenerate() {
    setGenerating(true);
    setGenResult("");
    setError("");
    try {
      const res = await fetchWithAuth("/api/payroll/generate", {
        method: "POST",
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal generate");
        return;
      }
      setGenResult(
        `Generated: ${data.generated.length}` +
          (data.skippedLocked.length ? `, Terkunci: ${data.skippedLocked.length}` : "") +
          (data.warnings.length ? ` — ${data.warnings.join("; ")}` : "")
      );
      await loadPayroll();
    } catch {
      setError("Gagal generate payroll");
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateBonus(id: string, bonus: number) {
    try {
      await fetchWithAuth(`/api/payroll/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ performanceBonus: bonus }),
      });
      await loadPayroll();
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePay(p: Payroll) {
    setError("");
    if (p.dataStatus === "parsial") {
      const ok = window.confirm(
        `Data ${p.employeeName} masih ada ${p.pendingReview} absen belum direview. Tetap bayar dengan data ini?`
      );
      if (!ok) return;
    }

    try {
      const res = await fetchWithAuth(`/api/payroll/${p.id}/pay`, {
        method: "PATCH",
        body: JSON.stringify({
          confirmedDespitePartial: p.dataStatus === "parsial",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal");
        return;
      }
      await loadPayroll();
    } catch {
      setError("Gagal update status bayar");
    }
  }

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-1">Karyawan</h1>
      <p className="text-sm text-stone-500 mb-4">Absensi & Payroll</p>

      <div className="flex gap-2 mb-4">
        {(["absensi", "payroll"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === t
                ? "bg-emerald-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {t === "absensi" ? "Absensi" : "Payroll"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setMonthOffset((o) => o - 1)}
          className="text-xs text-stone-500 hover:text-stone-700 px-2 py-1"
        >
          &larr;
        </button>
        <span className="text-sm font-medium text-stone-900 min-w-[140px] text-center">
          {formatMonthLabel(month)}
        </span>
        <button
          onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
          className="text-xs text-stone-500 hover:text-stone-700 px-2 py-1"
        >
          &rarr;
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      )}

      {!loading && tab === "absensi" && (
        <div className="space-y-2">
          {attendance.length === 0 && (
            <p className="text-sm text-stone-400 text-center py-8">
              Belum ada data absensi bulan ini
            </p>
          )}
          {attendance.map((a) => (
            <Card key={a.id} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {a.employeeName}
                  </p>
                  <p className="text-xs text-stone-500">
                    {new Date(a.date + "T00:00:00").toLocaleDateString("id-ID", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {" · "}
                    {new Date(a.checkIn.time).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {a.checkOut?.time
                      ? ` — ${new Date(a.checkOut.time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  {a.totalHours !== null && (
                    <p className="text-sm font-mono text-stone-700">
                      {a.totalHours.toFixed(1)}j
                    </p>
                  )}
                  <span
                    className={`text-xs ${
                      a.status === "lengkap"
                        ? "text-emerald-600"
                        : a.status === "direview"
                          ? "text-amber-600"
                          : "text-stone-400"
                    }`}
                  >
                    {a.status === "lengkap"
                      ? "Lengkap"
                      : a.status === "direview"
                        ? "Direview"
                        : "Belum lengkap"}
                  </span>
                </div>
              </div>
              {a.flaggedReason && (
                <p className="text-xs text-amber-600 mt-1">{a.flaggedReason}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {!loading && tab === "payroll" && (
        <>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full mb-4 gap-2"
            variant="outline"
          >
            {generating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Generate Payroll {formatMonthLabel(month)}
          </Button>

          {genResult && (
            <p className="text-sm text-emerald-600 mb-3">{genResult}</p>
          )}
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <div className="space-y-3">
            {payrollList.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-8">
                Belum ada data payroll. Klik Generate di atas.
              </p>
            )}
            {payrollList.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-stone-900">
                      {p.employeeName}
                    </p>
                    <p className="text-xs text-stone-500">
                      {p.workDays} hari kerja
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.isLocked && <Lock size={14} className="text-stone-400" />}
                    {p.dataStatus === "parsial" ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle size={12} /> Parsial
                      </span>
                    ) : (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={12} /> Final
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-600 mb-3">
                  <span>Gaji Pokok</span>
                  <span className="text-right font-mono">
                    {formatCurrency(p.totalRegularPay)}
                  </span>
                  <span>Lembur</span>
                  <span className="text-right font-mono">
                    {formatCurrency(p.totalOvertimeBonus)}
                  </span>
                  <span>Bonus</span>
                  <span className="text-right font-mono">
                    {formatCurrency(p.performanceBonus)}
                  </span>
                  <span className="font-semibold text-stone-900">Total</span>
                  <span className="text-right font-mono font-semibold text-stone-900">
                    {formatCurrency(p.totalPaid)}
                  </span>
                </div>

                {!p.isLocked && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-stone-400">
                        Bonus Tambahan
                      </label>
                      <Input
                        type="number"
                        min="0"
                        defaultValue={p.performanceBonus}
                        onBlur={(e) =>
                          handleUpdateBonus(
                            p.id,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="text-sm"
                      />
                    </div>
                    <Button
                      onClick={() => handlePay(p)}
                      size="sm"
                      className="mt-4"
                    >
                      Tandai Dibayar
                    </Button>
                  </div>
                )}

                {p.isLocked && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Sudah dibayar
                  </p>
                )}

                {p.pendingReview > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {p.pendingReview} absen masih menunggu review
                  </p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
