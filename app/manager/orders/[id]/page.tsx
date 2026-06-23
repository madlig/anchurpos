"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Truck,
  CreditCard,
  Ban,
} from "lucide-react";
import Link from "next/link";

interface OrderDetail {
  id: string;
  orderNumber: string;
  source: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  channel: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  shippingAddress: string | null;
  shippingCost: number | null;
  shippingCostConfirmed: boolean;
  requestedDeliveryDate: string | null;
  orderNotes: string | null;
  createdAt: string;
  completedAt: string | null;
  items: {
    id: string;
    productName: string;
    variantName: string;
    qty: number;
    basePrice: number;
    discountPerUnit: number;
    totalPrice: number;
    assemblyStatus: string | null;
  }[];
}

export default function OrderDetailPage() {
  const { role, getToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [shippingInput, setShippingInput] = useState("");
  const [error, setError] = useState("");
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

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

  const loadOrder = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/orders/${orderId}`);
      const data = await res.json();
      if (res.ok) setOrder(data);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  async function updateStatus(status: string) {
    setActionLoading("status");
    setError("");
    try {
      const res = await fetchWithAuth(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Gagal update status");
        return;
      }
      await loadOrder();
    } finally {
      setActionLoading("");
    }
  }

  async function updatePayment(paymentStatus: string, paymentMethod?: string) {
    setActionLoading("payment");
    setError("");
    try {
      const body: Record<string, string> = { paymentStatus };
      if (paymentMethod) body.paymentMethod = paymentMethod;
      const res = await fetchWithAuth(`/api/orders/${orderId}/payment`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Gagal update pembayaran");
        return;
      }
      await loadOrder();
    } finally {
      setActionLoading("");
    }
  }

  async function confirmShipping() {
    const cost = parseInt(shippingInput);
    if (isNaN(cost) || cost < 0) return;
    setActionLoading("shipping");
    setError("");
    try {
      const res = await fetchWithAuth(`/api/orders/${orderId}/shipping`, {
        method: "PATCH",
        body: JSON.stringify({ shippingCost: cost }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Gagal update ongkir");
        return;
      }
      await loadOrder();
      setShippingInput("");
    } finally {
      setActionLoading("");
    }
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-5 text-center">
        <p className="text-stone-500">Order tidak ditemukan</p>
        <Button onClick={() => router.back()} variant="outline" className="mt-3">
          Kembali
        </Button>
      </div>
    );
  }

  const itemsTotal = order.items.reduce((s, i) => s + i.totalPrice, 0);
  const grandTotal = itemsTotal + (order.shippingCost ?? 0);

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="text-stone-400">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-stone-900">
            {order.orderNumber}
          </h1>
          <p className="text-xs text-stone-500">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <h2 className="text-xs text-stone-500 mb-2">Pelanggan</h2>
        <p className="text-sm font-medium text-stone-900">
          {order.customerName}
        </p>
        <p className="text-xs text-stone-500">{order.customerPhone}</p>
        {order.shippingAddress && (
          <p className="text-xs text-stone-500 mt-1">{order.shippingAddress}</p>
        )}
        {order.requestedDeliveryDate && (
          <p className="text-xs text-stone-500 mt-1">
            Kirim: {order.requestedDeliveryDate}
          </p>
        )}
        {order.orderNotes && (
          <p className="text-xs text-stone-400 mt-1 italic">
            {order.orderNotes}
          </p>
        )}
      </Card>

      <Card className="p-4 mb-4">
        <h2 className="text-xs text-stone-500 mb-3">Item Pesanan</h2>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-start text-sm"
            >
              <div>
                <p className="font-medium text-stone-900">
                  {item.productName} — {item.variantName}
                </p>
                <p className="text-xs text-stone-500">
                  {item.qty} x {formatCurrency(item.basePrice)}
                  {item.discountPerUnit > 0 && (
                    <span className="text-emerald-600">
                      {" "}
                      (-{formatCurrency(item.discountPerUnit)}/pcs)
                    </span>
                  )}
                </p>
                {item.assemblyStatus && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                      item.assemblyStatus === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    Rainbow:{" "}
                    {item.assemblyStatus === "completed"
                      ? "Selesai"
                      : "Menunggu"}
                  </span>
                )}
              </div>
              <p className="font-medium text-stone-900">
                {formatCurrency(item.totalPrice)}
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-stone-100 mt-3 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Subtotal</span>
            <span>{formatCurrency(itemsTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Ongkir</span>
            <span>
              {order.shippingCostConfirmed
                ? formatCurrency(order.shippingCost ?? 0)
                : "Belum dikonfirmasi"}
            </span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-stone-400" />
            <span className="text-xs text-stone-500">Status</span>
          </div>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              order.status === "selesai"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {order.status === "selesai" ? "Selesai" : "Belum Selesai"}
          </span>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={14} className="text-stone-400" />
            <span className="text-xs text-stone-500">Pembayaran</span>
          </div>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              order.paymentStatus === "sudah_bayar"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {order.paymentStatus === "sudah_bayar" ? "Lunas" : "Belum Bayar"}
          </span>
          {order.paymentMethod && (
            <p className="text-xs text-stone-400 mt-1 capitalize">
              {order.paymentMethod}
            </p>
          )}
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <h2 className="text-xs text-stone-500 mb-3">Aksi</h2>
        <div className="space-y-2">
          {order.status === "belum_selesai" && (
            <Button
              onClick={() => updateStatus("selesai")}
              disabled={actionLoading === "status"}
              className="w-full gap-2"
              variant="outline"
            >
              {actionLoading === "status" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Tandai Selesai
            </Button>
          )}

          {order.paymentStatus === "belum_bayar" && (
            <Button
              onClick={() => updatePayment("sudah_bayar", "cash")}
              disabled={actionLoading === "payment"}
              className="w-full gap-2"
              variant="outline"
            >
              {actionLoading === "payment" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CreditCard size={14} />
              )}
              Tandai Lunas
            </Button>
          )}

          {!order.shippingCostConfirmed && (
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                placeholder="Ongkir (Rp)"
                value={shippingInput}
                onChange={(e) => setShippingInput(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={confirmShipping}
                disabled={actionLoading === "shipping" || !shippingInput}
                variant="outline"
                className="gap-1"
              >
                {actionLoading === "shipping" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Truck size={14} />
                )}
                Konfirmasi
              </Button>
            </div>
          )}
        </div>
      </Card>

      {order.items.some((i) => i.assemblyStatus === "pending_approval") && (
        <Link href="/manager/rainbow-assembly">
          <Card className="p-4 bg-purple-50 border-purple-200 text-center">
            <p className="text-sm text-purple-800 font-medium">
              Ada item Rainbow yang perlu di-assembly
            </p>
            <p className="text-xs text-purple-600 mt-1">
              Tap untuk ke halaman Rainbow Assembly
            </p>
          </Card>
        </Link>
      )}

      {role === "owner" && order.status !== "void" && (
        <Card className="p-4 mt-4 border-red-200 bg-red-50/50">
          {!showVoidConfirm ? (
            <Button
              onClick={() => setShowVoidConfirm(true)}
              variant="outline"
              className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <Ban size={14} />
              Void Order
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-800 font-medium">
                Yakin void order ini? Stok akan dikembalikan.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    setActionLoading("void");
                    setError("");
                    try {
                      const res = await fetchWithAuth(`/api/orders/${orderId}/void`, {
                        method: "POST",
                      });
                      if (!res.ok) {
                        const d = await res.json();
                        setError(d.error ?? "Gagal void order");
                        return;
                      }
                      await loadOrder();
                      setShowVoidConfirm(false);
                    } finally {
                      setActionLoading("");
                    }
                  }}
                  disabled={actionLoading === "void"}
                  className="flex-1 bg-red-600 hover:bg-red-700 gap-2"
                >
                  {actionLoading === "void" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Ban size={14} />
                  )}
                  Ya, Void
                </Button>
                <Button
                  onClick={() => setShowVoidConfirm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Batal
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {order.status === "void" && (
        <Card className="p-4 mt-4 bg-red-100 border-red-300 text-center">
          <p className="text-sm font-medium text-red-800">Order telah di-void</p>
        </Card>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
