"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Wifi,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Tag,
} from "lucide-react";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";

interface AttendanceConfig {
  whitelistedIps: string[];
  whitelistedSsid: string | null;
  lastDetectedIp: string | null;
  lastDetectedAt: string | null;
}

export default function ManagerSettingsPage() {
  const { getToken } = useAuth();
  const { confirm } = useAlertConfirm();
  const [config, setConfig] = useState<AttendanceConfig | null>(null);
  const [dailyLoyangTarget, setDailyLoyangTarget] = useState<number>(8);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState("");
  const [newSsid, setNewSsid] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Marketplace fee state
  const [marketplaceFees, setMarketplaceFees] = useState({ tiktok: "", shopee: "" });
  const [savingFees, setSavingFees] = useState(false);
  const [feeSaved, setFeeSaved] = useState("");

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

  const loadConfig = useCallback(async () => {
    try {
      const [res, targetRes, feeRes] = await Promise.all([
        fetchWithAuth("/api/settings/attendance"),
        fetchWithAuth("/api/settings/production"),
        fetchWithAuth("/api/settings/marketplace-fee"),
      ]);
      if (res.ok) {
        const c = await res.json();
        setConfig(c);
        setNewSsid(c.whitelistedSsid || "");
      }
      if (feeRes.ok) {
        const fees = await feeRes.json();
        setMarketplaceFees({ tiktok: String(fees.tiktok ?? 0), shopee: String(fees.shopee ?? 0) });
      }

      if (targetRes.ok) {
        const t = await targetRes.json();
        setDailyLoyangTarget(t.dailyLoyangTarget ?? 8);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  async function addIp(ip: string) {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchWithAuth("/api/settings/attendance/whitelist", {
        method: "POST",
        body: JSON.stringify({ ip }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menambah IP");
        return;
      }
      setSuccess("IP berhasil ditambahkan");
      setNewIp("");
      await loadConfig();
    } catch {
      setError("Gagal menambah IP");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeIp(ip: string) {
    const confirmed = await confirm(
      `Apakah Anda yakin ingin menghapus IP ${ip} dari whitelist?`,
      "Hapus Whitelist IP",
      { destructive: true, confirmLabel: "Ya, Hapus", cancelLabel: "Batal" }
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    try {
      const res = await fetchWithAuth("/api/settings/attendance/whitelist", {
        method: "DELETE",
        body: JSON.stringify({ ip }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Gagal menghapus IP");
        return;
      }
      setSuccess("IP berhasil dihapus");
      await loadConfig();
    } catch {
      setError("Gagal menghapus IP");
    }
  }

  async function updateTarget() {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchWithAuth("/api/settings/production", {
        method: "POST",
        body: JSON.stringify({ dailyLoyangTarget: Number(dailyLoyangTarget) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan target");
        return;
      }
      setSuccess("Target produksi berhasil disimpan");
      await loadConfig();
    } catch {
      setError("Gagal menyimpan target");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateSsid() {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetchWithAuth("/api/settings/attendance", {
        method: "POST",
        body: JSON.stringify({ whitelistedSsid: newSsid }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan SSID");
        return;
      }
      setSuccess("SSID Wi-Fi berhasil disimpan");
      await loadConfig();
    } catch {
      setError("Gagal menyimpan SSID");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-1">Pengaturan</h1>
      <p className="text-sm text-stone-500 mb-5">Manajemen Toko & Absensi</p>

      {config?.lastDetectedIp && (
        <Card className="p-4 mb-4 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                IP baru terdeteksi
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {config.lastDetectedIp}
                {config.lastDetectedAt && (
                  <span className="text-amber-500 ml-1">
                    ({new Date(config.lastDetectedAt).toLocaleString("id-ID")})
                  </span>
                )}
              </p>
              <Button
                onClick={() => addIp(config.lastDetectedIp!)}
                disabled={submitting}
                size="sm"
                className="mt-2 gap-1"
              >
                <Plus size={14} /> Approve IP ini
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Target Produksi Card */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={16} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-stone-900">
            Target Produksi Harian
          </h2>
        </div>
        <p className="text-xs text-stone-400 mb-3">
          Tentukan target jumlah cetak loyang harian untuk kru produksi.
        </p>
        <div className="flex gap-2">
          <Input
            type="number"
            min="1"
            placeholder="Target loyang harian..."
            value={dailyLoyangTarget}
            onChange={(e) => setDailyLoyangTarget(Number(e.target.value))}
            className="flex-1 text-sm font-medium"
          />
          <Button
            onClick={updateTarget}
            disabled={submitting || dailyLoyangTarget <= 0}
            size="sm"
          >
            Simpan Target
          </Button>
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={16} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-stone-900">
            Wi-Fi SSID Whitelist
          </h2>
        </div>
        <p className="text-xs text-stone-400 mb-3">
          Tentukan nama Wi-Fi (SSID) Rumah Produksi untuk membatasi lokasi absensi kru.
        </p>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="SSID Wi-Fi (misal: WiFi_Produksi)..."
            value={newSsid}
            onChange={(e) => setNewSsid(e.target.value)}
            className="flex-1 text-sm"
          />
          <Button
            onClick={updateSsid}
            disabled={submitting}
            size="sm"
          >
            Simpan SSID
          </Button>
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={16} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-stone-900">
            IP Whitelist
          </h2>
        </div>

        {config?.whitelistedIps.length === 0 && (
          <p className="text-xs text-stone-400 mb-3">
            Belum ada IP di whitelist
          </p>
        )}

        <div className="space-y-2 mb-3">
          {config?.whitelistedIps.map((ip) => (
            <div
              key={ip}
              className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-sm font-mono text-stone-700">{ip}</span>
              </div>
              <button
                onClick={() => removeIp(ip)}
                className="text-stone-400 hover:text-red-500 p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Tambah IP baru..."
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            className="flex-1 text-sm font-mono"
          />
          <Button
            onClick={() => addIp(newIp)}
            disabled={submitting || !newIp.trim()}
            size="sm"
          >
            <Plus size={14} />
          </Button>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {success && <p className="text-sm text-emerald-600 mt-2">{success}</p>}

      {/* ── Fee Platform Marketplace ── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Tag size={16} className="text-pink-500" />
          </div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>Fee Platform Marketplace</p>
            <p style={{ fontSize: "11px", color: "#94A3B8" }}>Potongan platform yang dikurangi dari pendapatan di laporan</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", display: "block", marginBottom: "4px" }}>FEE TIKTOK (%)</label>
            <Input type="number" step="0.1" min="0" max="100"
              placeholder="Contoh: 5.5"
              value={marketplaceFees.tiktok}
              onChange={e => setMarketplaceFees(p => ({ ...p, tiktok: e.target.value }))}
              className="h-10 text-sm" />
          </div>
          <div className="flex-1">
            <label style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", display: "block", marginBottom: "4px" }}>FEE SHOPEE (%)</label>
            <Input type="number" step="0.1" min="0" max="100"
              placeholder="Contoh: 3.0"
              value={marketplaceFees.shopee}
              onChange={e => setMarketplaceFees(p => ({ ...p, shopee: e.target.value }))}
              className="h-10 text-sm" />
          </div>
        </div>
        <Button
          onClick={async () => {
            setSavingFees(true);
            setFeeSaved("");
            try {
              const res = await fetchWithAuth("/api/settings/marketplace-fee", {
                method: "PATCH",
                body: JSON.stringify({ tiktok: parseFloat(marketplaceFees.tiktok) || 0, shopee: parseFloat(marketplaceFees.shopee) || 0 })
              });
              if (res.ok) setFeeSaved("Fee berhasil disimpan!");
            } finally { setSavingFees(false); }
          }}
          disabled={savingFees}
          className="w-full"
          style={{ background: "#E85D8C", color: "#fff" }}
        >
          {savingFees ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
          Simpan Fee Marketplace
        </Button>
        {feeSaved && <p style={{ fontSize: "12px", color: "#16A34A", fontWeight: "600" }}>✓ {feeSaved}</p>}
      </Card>
    </div>
  );
}
