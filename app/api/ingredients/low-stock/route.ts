import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb.collection("ingredients").get();

    const lowStock = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name,
          category: d.category,
          baseUnit: d.baseUnit,
          currentStock: d.currentStock ?? 0,
          minStock: d.minStock ?? 0,
        };
      })
      .filter((ing) => ing.currentStock < ing.minStock);

    return NextResponse.json(lowStock);
  } catch (err) {
    console.error("GET /api/ingredients/low-stock error:", err);
    return NextResponse.json({ error: "Gagal mengambil data stok rendah" }, { status: 500 });
  }
}
