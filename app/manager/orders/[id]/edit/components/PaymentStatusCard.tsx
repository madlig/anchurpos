import { CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  isPaid: boolean;
  setIsPaid: (val: boolean) => void;
  payMethod: string;
  setPayMethod: (val: string) => void;
  orderChannel: "walkin" | "whatsapp" | "tiktok" | "shopee";
  platformFeeOverride: string;
  setPlatformFeeOverride: (val: string) => void;
}

export function PaymentStatusCard({
  isPaid, setIsPaid, payMethod, setPayMethod,
  orderChannel, platformFeeOverride, setPlatformFeeOverride
}: Props) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100">
      <h2 className="text-sm font-bold text-slate-800 mb-3.5 pb-2.5 border-b border-slate-100">Status Pembayaran</h2>
      
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setIsPaid(true)}
          className={`flex items-center justify-center gap-1 flex-1 p-2 rounded-lg text-xs font-semibold border-none cursor-pointer ${isPaid ? "bg-green-600 text-white" : "bg-green-100 text-green-600"}`}
        >
          <CheckCircle2 size={12} /> Sudah Bayar
        </button>
        <button
          type="button"
          onClick={() => setIsPaid(false)}
          className={`flex items-center justify-center gap-1 flex-1 p-2 rounded-lg text-xs font-semibold border-none cursor-pointer ${!isPaid ? "bg-red-600 text-white" : "bg-red-100 text-red-600"}`}
        >
          <AlertCircle size={12} /> Belum Bayar
        </button>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Metode Bayar</label>
        <div className="grid grid-cols-3 gap-1.5">
          {["cash", "transfer", "qris"].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setPayMethod(m)}
              className={`p-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer ${payMethod === m ? "bg-primary text-white" : "bg-brand-50 text-slate-500"}`}
            >
              {m === "cash" ? "Tunai" : m === "transfer" ? "Transfer" : "QRIS"}
            </button>
          ))}
        </div>
      </div>

      {(orderChannel === "tiktok" || orderChannel === "shopee") && (
        <div className="mt-4 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
          <label className="text-xs font-semibold text-blue-800 block mb-1">Override Fee Platform (%)</label>
          <input
            type="number"
            step="0.1"
            placeholder="Bawaan Pengaturan"
            value={platformFeeOverride}
            onChange={e => setPlatformFeeOverride(e.target.value)}
            className="w-full text-xs p-2 rounded border border-blue-200 bg-white outline-none text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}
    </div>
  );
}
