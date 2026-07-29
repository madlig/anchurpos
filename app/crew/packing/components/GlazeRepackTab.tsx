"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { SearchableSelect, SearchableOption } from "@/components/shared/SearchableSelect";

interface Ingredient {
  id: string;
  name: string;
  category?: string;
  baseUnit: string;
  currentStock?: number;
}

interface Addon {
  id: string;
  name: string;
  price: number;
  currentStock?: number;
}

interface Props {
  onSuccess: () => void;
}

export function GlazeRepackTab({ onSuccess }: Props) {
  const { getToken } = useAuth();
  const { alert } = useAlertConfirm();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [sauceId, setSauceId] = useState("");
  const [cupQtyInput, setCupQtyInput] = useState("");
  
  const [glazeId, setGlazeId] = useState("");
  const [customGlazeQty, setCustomGlazeQty] = useState("");
  const [cupId, setCupId] = useState("");
  const [customCupQty, setCustomCupQty] = useState("");

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/ingredients").then(r => r.ok ? r.json() : []),
      fetchWithAuth("/api/addons").then(r => r.ok ? r.json() : []),
    ]).then(([ingData, addonData]) => {
      const ings = Array.isArray(ingData) ? ingData : [];
      const ads = Array.isArray(addonData) ? addonData : [];
      setIngredients(ings);
      setAddons(ads);

      // Default cup selection
      const defaultCup = ings.find(i => i.name.toLowerCase().includes("cup") || i.category === "packaging")?.id || "";
      setCupId(defaultCup);
    }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  // Options for SearchableSelect
  const sauceOptions: SearchableOption[] = useMemo(() => {
    return addons.map(a => ({
      id: a.id,
      name: a.name,
      subtext: `Stok saat ini: ${a.currentStock ?? 0} pcs`
    }));
  }, [addons]);

  const glazeOptions: SearchableOption[] = useMemo(() => {
    return ingredients
      .filter(i => i.name.toLowerCase().includes("glaze") || i.id.includes("glaze"))
      .map(i => ({
        id: i.id,
        name: i.name,
        subtext: `Stok: ${i.currentStock ?? 0} ${i.baseUnit}`
      }));
  }, [ingredients]);

  const cupOptions: SearchableOption[] = useMemo(() => {
    return ingredients
      .filter(i => i.category === "packaging" || i.name.toLowerCase().includes("cup") || i.name.toLowerCase().includes("plastik"))
      .map(i => ({
        id: i.id,
        name: i.name,
        subtext: `Stok: ${i.currentStock ?? 0} ${i.baseUnit}`
      }));
  }, [ingredients]);

  // Auto-pair glaze when sauce is selected
  const handleSauceChange = (selectedId: string) => {
    setSauceId(selectedId);
    if (!selectedId) return;

    const sauce = addons.find(a => a.id === selectedId);
    if (sauce) {
      const sName = sauce.name.toLowerCase();
      // Match flavor (coklat, greentea, keju, tiramisu, vanilla, taro)
      const matchedGlaze = ingredients.find(i => {
        const iName = i.name.toLowerCase();
        if (!iName.includes("glaze")) return false;
        if (sName.includes("coklat") && iName.includes("coklat")) return true;
        if (sName.includes("green") && (iName.includes("green") || iName.includes("greentea"))) return true;
        if (sName.includes("keju") && iName.includes("keju")) return true;
        if (sName.includes("tiramisu") && iName.includes("tiramisu")) return true;
        if (sName.includes("vanilla") && iName.includes("vanilla")) return true;
        if (sName.includes("taro") && iName.includes("taro")) return true;
        return false;
      });

      if (matchedGlaze) {
        setGlazeId(matchedGlaze.id);
      }
    }
  };

  const qtyCups = parseInt(cupQtyInput) || 0;
  const isTikTok = sauceId.includes("tiktok");
  const gramsPerCup = isTikTok ? 15 : 13;
  const calculatedGlazeGrams = qtyCups * gramsPerCup;

  const finalGlazeQty = customGlazeQty !== "" ? parseFloat(customGlazeQty) || 0 : calculatedGlazeGrams;
  const finalCupQty = customCupQty !== "" ? parseFloat(customCupQty) || 0 : qtyCups;

  async function handleRepackGlaze(e: React.FormEvent) {
    e.preventDefault();
    if (!sauceId || qtyCups <= 0) {
      await alert("Pilih saos add-on dan masukkan jumlah cup > 0", "Peringatan", "danger");
      return;
    }

    if (!glazeId || !cupId) {
      await alert("Pilih Glaze Curah dan Kemasan Cup terlebih dahulu", "Peringatan", "danger");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetchWithAuth("/api/inventory/repack-sauce", {
        method: "POST",
        body: JSON.stringify({
          glazeId,
          glazeQty: finalGlazeQty,
          cupId,
          cupQty: finalCupQty,
          sauceId,
          yieldQty: qtyCups,
        })
      });
      if (!res.ok) {
        const d = await res.json();
        await alert(d.error || "Gagal melakukan repacking", "Error", "danger");
      } else {
        await alert(`Berhasil merepack ${qtyCups} cup saos! Stok telah disesuaikan.`, "Sukses!", "success");
        setSauceId("");
        setCupQtyInput("");
        setCustomGlazeQty("");
        setCustomCupQty("");
        onSuccess();
      }
    } catch(err) {
      await alert("Gagal menghubungi server", "Error", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-primary/20 border-opacity-40 space-y-6">
      <div>
        <h2 className="text-base font-extrabold text-slate-800 mb-1">Repack Saos Glaze (Curah ➔ Cup)</h2>
        <p className="text-xs font-semibold text-slate-500">
          Pilih jenis saos yang mau dibungkus dan masukkan jumlah cup. Sistem akan otomatis memotong glaze curah & cup!
        </p>
      </div>

      <form onSubmit={handleRepackGlaze} className="space-y-5">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2 block">
              1. Pilih Saos Add-On (Siap Jual)
            </label>
            <SearchableSelect
              options={sauceOptions}
              value={sauceId}
              onChange={handleSauceChange}
              placeholder="🔍 Ketik atau pilih saos (misal: Saus Glaze Coklat)..."
            />
          </div>

          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2 block">
              2. Jumlah Cup / Kemasan Yang Dibuat (pcs)
            </label>
            <Input
              type="number"
              placeholder="Masukkan jumlah cup (misal: 10)"
              value={cupQtyInput}
              onChange={(e) => setCupQtyInput(e.target.value)}
              className="h-12 rounded-2xl text-sm font-bold border-slate-200 focus-visible:ring-primary/20"
            />
          </div>
        </div>

        {sauceId && qtyCups > 0 && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-500" /> Rincian Pemotongan Stok Otomatis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Glaze Curah Terpotong</span>
                <span className="text-sm font-extrabold text-rose-600">
                  −{finalGlazeQty} gram
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">({gramsPerCup}g / cup)</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Kemasan Cup Terpotong</span>
                <span className="text-sm font-extrabold text-rose-600">
                  −{finalCupQty} pcs
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">(1 pcs / cup)</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-700 block uppercase">Stok Saus Siap Jual</span>
                <span className="text-sm font-extrabold text-emerald-700">
                  +{qtyCups} pcs
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">Siap Dijual di Kasir</span>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Override Options */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAdvanced ? "Sembunyikan Pengaturan Tingkat Lanjut" : "Atur Glaze / Cup Manual (Khusus/Advanced)"}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Glaze Curah (Bulk)</label>
                <SearchableSelect
                  options={glazeOptions}
                  value={glazeId}
                  onChange={(val) => setGlazeId(val)}
                  placeholder="Pilih Glaze Curah..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Kemasan Cup</label>
                <SearchableSelect
                  options={cupOptions}
                  value={cupId}
                  onChange={(val) => setCupId(val)}
                  placeholder="Pilih Kemasan Cup..."
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || !sauceId || qtyCups <= 0}
          className="w-full h-12 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-primary/20 bg-primary hover:bg-primary/90"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
          Simpan Repack Saos Glaze
        </button>
      </form>
    </div>
  );
}
