"use client";

import { useParams, useRouter } from "next/navigation";
import { OrderDetailView } from "../components/OrderDetailView";
import { ArrowLeft } from "lucide-react";

export default function OrderFallbackPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  return (
    <div className="min-h-screen pb-24" style={{ background: "#FCABB4" }}>
      {/* ── Sticky Header (Glassmorphism) ── */}
      <div className="sticky top-0 z-30 pt-4 px-4 pb-4 bg-white/90 backdrop-blur-xl border-b border-pink-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/manager/orders')} 
            data-testid="back-button"
            className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center tap-target hover:bg-brand-50 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">Detail Pesanan</h1>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 md:max-w-3xl md:mx-auto">
        <OrderDetailView orderId={orderId} />
      </div>
    </div>
  );
}
