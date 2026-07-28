"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, CheckCircle2, ArrowLeft, ChefHat, PackageOpen, ClipboardList } from "lucide-react";
import Link from "next/link";

export default function ManagerTasksPage() {
  const { getToken } = useAuth();
  const { alert } = useAlertConfirm();

  const [tasks, setTasks] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [type, setType] = useState<"umum" | "produksi" | "pre_packing">("umum");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [variantId, setVariantId] = useState("");
  const [batches, setBatches] = useState<number>(0);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers } });
  }, [getToken]);

  const loadData = useCallback(async () => {
    try {
      const [tRes, vRes] = await Promise.all([
        fetchWithAuth("/api/tasks?limit=20"),
        fetchWithAuth("/api/variants")
      ]);
      if (tRes.ok) setTasks(await tRes.json());
      if (vRes.ok) setVariants(await vRes.json());
    } catch (e) {
      console.error(e);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    let finalTitle = title;
    
    if (type === "produksi") {
      const v = variants.find(x => x.id === variantId);
      if (!v || batches <= 0) {
        return alert("Pilih varian dan jumlah adonan", "Error", "danger");
      }
      finalTitle = `Buat ${batches} Adonan - ${v.name}`;
    } else if (type === "pre_packing") {
      const v = variants.find(x => x.id === variantId);
      if (!v || batches <= 0) {
        return alert("Pilih varian dan jumlah pack", "Error", "danger");
      }
      finalTitle = `Packing ${batches} Pack - ${v.name}`;
    }

    if (!finalTitle) return alert("Judul tugas harus diisi", "Error", "danger");

    setLoading(true);
    try {
      const payload: any = {
        title: finalTitle,
        type,
        description,
        assignedRole: "crew"
      };

      if (type === "produksi") {
        const v = variants.find(x => x.id === variantId);
        payload.productionData = {
          variantId,
          variantName: v?.name || "Produk",
          batches
        };
      } else if (type === "pre_packing") {
        const v = variants.find(x => x.id === variantId);
        payload.packingData = {
          variantId,
          variantName: v?.name || "Produk",
          targetQty: batches
        };
      }

      const res = await fetchWithAuth("/api/tasks", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await alert("Tugas berhasil dikirim ke layar Crew!", "Sukses", "success");
        setTitle("");
        setDescription("");
        setBatches(0);
        setVariantId("");
        loadData();
      } else {
        const d = await res.json();
        await alert(d.error || "Gagal membuat tugas", "Error", "danger");
      }
    } catch (e) {
      console.error(e);
      await alert("Terjadi kesalahan jaringan", "Error", "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-4 pb-32 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/manager/dashboard" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-800">Work Orders (Tugas)</h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium">Beri instruksi harian ke Crew</p>
          </div>
        </div>

        {/* CREATE TASK FORM */}
        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Buat Tugas Baru</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <button onClick={() => setType("umum")} className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${type === 'umum' ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'}`}>
              <ClipboardList size={20} />
              <span className="text-[10px] font-bold uppercase">Umum</span>
            </button>
            <button onClick={() => setType("produksi")} className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${type === 'produksi' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'}`}>
              <ChefHat size={20} />
              <span className="text-[10px] font-bold uppercase">Produksi</span>
            </button>
            <button onClick={() => setType("pre_packing")} className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${type === 'pre_packing' ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'}`}>
              <PackageOpen size={20} />
              <span className="text-[10px] font-bold uppercase">Packing</span>
            </button>
          </div>

          <div className="space-y-4">
            {type === "umum" && (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Judul Instruksi</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Tolong bersihkan chiller..." className="h-12 rounded-xl bg-slate-50 border-none font-medium focus-visible:ring-1 focus-visible:ring-slate-300" />
              </div>
            )}

            {type !== "umum" && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Pilih Produk (Varian)</label>
                  <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="w-full h-12 rounded-xl bg-slate-50 border-none px-3 font-medium text-sm text-slate-700 outline-none focus:ring-1 focus:ring-slate-300 transition-all">
                    <option value="">-- Pilih --</option>
                    {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">{type === "produksi" ? "Jml Adonan" : "Jml Pack"}</label>
                  <Input type="number" step="0.5" value={batches} onChange={(e) => setBatches(parseFloat(e.target.value))} className="h-12 rounded-xl bg-slate-50 border-none font-medium text-center focus-visible:ring-1 focus-visible:ring-slate-300" />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Catatan Tambahan (Opsional)</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Catatan ekstra..." className="h-11 rounded-xl bg-slate-50 border-none text-sm focus-visible:ring-1 focus-visible:ring-slate-300" />
            </div>

            <button onClick={handleCreate} disabled={loading} className="w-full h-12 mt-2 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-[0.98] transition-all">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={18} /> Kirim ke Crew</>}
            </button>
          </div>
        </div>

        {/* RECENT TASKS */}
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-800 mb-4 px-1">Riwayat Tugas (Terbaru)</h2>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-slate-100 flex flex-col items-center justify-center">
                <p className="text-slate-400 text-sm font-medium">Belum ada tugas yang dibuat.</p>
              </div>
            ) : (
              tasks.map(t => (
                <div key={t.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                        t.type === 'produksi' ? 'bg-emerald-100 text-emerald-700' :
                        t.type === 'pre_packing' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t.type}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">{new Date(t.createdAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="font-bold text-slate-800">{t.title}</p>
                    {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                    {t.productionData && <p className="text-xs font-semibold text-primary mt-1.5 bg-primary/5 inline-block px-2 py-1 rounded-lg">Target: {t.productionData.batches} Adonan {t.productionData.variantName}</p>}
                    {t.packingData && <p className="text-xs font-semibold text-blue-600 mt-1.5 bg-blue-50 border border-blue-100 inline-block px-2 py-1 rounded-lg">Target: {t.packingData.targetQty} Pack {t.packingData.variantName}</p>}
                  </div>
                  
                  <div className="flex flex-col items-end shrink-0 pl-4">
                    {t.status === "done" ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                          <CheckCircle2 size={14} /> Selesai
                        </span>
                        {t.completedByName && <span className="text-[10px] font-medium text-slate-400 mt-1 text-right max-w-[100px] leading-tight">Oleh: <br/><span className="text-slate-600 font-bold">{t.completedByName}</span></span>}
                      </div>
                    ) : t.type === "umum" && t.completedByList && t.completedByList.length > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100">Pending</span>
                        <div className="text-[10px] text-slate-400 font-medium text-right mt-1.5">
                          Telah dibaca: <br/>
                          <span className="text-slate-600 font-bold leading-tight">
                            {t.completedByList.map((c: any) => c.name).join(", ")}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100">Pending</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
