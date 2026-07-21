import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import { productionBatchSchema } from "@/lib/validations";

interface BatchEntry {
  variantId: string;
  batches: number;
  loyangCount: number;
  pcsCount: number;
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const body = await req.json();
  const parseResult = productionBatchSchema.safeParse(body);
  
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const { entries, type, notes, crewId, customDate } = parseResult.data;

  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: "Minimal 1 varian harus diisi" }, { status: 400 });
  }

  // Custom date logic allows any role to submit back-dated production as requested by user

  const effectiveCrewId = crewId || user.uid;

  try {
    const ingredientUsage = new Map<string, number>();
    const warnings: string[] = [];

    const allVariantIds = entries.map((e) => e.variantId);
    const variantFilter = [...new Set(["all", ...allVariantIds])];

    const recipesSnap = await adminDb
      .collection("recipes")
      .where("variantId", "in", variantFilter)
      .get();

    const recipes = recipesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
      id: string;
      productId: string;
      variantId: string;
      ingredientId: string;
      qtyPerBatch: number;
      unit: string;
    }>;

    for (const entry of entries) {
      const applicableRecipes = recipes.filter(
        (r) => r.variantId === "all" || r.variantId === entry.variantId
      );

      for (const recipe of applicableRecipes) {
        const qtyUsed = entry.batches * recipe.qtyPerBatch;
        const current = ingredientUsage.get(recipe.ingredientId) ?? 0;
        ingredientUsage.set(recipe.ingredientId, current + qtyUsed);
      }
    }

    const productionRefs = entries.map(() => adminDb.collection("productions").doc());
    const dateToUse = customDate ? new Date(customDate) : new Date();

    await adminDb.runTransaction(async (tx) => {
      const ingredientSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>();
      for (const ingId of ingredientUsage.keys()) {
        const snap = await tx.get(adminDb.collection("ingredients").doc(ingId));
        ingredientSnaps.set(ingId, snap);
      }

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        tx.set(productionRefs[i], {
          date: dateToUse,
          variantId: entry.variantId,
          batches: entry.batches,
          loyangCount: entry.loyangCount,
          pcsCount: entry.pcsCount || 0,
          loyangRemaining: entry.loyangCount,
          type: type || "standard",
          notes: notes ?? "",
          shiftCrewId: effectiveCrewId,
          createdAt: dateToUse,
        });
      }

      for (const [ingId, totalUsed] of ingredientUsage.entries()) {
        const snap = ingredientSnaps.get(ingId);
        const currentStock = snap?.data()?.currentStock ?? 0;
        const newStock = currentStock - totalUsed;

        tx.update(adminDb.collection("ingredients").doc(ingId), {
          currentStock: newStock,
        });

        const movementRef = adminDb.collection("stockMovements").doc();
        tx.set(movementRef, {
          ingredientId: ingId,
          changeAmount: -totalUsed,
          newStockAfter: newStock,
          sourceType: "production",
          sourceId: productionRefs[0].id,
          note: null,
          createdBy: user.uid,
          createdAt: dateToUse,
        });

        if (newStock < 0) {
          const ingName = snap?.data()?.name ?? ingId;
          warnings.push(`${ingName}: stok menjadi ${newStock}`);

          const alertRef = adminDb.collection("alerts").doc();
          tx.set(alertRef, {
            type: "stock_warning_production",
            severity: "warning",
            title: `Stok ${ingName} negatif`,
            message: `Stok ${ingName} menjadi ${newStock} setelah produksi.`,
            sourceCollection: "productions",
            sourceId: productionRefs[0].id,
            isRead: false,
            readBy: null,
            readAt: null,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      entriesSaved: entries.length,
      productionIds: productionRefs.map((r) => r.id),
      warnings,
    });
  } catch (err) {
    console.error("POST /api/productions/batch error:", err);
    return NextResponse.json({ error: "Gagal menyimpan produksi" }, { status: 500 });
  }
}
