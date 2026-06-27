import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "bulan"; // "hari" | "minggu" | "bulan"
  const dateStr = searchParams.get("date"); // YYYY-MM-DD or YYYY-MM
  const type = searchParams.get("type") || "ingredient"; // "ingredient" | "variant"

  try {
    // If it's a variant/product, look for the 'product:' prefix in ingredientId
    const targetId = type === "variant" ? `product:${id}` : id;

    const query = adminDb
      .collection("stockMovements")
      .where("ingredientId", "==", targetId)
      .orderBy("createdAt", "desc");

    // Fetch all matching movements (limit to 500 to keep it lightweight)
    const snap = await query.limit(500).get();

    // Map movements to simple JSON items
    let movements = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ingredientId: d.ingredientId,
        changeAmount: d.changeAmount,
        newStockAfter: d.newStockAfter,
        sourceType: d.sourceType,
        sourceId: d.sourceId,
        note: d.note ?? "",
        createdBy: d.createdBy,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? "",
      };
    });

    // Apply period filtering in memory
    if (dateStr) {
      if (filter === "hari") {
        const targetDate = dateStr.slice(0, 10); // YYYY-MM-DD
        movements = movements.filter((m) => m.createdAt.startsWith(targetDate));
      } else if (filter === "bulan") {
        const targetMonth = dateStr.slice(0, 7); // YYYY-MM
        movements = movements.filter((m) => m.createdAt.startsWith(targetMonth));
      } else if (filter === "minggu") {
        // Calculate week range (Monday to Sunday) containing dateStr (YYYY-MM-DD)
        const d = new Date(dateStr);
        const day = d.getDay(); // 0 is Sunday
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        movements = movements.filter((m) => {
          if (!m.createdAt) return false;
          const mDate = new Date(m.createdAt);
          return mDate >= monday && mDate <= sunday;
        });
      }
    }

    return NextResponse.json(movements);
  } catch (err) {
    console.error("GET /api/ingredients/[id]/movements error:", err);
    return NextResponse.json({ error: "Gagal mengambil riwayat mutasi" }, { status: 500 });
  }
}
