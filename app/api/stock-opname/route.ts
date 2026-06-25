import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole, verifyAuth } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.role !== "crew") {
    return NextResponse.json({ error: "Hanya crew yang bisa submit opname" }, { status: 403 });
  }

  const { items } = (await req.json()) as {
    items: {
      ingredientId: string;
      physicalStock?: number | null;
      fullPackages?: number | null;
      openPackageFullness?: string | null;
    }[];
  };

  if (!items?.length) {
    return NextResponse.json({ error: "Data opname tidak lengkap" }, { status: 400 });
  }

  try {
    const activeIngredientsSnap = await adminDb
      .collection("ingredients")
      .where("isActive", "==", true)
      .get();
    const totalIngredientsAll = activeIngredientsSnap.size;

    const ingredientMap = new Map<string, FirebaseFirestore.DocumentData>();
    for (const doc of activeIngredientsSnap.docs) {
      ingredientMap.set(doc.id, { id: doc.id, ...doc.data() });
    }

    let hasDiscrepancy = false;
    const processedItems: Record<string, unknown>[] = [];

    for (const item of items) {
      const ingredient = ingredientMap.get(item.ingredientId);
      if (!ingredient) continue;

      const systemStock = ingredient.currentStock ?? 0;
      const inputMethod = ingredient.opnameMethod ?? "direct";

      let finalPhysical: number;

      if (inputMethod === "packaged" && ingredient.packagedConfig) {
        const config = ingredient.packagedConfig;
        const fullPkgs = item.fullPackages ?? 0;
        let openRatio = 0;

        if (item.openPackageFullness && config.fullnessOptions) {
          const opt = config.fullnessOptions.find(
            (o: { label: string; ratio: number }) => o.label === item.openPackageFullness
          );
          if (opt) openRatio = opt.ratio;
        }

        const physicalStockConverted =
          fullPkgs * config.unitPerPackage + openRatio * config.unitPerPackage;
        finalPhysical = physicalStockConverted;

        processedItems.push({
          ingredientId: item.ingredientId,
          inputMethod: "packaged",
          physicalStock: null,
          fullPackages: item.fullPackages ?? 0,
          openPackageFullness: item.openPackageFullness ?? null,
          physicalStockConverted,
          systemStock,
          difference: physicalStockConverted - systemStock,
        });
      } else {
        const physicalStock = item.physicalStock ?? 0;
        finalPhysical = physicalStock;

        processedItems.push({
          ingredientId: item.ingredientId,
          inputMethod: "direct",
          physicalStock,
          fullPackages: null,
          openPackageFullness: null,
          physicalStockConverted: null,
          systemStock,
          difference: physicalStock - systemStock,
        });
      }

      if (finalPhysical !== systemStock) {
        hasDiscrepancy = true;
      }
    }

    const opnameRef = adminDb.collection("stockOpname").doc();

    await adminDb.runTransaction(async (tx) => {
      tx.set(opnameRef, {
        date: FieldValue.serverTimestamp(),
        crewId: auth.uid,
        items: processedItems,
        totalIngredientsChecked: processedItems.length,
        totalIngredientsAll,
        hasDiscrepancy,
        reviewedBy: null,
        reviewedAt: null,
        reviewAction: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      if (hasDiscrepancy) {
        const alertRef = adminDb.collection("alerts").doc();
        tx.set(alertRef, {
          type: "stock_opname_discrepancy",
          severity: "warning",
          title: "Selisih stok ditemukan",
          message: `Stock opname oleh crew menemukan selisih (${processedItems.length} bahan dicek)`,
          sourceCollection: "stockOpname",
          sourceId: opnameRef.id,
          isRead: false,
          readBy: null,
          readAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({
      success: true,
      opnameId: opnameRef.id,
      totalChecked: processedItems.length,
      hasDiscrepancy,
    });
  } catch (err) {
    console.error("POST /api/stock-opname error:", err);
    return NextResponse.json({ error: "Gagal menyimpan opname" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  try {
    let query: FirebaseFirestore.Query = adminDb
      .collection("stockOpname")
      .orderBy("createdAt", "desc")
      .limit(50);

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query = adminDb
        .collection("stockOpname")
        .where("date", ">=", start)
        .where("date", "<=", end)
        .orderBy("date", "desc");
    }

    const snap = await query.get();
    const results = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.date?.toDate?.().toISOString() ?? d.date,
        crewId: d.crewId,
        items: d.items,
        totalIngredientsChecked: d.totalIngredientsChecked,
        totalIngredientsAll: d.totalIngredientsAll,
        hasDiscrepancy: d.hasDiscrepancy,
        reviewedBy: d.reviewedBy,
        reviewedAt: d.reviewedAt?.toDate?.().toISOString() ?? d.reviewedAt,
        reviewAction: d.reviewAction,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt,
      };
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/stock-opname error:", err);
    return NextResponse.json({ error: "Gagal mengambil data opname" }, { status: 500 });
  }
}
