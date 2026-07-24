"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Loader2, Package, ArrowRight } from "lucide-react";

interface Ingredient {
  id: string;
  name: string;
  baseUnit: string;
}

interface Addon {
  id: string;
  name: string;
  price: number;
}

interface Props {
  onSuccess: () => void;
}

export function GlazeRepackTab({ onSuccess }: Props) {
  const { getToken } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [keywords, setKeywords] = useState<string[]>(["glaze", "saus", "jam", "selai", "krim", "cream", "curah"]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    glazeId: "",
    glazeQty: "",
    cupId: "",
    cupQty: "",
    sauceId: "",
    yieldQty: "",
  });

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/ingredients").then(r => r.ok ? r.json() : []),
      fetchWithAuth("/api/addons").then(r => r.ok ? r.json() : []),
      fetchWithAuth("/api/settings/inventory").then(r => r.ok ? r.json() : null)
    ]).then(([ingData, addonData, invData]) => {
      setIngredients(Array.isArray(ingData) ? ingData : []);
      setAddons(Array.isArray(addonData) ? addonData : []);
      if (invData && Array.isArray(invData.glazeKeywords)) {
        setKeywords(invData.glazeKeywords);
      }
    }).finally(() => setLoading(false));
  }, [fetchWithAuth]);

  async function handleRepackGlaze(e: React.FormEvent) {
    e.preventDefault();
    if (!form.glazeId || !form.glazeQty || !form.cupId || !form.cupQty || !form.sauceId || !form.yieldQty) {
      setError("Semua field wajib diisi");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetchWithAuth("/api/inventory/repack-sauce", {
        method: "POST",
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Gagal melakukan repacking");
      } else {
        setSuccess("Berhasil merepack glaze! Stok telah disesuaikan.");
        setForm({ glazeId: "", glazeQty: "", cupId: "", cupQty: "", sauceId: "", yieldQty: "" });
        onSuccess();
      }
    } catch(err) {
      setError("Gagal menghubungi server");
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
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-primary/20 border-opacity-40 space-y-5">
      <div>
        <h2 className="text-sm font-extrabold text-slate-800 mb-1">Repack Saos Glaze</h2>
        <p className="text-xs text-slate-500">Pindahkan glaze curah (bulk) ke dalam kemasan cup/plastik agar siap dijual sebagai Add-on.</p>
      </div>

      {error && <div className="p-3.5 bg-red-50 text-red-600 rounded-xl text-xs font-semibold border border-red-100">{error}</div>}
      {success && <div className="p-3.5 bg-green-50 text-green-700 rounded-xl text-xs font-semibold border border-green-200">{success}</div>}

      <form onSubmit={handleRepackGlaze} className="space-y-6">
        
        {/* STEP 1: BAHAN MENTAH */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">1</span>
            Bahan yang Digunakan
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Glaze (Bulk)</label>
              <select 
                className="w-full text-sm font-medium border-slate-200 rounded-xl h-11 bg-slate-50 text-slate-800 pl-4 pr-10 appearance-none focus:border-primary/50 outline-none"
                value={form.glazeId} onChange={e => setForm({...form, glazeId: e.target.value})}
              >
                <option value="">-- Pilih Glaze --</option>
                {ingredients
                  .filter(i => {
                    if (i.category && i.category !== "bahan_baku") return false;
                    const n = i.name.toLowerCase();
                    return keywords.some(kw => n.includes(kw));
                  })
                  .map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.baseUnit})</option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Kuantitas Terpakai</label>
              <Input type="number" step="0.1" placeholder="Misal: 1000 (gram)" className="h-11 rounded-xl bg-slate-50 border-slate-200 text-sm font-medium" value={form.glazeQty} onChange={e => setForm({...form, glazeQty: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Cup / Packaging</label>
              <select 
                className="w-full text-sm font-medium border-slate-200 rounded-xl h-11 bg-slate-50 text-slate-800 pl-4 pr-10 appearance-none focus:border-primary/50 outline-none"
                value={form.cupId} onChange={e => setForm({...form, cupId: e.target.value})}
              >
                <option value="">-- Pilih Kemasan --</option>
                {ingredients
                  .filter(i => i.category === "packaging" || i.name.toLowerCase().includes("cup") || i.name.toLowerCase().includes("plastik"))
                  .map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.baseUnit})</option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Kuantitas Terpakai</label>
              <Input type="number" placeholder="Misal: 50 (pcs)" className="h-11 rounded-xl bg-slate-50 border-slate-200 text-sm font-medium" value={form.cupQty} onChange={e => setForm({...form, cupQty: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="w-8 h-8 bg-brand-50 rounded-full flex items-center justify-center text-brand-600">
            <ArrowRight size={16} className="rotate-90 md:rotate-0" />
          </div>
        </div>

        {/* STEP 2: HASIL */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-brand-600 uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">2</span>
            Hasil Jadi
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Saus (Siap Jual)</label>
              <select 
                className="w-full text-sm font-medium border-brand-200 rounded-xl h-11 bg-brand-50 text-slate-800 pl-4 pr-10 appearance-none focus:border-brand-500 outline-none"
                value={form.sauceId} onChange={e => setForm({...form, sauceId: e.target.value})}
              >
                <option value="">-- Pilih Add-on Saus --</option>
                {addons.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Jumlah Dihasilkan</label>
              <Input type="number" className="h-11 rounded-xl border-brand-200 bg-brand-50 text-sm font-medium" placeholder="Misal: 50 (pcs)" value={form.yieldQty} onChange={e => setForm({...form, yieldQty: e.target.value})} />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
          style={{
            background: "linear-gradient(135deg, #E85D8C 0%, #D84275 100%)",
            boxShadow: "0 4px 12px rgba(232,93,140,0.2)",
          }}
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Package size={18} /> Simpan Repack Saos</>}
        </button>

      </form>
    </div>
  );
}
