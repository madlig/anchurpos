"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { ClipboardList } from "lucide-react";
import type { Ingredient, Variant } from "@/types";

// Import Components
import { OrderFulfillmentTab } from "./components/OrderFulfillmentTab";
import { GlazeRepackTab } from "./components/GlazeRepackTab";
import { CinnamonBlenderTab } from "./components/CinnamonBlenderTab";
import { RepackRegToFullTab } from "./components/RepackRegToFullTab";
import { ManualUsageTab } from "./components/ManualUsageTab";

export default function CrewPackingPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"pack_order" | "repack_glaze" | "repack_cinnamon" | "repack_reg_to_full" | "manual_usage">("pack_order");
  
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    });
  }, [getToken]);

  const loadInitialData = useCallback(async () => {
    try {
      const [ingRes, varRes] = await Promise.all([
        fetchWithAuth("/api/ingredients"),
        fetchWithAuth("/api/variants")
      ]);

      if (ingRes.ok) {
        const ingData: Ingredient[] = await ingRes.json();
        setIngredients(ingData);
      }
      if (varRes.ok) {
        const varData: Variant[] = await varRes.json();
        setVariants(varData.filter((v) => v.isProductionVariant));
      }
    } catch (err) {
      console.error("Gagal memuat data awal:", err);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const bulkCinnamonStock = useMemo(() => {
    return ingredients.find(i => i.id === "gula-cinnamon-bulk")?.currentStock ?? 0;
  }, [ingredients]);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#FCABB4" }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-5 rounded-b-[24px] sticky top-0 z-30 bg-white/90 backdrop-blur-xl shadow-sm border-b border-pink-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20">
            <ClipboardList size={20} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Modul Packing</h1>
        </div>
        <p className="text-xs ml-[48px] text-slate-500">
          Kelola packing pesanan, repack glaze bulk, blender gula cinnamon, bongkar regular ke full, dan pemakaian bahan.
        </p>
      </div>

      <div className="px-4 pt-4 md:px-8 max-w-4xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap bg-white/20 backdrop-blur-md rounded-2xl p-1.5 gap-1 mb-6" style={{ border: "1px solid rgba(255,255,255,0.3)", boxShadow: "0 4px 12px rgba(232,93,140,0.1)" }}>
          {[
            { key: "pack_order", label: "Pack Pesanan" },
            { key: "repack_glaze", label: "Repack Saos" },
            { key: "repack_cinnamon", label: "Repack Gula Cinnamon" },
            { key: "repack_reg_to_full", label: "Repack Regular -> Full" },
            { key: "manual_usage", label: "Pemakaian Manual" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className="flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-bold transition-all tap-target"
              style={activeTab === tab.key ? { background: "#fff", color: "#E85D8C", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" } : { color: "#fff" }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "pack_order" && (
          <OrderFulfillmentTab ingredients={ingredients} onSuccess={loadInitialData} />
        )}
        
        {activeTab === "repack_glaze" && (
          <GlazeRepackTab onSuccess={loadInitialData} />
        )}
        
        {activeTab === "repack_cinnamon" && (
          <CinnamonBlenderTab bulkCinnamonStock={bulkCinnamonStock} onSuccess={loadInitialData} />
        )}
        
        {activeTab === "repack_reg_to_full" && (
          <RepackRegToFullTab variants={variants} onSuccess={loadInitialData} />
        )}
        
        {activeTab === "manual_usage" && (
          <ManualUsageTab ingredients={ingredients} onSuccess={loadInitialData} />
        )}
      </div>
    </div>
  );
}
