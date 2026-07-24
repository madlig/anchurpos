"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ArrowLeft, Plus, CheckCircle2, ClipboardList, PackageOpen, ChefHat } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useAlertConfirm } from "@/components/shared/AlertConfirmProvider";

type TaskType = "produksi" | "pre_packing" | "stock_opname" | "umum";

export default function ManagerTasksPage() {
  const { getToken } = useAuth();
  const { alert, confirm } = useAlertConfirm();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);

  // Form State
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("umum");
  const [description, setDescription] = useState("");
  
  // Custom Data States (MVP simplified)
  const [variantId, setVariantId] = useState(""); // For Produksi
  const [batches, setBatches] = useState(1);
  const [variants, setVariants] = useState<any[]>([]);

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
    if (!title) return alert("Judul tugas harus diisi", "Error", "danger");
    if (type === "produksi" && (!variantId || batches <= 0)) {
      return alert("Pilih varian dan jumlah batch", "Error", "danger");
    }

    setLoading(true);
    try {
      const payload: any = {
        title,
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
      }

      const res = await fetchWithAuth("/api/tasks", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await alert("Tugas berhasil dikirim ke layar Crew!", "Sukses", "success");
        setTitle("");
        setDescription("");
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
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto pb-32">
      <div className="flex items-center gap-3">
        <Link href="/manager/dashboard" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-800">Work Orders (Tugas)</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">Beri instruksi harian ke Crew</p>
        </div>
      </div>

      {/* CREATE TASK FORM */}
      <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100">
        <h2 className="text-sm font-bold text-slate-800 mb-4">Buat Tugas Baru</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <button onClick={() => setType("umum")} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 ${type === 'umum' ? 'bg-primary text-white border-primary shadow-md' : 'bg-slate-50 text-slate-500'}`}>
            <ClipboardList size={20} />
            <span className="text-[10px] font-bold uppercase">Umum</span>
          </button>
          <button onClick={() => setType("produksi")} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 ${type === 'produksi' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-slate-50 text-slate-500'}`}>
            <ChefHat size={20} />
            <span className="text-[10px] font-bold uppercase">Produksi</span>
          </button>
          <button onClick={() => setType("pre_packing")} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 ${type === 'pre_packing' ? 'bg-blue-500 text-white border-blue-500 shadow-md' : 'bg-slate-50 text-slate-500'}`}>
            <PackageOpen size={20} />
            <span className="text-[10px] font-bold uppercase">Packing</span>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Judul Instruksi</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Tolong bersihkan chiller..." className="h-12 rounded-xl bg-slate-50 border-none font-medium" />
          </div>

          {type === "produksi" && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Pilih Produk (Varian)</label>
                <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="w-full h-12 rounded-xl bg-slate-50 border-none px-3 font-medium text-sm text-slate-700 outline-none">
                  <option value="">-- Pilih --</option>
                  {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Batch</label>
                <Input type="number" step="0.5" value={batches} onChange={(e) => setBatches(parseFloat(e.target.value))} className="h-12 rounded-xl bg-slate-50 border-none font-medium text-center" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Catatan Tambahan (Opsional)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Catatan ekstra..." className="h-11 rounded-xl bg-slate-50 border-none text-sm" />
          </div>

          <button onClick={handleCreate} disabled={loading} className="w-full h-12 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-95 transition-all">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={18} /> Kirim ke Crew</>}
          </button>
        </div>
      </div>

      {/* RECENT TASKS */}
      <div className="mt-8">
        <h2 className="text-sm font-bold text-slate-800 mb-4 px-1">Riwayat Tugas (Terbaru)</h2>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">Belum ada tugas yang dibuat.</p>
          ) : (
            tasks.map(t => (
              <div key={t.id} className="bg-white p-4 rounded-2xl border shadow-sm flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                      t.type === 'produksi' ? 'bg-emerald-100 text-emerald-700' :
                      t.type === 'pre_packing' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {t.type}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="font-bold text-slate-800">{t.title}</p>
                  {t.productionData && <p className="text-xs font-medium text-slate-500 mt-1">Target: {t.productionData.batches} Batch {t.productionData.variantName}</p>}
                </div>
                <div className="flex flex-col items-end">
                  {t.status === "done" ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                      <CheckCircle2 size={14} /> Selesai
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Pending</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
