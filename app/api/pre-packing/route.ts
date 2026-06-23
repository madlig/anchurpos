import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const body = await req.json();
  const { variantId, totalLoyangUsed, resultRegularPacks, resultFullPacks, crewId } = body as {
    variantId: string;
    totalLoyangUsed: number;
    resultRegularPacks: number;
    resultFullPacks: number;
    crewId?: string;
  };

  if (!variantId || !totalLoyangUsed || totalLoyangUsed <= 0) {
    return NextResponse.json({ error: "Data pre-packing tidak lengkap" }, { status: 400 });
  }

  const effectiveCrewId = crewId || user.uid;

  try {
    const poolSnap = await adminDb
      .collection("productions")
      .where("variantId", "==", variantId)
      .where("loyangRemaining", ">", 0)
      .orderBy("loyangRemaining")
      .orderBy("date", "asc")
      .get();

    const pool = poolSnap.docs.map((doc) => ({
      ref: doc.ref,
      id: doc.id,
      date: doc.data().date?.toDate?.().toISOString() ?? "",
      loyangRemaining: doc.data().loyangRemaining as number,
    }));

    const totalAvailable = pool.reduce((sum, p) => sum + p.loyangRemaining, 0);
    if (totalLoyangUsed > totalAvailable) {
      return NextResponse.json(
        { error: `Loyang tidak cukup, tersedia hanya ${totalAvailable} loyang` },
        { status: 400 }
      );
    }

    const sourceProductions: { productionId: string; productionDate: string; loyangUsed: number }[] = [];
    let remaining = totalLoyangUsed;

    for (const p of pool) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, p.loyangRemaining);
      sourceProductions.push({
        productionId: p.id,
        productionDate: p.date,
        loyangUsed: take,
      });
      remaining -= take;
    }

    const prePackRef = adminDb.collection("prePacking").doc();

    await adminDb.runTransaction(async (tx) => {
      for (const sp of sourceProductions) {
        const prodRef = adminDb.collection("productions").doc(sp.productionId);
        const prodSnap = await tx.get(prodRef);
        const currentRemaining = prodSnap.data()?.loyangRemaining ?? 0;
        tx.update(prodRef, { loyangRemaining: currentRemaining - sp.loyangUsed });
      }

      tx.set(prePackRef, {
        date: FieldValue.serverTimestamp(),
        variantId,
        sourceProductions,
        totalLoyangUsed,
        resultRegularPacks: resultRegularPacks ?? 0,
        resultFullPacks: resultFullPacks ?? 0,
        crewId: effectiveCrewId,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      prePackingId: prePackRef.id,
      sourceBreakdown: sourceProductions,
    });
  } catch (err) {
    console.error("POST /api/pre-packing error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pre-packing" }, { status: 500 });
  }
}
