"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, ChefHat, Package, Calendar } from "lucide-react";
import type { Production, PrePacking, Variant } from "@/types";

export default function ManagerProductionsPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"produksi" | "prepacking">("produksi");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  
  const [productions, setProductions] = useState<Production[]>([]);
  const [prePackings, setPrePackings] = useState<PrePacking[]>([]);
  const [variants, setVariants] = useState<Record<string, Variant>>({});
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(
    async (url: string) => {
      const token = await getToken();
      return fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    [getToken]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, packRes, varRes] = await Promise.all([
        fetchWithAuth(`/api/productions?date=${date}`),
        fetchWithAuth(`/api/pre-packing?date=${date}`),
        fetchWithAuth("/api/variants"),
      ]);

      if (prodRes.ok) setProductions(await prodRes.json());
      if (packRes.ok) setPrePackings(await packRes.json());
      if (varRes.ok) {
        const vList: Variant[] = await varRes.json();
        const vMap = vList.reduce((acc, v) => ({ ...acc, [v.id]: v }), {});
        setVariants(vMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [date, fetchWithAuth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="page-enter min-h-screen pb-24" style={{ background: "#FCABB4" }}>
      {/* Header (Glassmorphism) */}
      <div className="px-5 pt-6 pb-6 bg-white/90 backdrop-blur-xl border-b border-pink-200 shadow-sm sticky top-0 z-20">
        <h1 className="text-2xl font-black mb-1" style={{ color: "#1E293B" }}>Laporan Produksi</h1>
        <p className="text-sm font-semibold text-slate-500">
          Pantau hasil produksi dan pre-packing crew
        </p>
        
        <div className="mt-5 relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl text-sm font-bold bg-slate-50 border-0 focus:ring-2 focus:ring-pink-500 transition-all text-slate-700"
          />
        </div>
      </div>

      <div className="px-5 mt-6">
        {/* Tabs */}
        <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mb-6">
          <button
            onClick={() => setActiveTab("produksi")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 tap-target ${
              activeTab === "produksi"
                ? "bg-white text-pink-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <ChefHat size={16} />
            Produksi Adonan
          </button>
          <button
            onClick={() => setActiveTab("prepacking")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 tap-target ${
              activeTab === "prepacking"
                ? "bg-white text-pink-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Package size={16} />
            Pre-Packing
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
          </div>
        ) : activeTab === "produksi" ? (
          <div className="space-y-4">
            {productions.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200">
                <ChefHat className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-500">Belum ada data produksi</p>
              </div>
            ) : (
              productions.map((p) => {
                const variant = variants[p.variantId];
                return (
                  <div key={p.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-400 mb-0.5 uppercase tracking-wider">
                          {p.variantId.toLowerCase().includes("tiktok") ? "Churros TikTok" : "Churros Standar"}
                        </p>
                        <p className="text-lg font-black text-slate-800">{variant?.name || p.variantId}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-1 rounded-lg uppercase tracking-wider">
                          {new Date(p.createdAt).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Jml Loyang</p>
                        <p className="text-2xl font-black text-slate-700">{p.loyangCount}</p>
                      </div>
                      <div className="bg-pink-50 rounded-2xl p-4">
                        <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-1">Total Pcs</p>
                        <p className="text-2xl font-black text-pink-700">{p.pcsCount || 0}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {prePackings.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200">
                <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-500">Belum ada data pre-packing</p>
              </div>
            ) : (
              prePackings.map((pack) => {
                const variant = variants[pack.variantId];
                return (
                  <div key={pack.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-400 mb-0.5 uppercase tracking-wider">
                          {pack.variantId.toLowerCase().includes("tiktok") ? "Pre-pack TikTok" : "Pre-pack Standar"}
                        </p>
                        <p className="text-lg font-black text-slate-800">{variant?.name || pack.variantId}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-1 rounded-lg uppercase tracking-wider">
                          {new Date(pack.createdAt).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3 flex justify-between items-center px-4">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Loyang Dipakai</span>
                      <span className="text-base font-black text-slate-700">{pack.totalLoyangUsed}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {!pack.variantId.toLowerCase().includes("tiktok") ? (
                        <>
                          <div className="border border-slate-100 rounded-2xl p-3 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pack Reg (12)</p>
                            <p className="text-xl font-black text-slate-700">{pack.resultRegularPacks || 0}</p>
                          </div>
                          <div className="border border-slate-100 rounded-2xl p-3 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pack Full (16)</p>
                            <p className="text-xl font-black text-slate-700">{pack.resultFullPacks || 0}</p>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 border border-slate-100 rounded-2xl p-3 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pack TikTok (12)</p>
                          <p className="text-xl font-black text-slate-700">{pack.resultRegularPacks || 0}</p>
                        </div>
                      )}
                    </div>
                    
                    {pack.leftoverPcs > 0 && (
                      <div className="bg-orange-50 rounded-xl p-2.5 text-center mt-1 border border-orange-100">
                        <p className="text-xs font-bold text-orange-700">Sisa / Reject: {pack.leftoverPcs} pcs</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
