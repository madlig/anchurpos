"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Wifi,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Tag,
  Package,
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

  // Inventory Keywords state
  const [inventoryKeywords, setInventoryKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [savingInventory, setSavingInventory] = useState(false);
  const [inventorySaved, setInventorySaved] = useState("");

  // POS Packaging Rules state
  const [posRules, setPosRules] = useState<Array<{ id: string; minQty: number; maxQty: number; ingredientId: string; isActive: boolean }>>([]);
  const [allIngredients, setAllIngredients] = useState<Array<{ id: string; name: string; baseUnit: string }>>([]);
  const [savingPosRules, setSavingPosRules] = useState(false);
  const [posRulesSaved, setPosRulesSaved] = useState("");

  function handleAddKeyword() {
    const val = newKeyword.trim().toLowerCase();
    if (val && !inventoryKeywords.includes(val)) {
      setInventoryKeywords([...inventoryKeywords, val]);
    }
    setNewKeyword("");
  }

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
      const [res, targetRes, feeRes, invRes, posRulesRes, ingRes] = await Promise.all([
        fetchWithAuth("/api/settings/attendance"),
        fetchWithAuth("/api/settings/production"),
        fetchWithAuth("/api/settings/marketplace-fee"),
        fetchWithAuth("/api/settings/inventory"),
        fetchWithAuth("/api/settings/pos-packaging"),
        fetchWithAuth("/api/ingredients"),
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
      
      if (invRes.ok) {
        const i = await invRes.json();
        setInventoryKeywords(i.glazeKeywords || []);
      }

      if (posRulesRes.ok) {
        const pRules = await posRulesRes.json();
        setPosRules(Array.isArray(pRules.rules) ? pRules.rules : []);
      }

      if (ingRes.ok) {
        const ings = await ingRes.json();
        setAllIngredients(Array.isArray(ings) ? ings : []);
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
    <div className="min-h-screen bg-brand-50 p-4 md:p-6 pb-28 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-1">Pengaturan</h1>
      <p className="text-sm text-slate-500 mb-5">Manajemen Toko & Absensi</p>

      {config?.lastDetectedIp && (
        <div className="bg-amber-50 rounded-3xl p-5 border border-amber-200 shadow-sm mb-5">
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
                    ({formatDateTime(config.lastDetectedAt)})
                  </span>
                )}
              </p>
              <button
                onClick={() => addIp(config.lastDetectedIp!)}
                disabled={submitting}
                className="mt-2 flex items-center justify-center gap-1 h-9 px-4 rounded-xl bg-primary text-white font-bold text-xs shadow-sm hover:bg-primary/90 transition-all"
              >
                <Plus size={14} /> Approve IP ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target Produksi Card */}
      <div className="bg-white rounded-3xl p-5 border border-primary/20 shadow-[0_0_15px_rgba(244,63,94,0.05)] mb-5 transition-all hover:border-primary/40">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={16} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Target Produksi Harian
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Tentukan target jumlah cetak loyang harian untuk kru produksi.
        </p>
        <div className="flex gap-2">
          <Input
            type="number"
            min="1"
            placeholder="Target loyang harian..."
            value={dailyLoyangTarget}
            onChange={(e) => setDailyLoyangTarget(Number(e.target.value))}
            className="flex-1 h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
          />
          <button
            onClick={updateTarget}
            disabled={submitting || dailyLoyangTarget <= 0}
            className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
          >
            Simpan Target
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-primary/20 shadow-[0_0_15px_rgba(244,63,94,0.05)] mb-5 transition-all hover:border-primary/40">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={16} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Wi-Fi SSID Whitelist
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Tentukan nama Wi-Fi (SSID) Rumah Produksi untuk membatasi lokasi absensi kru.
        </p>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="SSID Wi-Fi (misal: WiFi_Produksi)..."
            value={newSsid}
            onChange={(e) => setNewSsid(e.target.value)}
            className="flex-1 h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/20"
          />
          <button
            onClick={updateSsid}
            disabled={submitting}
            className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
          >
            Simpan SSID
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-primary/20 shadow-[0_0_15px_rgba(244,63,94,0.05)] mb-5 transition-all hover:border-primary/40">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={16} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            IP Whitelist
          </h2>
        </div>

        {config?.whitelistedIps.length === 0 && (
          <p className="text-xs text-slate-400 mb-3">
            Belum ada IP di whitelist
          </p>
        )}

        <div className="space-y-2 mb-3">
          {config?.whitelistedIps.map((ip) => (
            <div
              key={ip}
              className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-sm font-mono text-slate-700">{ip}</span>
              </div>
              <button
                onClick={() => removeIp(ip)}
                className="text-slate-400 hover:text-red-500 p-1"
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
            className="flex-1 h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 font-mono outline-none focus:ring-2 focus:ring-slate-900/20"
          />
          <button
            onClick={() => addIp(newIp)}
            disabled={submitting || !newIp.trim()}
            className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {success && <p className="text-sm text-emerald-600 mt-2">{success}</p>}

      {/* ── Fee Platform Marketplace ── */}
      <div className="bg-white rounded-3xl p-5 border border-primary/20 shadow-[0_0_15px_rgba(244,63,94,0.05)] space-y-4 transition-all hover:border-primary/40">
        <div className="flex items-center gap-2">
          <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Tag size={16} className="text-primary" />
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
        <button
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
        </button>
        {feeSaved && <p style={{ fontSize: "12px", color: "#16A34A", fontWeight: "600" }}>✓ {feeSaved}</p>}
      </div>
      {/* ── Inventaris & Repacking ── */}
      <div className="bg-white rounded-3xl p-5 border border-primary/20 shadow-[0_0_15px_rgba(244,63,94,0.05)] mb-8 space-y-4 transition-all hover:border-primary/40">
        <div className="flex items-center gap-2">
          <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={16} className="text-primary" />
          </div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>Kata Kunci Bahan Repacking</p>
            <p style={{ fontSize: "11px", color: "#94A3B8" }}>Daftar kata kunci yang membuat bahan baku muncul di dropdown Repack Saos dapur.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          {inventoryKeywords.map((kw, i) => (
            <div key={i} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold">
              <span>{kw}</span>
              <button 
                onClick={() => setInventoryKeywords(p => p.filter((_, idx) => idx !== i))}
                className="hover:text-red-500 ml-1 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {inventoryKeywords.length === 0 && <span className="text-xs text-slate-400">Belum ada kata kunci.</span>}
        </div>

        <div className="flex gap-2">
          <Input 
            type="text" 
            placeholder="Tambah kata (misal: taburan)..." 
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddKeyword();
              }
            }}
            className="flex-1 text-sm h-10 rounded-xl"
          />
          <button 
            onClick={handleAddKeyword} 
            disabled={!newKeyword.trim()} 
            className="h-10 px-4 rounded-xl flex items-center justify-center bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            <Plus size={16} />
          </button>
        </div>

        <button
          onClick={async () => {
            setSavingInventory(true);
            setInventorySaved("");
            try {
              const res = await fetchWithAuth("/api/settings/inventory", {
                method: "POST",
                body: JSON.stringify({ glazeKeywords: inventoryKeywords })
              });
              if (res.ok) setInventorySaved("Kata kunci berhasil disimpan!");
            } finally { setSavingInventory(false); }
          }}
          disabled={savingInventory}
          className="w-full h-11 rounded-xl text-sm font-bold"
          style={{ background: "#E85D8C", color: "#fff" }}
        >
          {savingInventory ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          Simpan Kata Kunci
        </button>
        {inventorySaved && <p style={{ fontSize: "12px", color: "#16A34A", fontWeight: "600" }}>✓ {inventorySaved}</p>}
      </div>

      {/* ── POS Packaging Rules Card ── */}
      <div className="bg-white rounded-3xl p-5 border border-primary/20 shadow-[0_0_15px_rgba(244,63,94,0.05)] mb-8 space-y-4 transition-all hover:border-primary/40">
        <div className="flex items-center gap-2">
          <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#FEF1F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={16} className="text-primary" />
          </div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: "700", color: "#1C1C1E" }}>Aturan Kemasan Sekunder POS (Smart Auto-Select)</p>
            <p style={{ fontSize: "11px", color: "#94A3B8" }}>Tentukan otomatisasi pemilihan kantong/kardus di Kasir berdasarkan rentang Qty order.</p>
          </div>
        </div>

        <div className="space-y-3">
          {posRules.map((rule, idx) => (
            <div key={rule.id || idx} className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 min-w-[70px]">Rentang Pack:</span>
              <Input
                type="number"
                placeholder="Min Qty"
                value={rule.minQty}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setPosRules(prev => prev.map((r, i) => i === idx ? { ...r, minQty: val } : r));
                }}
                className="w-20 h-9 text-xs font-bold bg-white"
              />
              <span className="text-xs font-bold text-slate-400">s/d</span>
              <Input
                type="number"
                placeholder="Max Qty"
                value={rule.maxQty}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setPosRules(prev => prev.map((r, i) => i === idx ? { ...r, maxQty: val } : r));
                }}
                className="w-20 h-9 text-xs font-bold bg-white"
              />
              <span className="text-xs font-bold text-slate-400">➜</span>
              <select
                value={rule.ingredientId}
                onChange={(e) => {
                  const val = e.target.value;
                  setPosRules(prev => prev.map((r, i) => i === idx ? { ...r, ingredientId: val } : r));
                }}
                className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="">-- Pilih Kantong / Kemasan --</option>
                {allIngredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.baseUnit})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPosRules(prev => prev.filter((_, i) => i !== idx))}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setPosRules(prev => [...prev, { id: `rule-${Date.now()}`, minQty: 1, maxQty: 5, ingredientId: allIngredients[0]?.id || "", isActive: true }])}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline pt-1"
          >
            <Plus size={14} /> Tambah Aturan Kemasan POS
          </button>
        </div>

        <button
          onClick={async () => {
            setSavingPosRules(true);
            setPosRulesSaved("");
            try {
              const res = await fetchWithAuth("/api/settings/pos-packaging", {
                method: "POST",
                body: JSON.stringify({ rules: posRules })
              });
              if (res.ok) setPosRulesSaved("Aturan kemasan POS berhasil disimpan!");
            } finally { setSavingPosRules(false); }
          }}
          disabled={savingPosRules}
          className="w-full h-11 rounded-xl text-sm font-bold"
          style={{ background: "#E85D8C", color: "#fff" }}
        >
          {savingPosRules ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          Simpan Aturan Kemasan POS
        </button>
        {posRulesSaved && <p style={{ fontSize: "12px", color: "#16A34A", fontWeight: "600" }}>✓ {posRulesSaved}</p>}
      </div>
    </div>
  );
}
