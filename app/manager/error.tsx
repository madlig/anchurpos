"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service if available
    console.error("Manager Route Error:", error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle size={40} />
      </div>
      <h2 className="text-2xl font-black text-slate-800 mb-2">Terjadi Kesalahan Sistem</h2>
      <p className="text-slate-500 mb-8 max-w-md">
        Maaf, aplikasi mengalami masalah saat memproses halaman ini. Silakan coba muat ulang halaman.
      </p>
      
      <div className="flex gap-4">
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
          className="rounded-xl border-slate-200"
        >
          Muat Ulang Penuh
        </Button>
        <Button 
          onClick={() => reset()}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
        >
          <RefreshCcw size={16} />
          Coba Lagi
        </Button>
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="mt-8 p-4 bg-slate-900 text-slate-300 rounded-xl text-left text-sm max-w-2xl overflow-auto w-full">
          <p className="font-mono font-bold text-red-400 mb-2">{error.message}</p>
          <pre className="font-mono whitespace-pre-wrap">{error.stack}</pre>
        </div>
      )}
    </div>
  );
}
