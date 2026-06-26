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
  const { variantId, totalLoyangUsed, resultRegularPacks, resultFullPacks, sausGlazeId, crewId } = body as {
    variantId: string;
    totalLoyangUsed: number;
    resultRegularPacks: number;
    resultFullPacks: number;
    sausGlazeId?: string;
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
      const timestamp = FieldValue.serverTimestamp();

      // 1. Deduct Loyang
      for (const sp of sourceProductions) {
        const prodRef = adminDb.collection("productions").doc(sp.productionId);
        const prodSnap = await tx.get(prodRef);
        const currentRemaining = prodSnap.data()?.loyangRemaining ?? 0;
        tx.update(prodRef, { loyangRemaining: currentRemaining - sp.loyangUsed });
      }

      // 2. Add Pre-Packing record
      tx.set(prePackRef, {
        date: timestamp,
        variantId,
        sourceProductions,
        totalLoyangUsed,
        resultRegularPacks: resultRegularPacks ?? 0,
        resultFullPacks: resultFullPacks ?? 0,
        sausGlazeId: sausGlazeId || null,
        crewId: effectiveCrewId,
        createdAt: timestamp,
      });

      // 3. Increment Product Stocks
      if (resultRegularPacks > 0) {
        const stockRegId = `churros-frozen-regular_${variantId}`;
        const stockRegRef = adminDb.collection("productStocks").doc(stockRegId);
        const snapReg = await tx.get(stockRegRef);
        const currReg = snapReg.data()?.currentStock ?? 0;
        tx.set(stockRegRef, {
          productId: "churros-frozen-regular",
          variantId,
          currentStock: currReg + resultRegularPacks,
        }, { merge: true });
      }

      if (resultFullPacks > 0) {
        const stockFullId = `churros-frozen-full_${variantId}`;
        const stockFullRef = adminDb.collection("productStocks").doc(stockFullId);
        const snapFull = await tx.get(stockFullRef);
        const currFull = snapFull.data()?.currentStock ?? 0;
        tx.set(stockFullRef, {
          productId: "churros-frozen-full",
          variantId,
          currentStock: currFull + resultFullPacks,
        }, { merge: true });
      }

      // 4. Deduct Add-ons (Gula Halus & Saus Glaze)
      // Pack Regular = 2 Saus + 1 Gula Halus
      // Pack Full = 1 Gula Halus
      const totalGulaHalus = (resultRegularPacks * 1) + (resultFullPacks * 1);
      if (totalGulaHalus > 0) {
        const gulaRef = adminDb.collection("ingredients").doc("gula-halus-cinnamon");
        const gulaSnap = await tx.get(gulaRef);
        if (gulaSnap.exists) {
          const currGula = gulaSnap.data()?.currentStock ?? 0;
          tx.update(gulaRef, { currentStock: currGula - totalGulaHalus });
          
          const moveGulaRef = adminDb.collection("stockMovements").doc();
          tx.set(moveGulaRef, {
            ingredientId: "gula-halus-cinnamon",
            changeAmount: -totalGulaHalus,
            newStockAfter: currGula - totalGulaHalus,
            sourceType: "production",
            sourceId: prePackRef.id,
            note: `Pre-packing otomatis`,
            createdBy: effectiveCrewId,
            createdAt: timestamp,
          });
        }
      }

      const totalSausGlaze = resultRegularPacks * 2;
      if (totalSausGlaze > 0 && sausGlazeId) {
        const sausRef = adminDb.collection("ingredients").doc(sausGlazeId);
        const sausSnap = await tx.get(sausRef);
        if (sausSnap.exists) {
          const currSaus = sausSnap.data()?.currentStock ?? 0;
          tx.update(sausRef, { currentStock: currSaus - totalSausGlaze });

          const moveSausRef = adminDb.collection("stockMovements").doc();
          tx.set(moveSausRef, {
            ingredientId: sausGlazeId,
            changeAmount: -totalSausGlaze,
            newStockAfter: currSaus - totalSausGlaze,
            sourceType: "production",
            sourceId: prePackRef.id,
            note: `Pre-packing otomatis`,
            createdBy: effectiveCrewId,
            createdAt: timestamp,
          });
        }
      }
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
