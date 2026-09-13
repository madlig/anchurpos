import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole, verifyAuth } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";
import { stockOpnameSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["owner", "manager", "crew"].includes(auth.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  }

  const parseResult = stockOpnameSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Data opname tidak valid", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { items, woId } = parseResult.data;

  try {
    const [activeIngredientsSnap, productStocksSnap, productsSnap, variantsSnap] = await Promise.all([
      adminDb.collection("ingredients").where("isActive", "==", true).get(),
      adminDb.collection("productStocks").get(),
      adminDb.collection("products").where("isActive", "==", true).get(),
      adminDb.collection("variants").get(),
    ]);

    const totalIngredientsAll = activeIngredientsSnap.size;

    const ingredientMap = new Map<string, FirebaseFirestore.DocumentData>();
    for (const doc of activeIngredientsSnap.docs) {
      ingredientMap.set(doc.id, { id: doc.id, ...doc.data() });
    }

    const productMap = new Map<string, FirebaseFirestore.DocumentData>();
    for (const doc of productsSnap.docs) {
      productMap.set(doc.id, doc.data());
    }

    const variantMap = new Map<string, FirebaseFirestore.DocumentData>();
    for (const doc of variantsSnap.docs) {
      variantMap.set(doc.id, doc.data());
    }

    const productStockMap = new Map<string, { currentStock: number; name: string; unit: string }>();
    for (const doc of productStocksSnap.docs) {
      const data = doc.data();
      const currentStock = data.currentStock ?? 0;
      const prod = productMap.get(data.productId);
      const variant = variantMap.get(data.variantId);
      const name = prod && variant ? `${prod.name} - ${variant.name}` : prod ? prod.name : doc.id;
      productStockMap.set(doc.id, {
        currentStock,
        name,
        unit: "pack",
      });
    }

    let hasDiscrepancy = false;
    const processedItems: Record<string, unknown>[] = [];

    for (const item of items) {
      const isProductStock = item.itemType === "variant" || productStockMap.has(item.ingredientId);

      if (isProductStock) {
        const pStock = productStockMap.get(item.ingredientId);
        const systemStock = pStock ? pStock.currentStock : (item.systemStock ?? 0);
        const physicalStock = item.physicalStock ?? 0;
        const diff = physicalStock - systemStock;

        if (diff !== 0) {
          hasDiscrepancy = true;
        }

        processedItems.push({
          ingredientId: item.ingredientId,
          itemType: "variant",
          name: item.name || pStock?.name || item.ingredientId,
          unit: item.unit || "pack",
          inputMethod: "direct",
          physicalStock,
          fullPackages: null,
          openPackageFullness: null,
          physicalStockConverted: null,
          systemStock,
          difference: diff,
          note: item.note || null,
        });
        continue;
      }

      const ingredient = ingredientMap.get(item.ingredientId);
      if (!ingredient) continue;

      const systemStock = ingredient.currentStock ?? 0;
      const inputMethod = item.inputMethod === "packaged" ? "packaged" : (ingredient.opnameMethod ?? "direct");

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

        const diff = physicalStockConverted - systemStock;
        if (diff !== 0) hasDiscrepancy = true;

        processedItems.push({
          ingredientId: item.ingredientId,
          itemType: "ingredient",
          name: item.name || ingredient.name,
          unit: item.unit || ingredient.baseUnit || "pcs",
          inputMethod: "packaged",
          physicalStock: null,
          fullPackages: item.fullPackages ?? 0,
          openPackageFullness: item.openPackageFullness ?? null,
          physicalStockConverted,
          systemStock,
          difference: diff,
          note: item.note || null,
        });
      } else {
        const physicalStock = item.physicalStock ?? 0;
        finalPhysical = physicalStock;
        const diff = physicalStock - systemStock;

        if (diff !== 0) {
          hasDiscrepancy = true;
        }

        processedItems.push({
          ingredientId: item.ingredientId,
          itemType: "ingredient",
          name: item.name || ingredient.name,
          unit: item.unit || ingredient.baseUnit || "pcs",
          inputMethod: "direct",
          physicalStock,
          fullPackages: null,
          openPackageFullness: null,
          physicalStockConverted: null,
          systemStock,
          difference: diff,
          note: item.note || null,
        });
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
          message: `Stock opname oleh ${auth.email || auth.role} menemukan selisih (${processedItems.length} item dicek)`,
          sourceCollection: "stockOpname",
          sourceId: opnameRef.id,
          isRead: false,
          readBy: null,
          readAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      if (woId) {
        const woRef = adminDb.collection("workOrders").doc(woId);
        tx.update(woRef, {
          status: "COMPLETED",
          completedAt: FieldValue.serverTimestamp(),
          opnameId: opnameRef.id,
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
