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
  const { variantId, totalLoyangUsed, resultRegularPacks, resultFullPacks, leftoverPcs, crewId } = body as {
    variantId: string;
    totalLoyangUsed: number;
    resultRegularPacks: number;
    resultFullPacks: number;
    leftoverPcs?: number;
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

      // --- 1. READ OPERATIONS FIRST ---
      
      // Fetch all production documents
      const prodSnaps = [];
      for (const sp of sourceProductions) {
        const prodRef = adminDb.collection("productions").doc(sp.productionId);
        const snap = await tx.get(prodRef);
        prodSnaps.push({
          ref: prodRef,
          snap,
          loyangUsed: sp.loyangUsed,
        });
      }

      // Fetch regular stock document if regular packs produced
      let snapReg = null;
      const stockRegRef = adminDb.collection("productStocks").doc(`churros-frozen-regular_${variantId}`);
      if (resultRegularPacks > 0) {
        snapReg = await tx.get(stockRegRef);
      }

      // Fetch full stock document if full packs produced
      let snapFull = null;
      const stockFullRef = adminDb.collection("productStocks").doc(`churros-frozen-full_${variantId}`);
      if (resultFullPacks > 0) {
        snapFull = await tx.get(stockFullRef);
      }

      // Fetch buffer stock document
      const bufferRef = adminDb.collection("prePackingBuffer").doc(variantId);
      const bufferSnap = await tx.get(bufferRef);
      const usedBufferPcs = bufferSnap.exists ? (bufferSnap.data()?.currentBufferPcs ?? 0) : 0;

      // --- 2. WRITE OPERATIONS SECOND ---

      // Deduct Loyang
      for (const item of prodSnaps) {
        const currentRemaining = item.snap.data()?.loyangRemaining ?? 0;
        tx.update(item.ref, { loyangRemaining: currentRemaining - item.loyangUsed });
      }

      // Update pre-packing buffer stock to the new leftover pcs
      tx.set(bufferRef, {
        variantId,
        currentBufferPcs: leftoverPcs ?? 0,
        updatedAt: timestamp,
      }, { merge: true });

      // Add Pre-Packing record
      tx.set(prePackRef, {
        date: timestamp,
        variantId,
        sourceProductions,
        totalLoyangUsed,
        resultRegularPacks: resultRegularPacks ?? 0,
        resultFullPacks: resultFullPacks ?? 0,
        usedBufferPcs,
        leftoverPcs: leftoverPcs ?? 0,
        crewId: effectiveCrewId,
        createdAt: timestamp,
      });

      // Increment Product Stocks - Regular
      if (resultRegularPacks > 0 && snapReg) {
        const currReg = snapReg.data()?.currentStock ?? 0;
        tx.set(stockRegRef, {
          productId: "churros-frozen-regular",
          variantId,
          currentStock: currReg + resultRegularPacks,
        }, { merge: true });
      }

      // Increment Product Stocks - Full
      if (resultFullPacks > 0 && snapFull) {
        const currFull = snapFull.data()?.currentStock ?? 0;
        tx.set(stockFullRef, {
          productId: "churros-frozen-full",
          variantId,
          currentStock: currFull + resultFullPacks,
        }, { merge: true });
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
