import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const type = searchParams.get("type");
  const variantId = searchParams.get("variantId");

  try {
    let query = adminDb.collection("productions") as FirebaseFirestore.Query;

    if (dateStr) {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      // For date query, orderBy is on the same field so it doesn't need a composite index
      query = query.where("date", ">=", d).where("date", "<", next).orderBy("date", "desc");
    } else if (variantId) {
      // Just where, no orderBy to avoid FAILED_PRECONDITION composite index error
      query = query.where("variantId", "==", variantId);
    } else {
      query = query.orderBy("date", "desc").limit(100);
    }

    const snap = await query.get();

    const productions = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date?.toDate?.().toISOString() ?? "",
        variantId: data.variantId,
        batches: data.batches,
        loyangCount: data.loyangCount,
        pcsCount: data.pcsCount || 0,
        loyangRemaining: data.loyangRemaining,
        type: data.type ?? "standard",
        notes: data.notes ?? "",
        shiftCrewId: data.shiftCrewId,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
      };
    });

    if (variantId) {
      productions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      // limit to 50 most recent history for variant
      if (productions.length > 50) {
        productions.splice(50);
      }
    }

    if (type) {
      return NextResponse.json(productions.filter((p) => p.type === type));
    }

    return NextResponse.json(productions);
  } catch (err) {
    console.error("GET /api/productions error:", err);
    return NextResponse.json({ error: "Gagal mengambil data produksi" }, { status: 500 });
  }
}
