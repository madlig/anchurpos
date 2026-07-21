"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Palette } from "lucide-react";
import { formatDateTime } from "@/lib/formatters";

interface RainbowOrder {
  orderId: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  rainbowItems: { id: string; qty: number; variantName: string }[];
}

export default function RainbowAssemblyPage() {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<RainbowOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState("");

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

  const loadPending = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/rainbow-assembly/pending");
      const data = await res.json();
      if (res.ok) setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function handleConfirm(orderId: string) {
    setConfirming(orderId);
    try {
      const res = await fetchWithAuth(
        `/api/rainbow-assembly/${orderId}/confirm`,
        { method: "POST" }
      );
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
      }
    } finally {
      setConfirming("");
    }
  }

  function formatDate(iso: string) {
    return formatDateTime(iso);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold text-stone-900 mb-1">
        Rainbow Assembly
      </h1>
      <p className="text-sm text-stone-500 mb-5">
        Konfirmasi assembly Rainbow sebelum stok dikurangi
      </p>

      {orders.length === 0 && (
        <Card className="p-8 text-center">
          <Palette className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500">
            Tidak ada order Rainbow yang pending
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {orders.map((order) => (
          <Card key={order.orderId} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-stone-900">
                  {order.orderNumber}
                </p>
                <p className="text-xs text-stone-500">
                  {order.customerName} — {formatDate(order.createdAt)}
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                Pending
              </span>
            </div>

            <div className="bg-stone-50 rounded-lg p-3 mb-3">
              <p className="text-xs text-stone-500 mb-2">
                Item Rainbow yang perlu di-assembly:
              </p>
              <div className="space-y-1">
                {order.rainbowItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-stone-700">{item.variantName}</span>
                    <span className="font-medium text-stone-900">
                      {item.qty} pcs
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={() => handleConfirm(order.orderId)}
              disabled={confirming === order.orderId}
              className="w-full min-h-[44px] gap-2"
            >
              {confirming === order.orderId ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Konfirmasi Assembly
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
