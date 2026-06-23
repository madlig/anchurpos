import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");

  try {
    let query = adminDb.collection("productions").orderBy("date", "desc") as FirebaseFirestore.Query;

    if (dateStr) {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      query = query.where("date", ">=", d).where("date", "<", next);
    }

    const snap = await query.limit(100).get();

    const productions = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date?.toDate?.().toISOString() ?? "",
        variantId: data.variantId,
        batches: data.batches,
        loyangCount: data.loyangCount,
        loyangRemaining: data.loyangRemaining,
        notes: data.notes ?? "",
        shiftCrewId: data.shiftCrewId,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
      };
    });

    return NextResponse.json(productions);
  } catch (err) {
    console.error("GET /api/productions error:", err);
    return NextResponse.json({ error: "Gagal mengambil data produksi" }, { status: 500 });
  }
}
