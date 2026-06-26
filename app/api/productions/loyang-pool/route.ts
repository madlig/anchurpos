import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const variantId = searchParams.get("variantId");
  const type = searchParams.get("type") || "standard";

  if (!variantId) {
    return NextResponse.json({ error: "variantId wajib diisi" }, { status: 400 });
  }

  try {
    const snap = await adminDb
      .collection("productions")
      .where("variantId", "==", variantId)
      .where("loyangRemaining", ">", 0)
      .orderBy("loyangRemaining")
      .orderBy("date", "asc")
      .get();

    const pool = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          productionId: doc.id,
          date: data.date?.toDate?.().toISOString() ?? "",
          loyangRemaining: data.loyangRemaining,
          type: data.type ?? "standard",
        };
      })
      .filter((p) => p.type === type);

    const totalAvailable = pool.reduce((sum, p) => sum + p.loyangRemaining, 0);

    // Fetch buffer stock for this variant and type
    const bufferRef = adminDb.collection("prePackingBuffer").doc(`${variantId}_${type}`);
    const bufferSnap = await bufferRef.get();
    let bufferPcs = 0;
    if (bufferSnap.exists) {
      bufferPcs = bufferSnap.data()?.currentBufferPcs ?? 0;
    } else if (type === "standard") {
      // Fallback to legacy document ID
      const legacyRef = adminDb.collection("prePackingBuffer").doc(variantId);
      const legacySnap = await legacyRef.get();
      bufferPcs = legacySnap.exists ? (legacySnap.data()?.currentBufferPcs ?? 0) : 0;
    }

    return NextResponse.json({ pool, totalAvailable, bufferPcs });
  } catch (err) {
    console.error("GET /api/productions/loyang-pool error:", err);
    return NextResponse.json({ error: "Gagal mengambil data loyang pool" }, { status: 500 });
  }
}
