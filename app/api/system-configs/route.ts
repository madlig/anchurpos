import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  try {
    const snap = await adminDb.collection("system_configs").doc("global").get();
    
    if (!snap.exists) {
      return NextResponse.json({
        paymentMethods: ["cash", "transfer", "qris"],
        expenseCategories: ["bahan_baku", "packaging", "operasional", "lain_lain"],
        deliveryMethods: ["pickup", "delivery"],
        shippingBorneBy: ["seller", "customer"]
      });
    }

    return NextResponse.json(snap.data());
  } catch (err) {
    console.error("GET /api/system-configs error:", err);
    return NextResponse.json({ error: "Gagal mengambil konfigurasi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { paymentMethods, expenseCategories, deliveryMethods, shippingBorneBy } = body as {
      paymentMethods: string[];
      expenseCategories: string[];
      deliveryMethods: string[];
      shippingBorneBy: string[];
    };

    if (!Array.isArray(paymentMethods) || !Array.isArray(expenseCategories) || !Array.isArray(deliveryMethods) || !Array.isArray(shippingBorneBy)) {
      return NextResponse.json({ error: "Data harus berupa array" }, { status: 400 });
    }

    await adminDb.collection("system_configs").doc("global").set({
      paymentMethods,
      expenseCategories,
      deliveryMethods,
      shippingBorneBy,
      updatedAt: new Date()
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/system-configs error:", err);
    return NextResponse.json({ error: "Gagal menyimpan konfigurasi" }, { status: 500 });
  }
}
