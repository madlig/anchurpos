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
  const { variantId, totalLoyangUsed, resultRegularPacks, resultFullPacks, resultTikTokPacks, leftoverPcs, type, crewId, customDate } = body as {
    variantId: string;
    totalLoyangUsed: number;
    resultRegularPacks?: number;
    resultFullPacks?: number;
    resultTikTokPacks?: number;
    leftoverPcs?: number;
    type?: "standard" | "tiktok";
    crewId?: string;
    customDate?: string;
  };

  if (!variantId || !totalLoyangUsed || totalLoyangUsed <= 0) {
    return NextResponse.json({ error: "Data pre-packing tidak lengkap" }, { status: 400 });
  }

  // Custom date logic allows any role to submit back-dated pre-packing as requested by user

  const effectiveCrewId = crewId || user.uid;
  const activeType = type || "standard";

  try {
    const poolSnap = await adminDb
      .collection("productions")
      .where("variantId", "==", variantId)
      .where("loyangRemaining", ">", 0)
      .orderBy("loyangRemaining")
      .orderBy("date", "asc")
      .get();

    const pool = poolSnap.docs
      .map((doc) => ({
        ref: doc.ref,
        id: doc.id,
        date: doc.data().date?.toDate?.().toISOString() ?? "",
        loyangRemaining: doc.data().loyangRemaining as number,
        type: doc.data().type ?? "standard",
      }))
      .filter((p) => p.type === activeType);

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
    const dateToUse = customDate ? new Date(customDate) : new Date();

    await adminDb.runTransaction(async (tx) => {
      const timestamp = dateToUse;

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
      if (activeType === "standard" && (resultRegularPacks ?? 0) > 0) {
        snapReg = await tx.get(stockRegRef);
      }

      // Fetch full stock document if full packs produced
      let snapFull = null;
      const stockFullRef = adminDb.collection("productStocks").doc(`churros-frozen-full_${variantId}`);
      if (activeType === "standard" && (resultFullPacks ?? 0) > 0) {
        snapFull = await tx.get(stockFullRef);
      }

      // Fetch TikTok stock document if TikTok packs produced
      let snapTikTok = null;
      const stockTikTokRef = adminDb.collection("productStocks").doc(`churros-frozen-tiktok_${variantId}`);
      if (activeType === "tiktok" && (resultTikTokPacks ?? 0) > 0) {
        snapTikTok = await tx.get(stockTikTokRef);
      }

      // Fetch buffer stock document
      const bufferRef = adminDb.collection("prePackingBuffer").doc(`${variantId}_${activeType}`);
      const bufferSnap = await tx.get(bufferRef);
      let usedBufferPcs = 0;
      if (bufferSnap.exists) {
        usedBufferPcs = bufferSnap.data()?.currentBufferPcs ?? 0;
      } else if (activeType === "standard") {
        // Fallback to legacy document ID
        const legacyRef = adminDb.collection("prePackingBuffer").doc(variantId);
        const legacySnap = await tx.get(legacyRef);
        usedBufferPcs = legacySnap.exists ? (legacySnap.data()?.currentBufferPcs ?? 0) : 0;
      }

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
        type: activeType,
        sourceProductions,
        totalLoyangUsed,
        resultRegularPacks: activeType === "standard" ? (resultRegularPacks ?? 0) : 0,
        resultFullPacks: activeType === "standard" ? (resultFullPacks ?? 0) : 0,
        resultTikTokPacks: activeType === "tiktok" ? (resultTikTokPacks ?? 0) : 0,
        usedBufferPcs,
        leftoverPcs: leftoverPcs ?? 0,
        crewId: effectiveCrewId,
        createdAt: timestamp,
      });

      // Increment Product Stocks - Regular
      if (activeType === "standard" && (resultRegularPacks ?? 0) > 0 && snapReg) {
        const currReg = snapReg.data()?.currentStock ?? 0;
        const nextStock = currReg + (resultRegularPacks ?? 0);
        tx.set(stockRegRef, {
          productId: "churros-frozen-regular",
          variantId,
          currentStock: nextStock,
        }, { merge: true });

        const movementRef = adminDb.collection("stockMovements").doc();
        tx.set(movementRef, {
          ingredientId: `product:churros-frozen-regular_${variantId}`,
          changeAmount: resultRegularPacks ?? 0,
          newStockAfter: nextStock,
          sourceType: "production",
          sourceId: prePackRef.id,
          note: `Pre-packing standard dari ${totalLoyangUsed} loyang`,
          createdBy: user.uid,
          createdAt: timestamp,
        });
      }

      // Increment Product Stocks - Full
      if (activeType === "standard" && (resultFullPacks ?? 0) > 0 && snapFull) {
        const currFull = snapFull.data()?.currentStock ?? 0;
        const nextStock = currFull + (resultFullPacks ?? 0);
        tx.set(stockFullRef, {
          productId: "churros-frozen-full",
          variantId,
          currentStock: nextStock,
        }, { merge: true });

        const movementRef = adminDb.collection("stockMovements").doc();
        tx.set(movementRef, {
          ingredientId: `product:churros-frozen-full_${variantId}`,
          changeAmount: resultFullPacks ?? 0,
          newStockAfter: nextStock,
          sourceType: "production",
          sourceId: prePackRef.id,
          note: `Pre-packing standard dari ${totalLoyangUsed} loyang`,
          createdBy: user.uid,
          createdAt: timestamp,
        });
      }

      // Increment Product Stocks - TikTok
      if (activeType === "tiktok" && (resultTikTokPacks ?? 0) > 0 && snapTikTok) {
        const currTikTok = snapTikTok.data()?.currentStock ?? 0;
        const nextStock = currTikTok + (resultTikTokPacks ?? 0);
        tx.set(stockTikTokRef, {
          productId: "churros-frozen-tiktok",
          variantId,
          currentStock: nextStock,
        }, { merge: true });

        const movementRef = adminDb.collection("stockMovements").doc();
        tx.set(movementRef, {
          ingredientId: `product:churros-frozen-tiktok_${variantId}`,
          changeAmount: resultTikTokPacks ?? 0,
          newStockAfter: nextStock,
          sourceType: "production",
          sourceId: prePackRef.id,
          note: `Pre-packing TikTok dari ${totalLoyangUsed} loyang`,
          createdBy: user.uid,
          createdAt: timestamp,
        });
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

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");

  try {
    let query = adminDb.collection("prePacking").orderBy("date", "desc") as FirebaseFirestore.Query;

    if (dateStr) {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      query = query.where("date", ">=", d).where("date", "<", next);
    }

    const snap = await query.limit(100).get();

    const results = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date?.toDate?.().toISOString() ?? "",
        variantId: data.variantId,
        type: data.type ?? "standard",
        totalLoyangUsed: data.totalLoyangUsed,
        resultRegularPacks: data.resultRegularPacks ?? 0,
        resultFullPacks: data.resultFullPacks ?? 0,
        resultTikTokPacks: data.resultTikTokPacks ?? 0,
        leftoverPcs: data.leftoverPcs ?? 0,
        crewId: data.crewId,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
      };
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/pre-packing error:", err);
    return NextResponse.json({ error: "Gagal mengambil data pre-packing" }, { status: 500 });
  }
}
