import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);

    const ordersSnap = await adminDb
      .collection("orders")
      .where("createdAt", ">=", startOfDay)
      .where("createdAt", "<=", endOfDay)
      .get();

    let omzet = 0;
    let hpp = 0;
    let orderCount = 0;

    for (const doc of ordersSnap.docs) {
      const d = doc.data();
      if (d.status === "void") continue;
      orderCount++;

      const itemsSnap = await doc.ref.collection("items").get();
      for (const itemDoc of itemsSnap.docs) {
        const item = itemDoc.data();
        omzet += item.totalPrice ?? 0;
        hpp += item.totalHpp ?? 0;
      }
    }

    const productionsSnap = await adminDb
      .collection("productions")
      .where("createdAt", ">=", startOfDay)
      .where("createdAt", "<=", endOfDay)
      .get();

    const productionSummary: { variantId: string; variantName: string; batches: number; loyangCount: number }[] = [];
    for (const doc of productionsSnap.docs) {
      const d = doc.data();
      const entries = d.entries as { variantId: string; variantName?: string; batches: number; loyangCount: number }[] | undefined;
      if (entries) {
        for (const e of entries) {
          const existing = productionSummary.find((p) => p.variantId === e.variantId);
          if (existing) {
            existing.batches += e.batches;
            existing.loyangCount += e.loyangCount;
          } else {
            productionSummary.push({
              variantId: e.variantId,
              variantName: e.variantName ?? e.variantId,
              batches: e.batches,
              loyangCount: e.loyangCount,
            });
          }
        }
      }
    }

    const ingredientsSnap = await adminDb.collection("ingredients").get();
    const lowStockItems: { id: string; name: string; currentStock: number; minStock: number; baseUnit: string }[] = [];
    for (const doc of ingredientsSnap.docs) {
      const d = doc.data();
      if (d.currentStock < d.minStock) {
        lowStockItems.push({
          id: doc.id,
          name: d.name,
          currentStock: d.currentStock,
          minStock: d.minStock,
          baseUnit: d.baseUnit,
        });
      }
    }

    return NextResponse.json({
      omzet,
      hpp,
      profit: omzet - hpp,
      orderCount,
      productionToday: productionSummary,
      lowStockItems,
    });
  } catch (err) {
    console.error("GET /api/dashboard/today error:", err);
    return NextResponse.json({ error: "Gagal mengambil data dashboard" }, { status: 500 });
  }
}
