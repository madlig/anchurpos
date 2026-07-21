import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const [productsSnap, variantsSnap, stocksSnap] = await Promise.all([
      adminDb.collection("products").where("isActive", "==", true).get(),
      adminDb.collection("variants").orderBy("sortOrder").get(),
      adminDb.collection("productStocks").get(),
    ]);

    const products = productsSnap.docs.map((doc) => ({ id: doc.id, name: doc.data().name }));
    const variants = variantsSnap.docs.map((doc) => ({ id: doc.id, name: doc.data().name, minStock: doc.data().minStock ?? 10 }));

    const stocksMap = new Map<string, number>();
    stocksSnap.docs.forEach((doc) => {
      stocksMap.set(doc.id, doc.data().currentStock ?? 0);
    });

    const results: any[] = [];
    products.forEach((prod) => {
      variants.forEach((v) => {
        const stockId = `${prod.id}_${v.id}`;
        const currentStock = stocksMap.get(stockId) ?? 0;

        results.push({
          id: stockId,
          productId: prod.id,
          productName: prod.name,
          variantId: v.id,
          variantName: v.name,
          name: `${prod.name} - ${v.name}`,
          currentStock,
          minStock: v.minStock,
        });
      });
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/products/stocks error:", err);
    return NextResponse.json({ error: "Gagal mengambil stok produk" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { id, currentStock, note } = body as {
      id: string; // e.g. "churros-frozen-regular_original"
      currentStock: number;
      note?: string;
    };

    if (!id || currentStock === undefined || currentStock < 0) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const ref = adminDb.collection("productStocks").doc(id);

    let prev = 0;
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        prev = snap.data()?.currentStock ?? 0;
      }

      tx.set(ref, {
        currentStock,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Log stock movement
      const movementRef = adminDb.collection("stockMovements").doc();
      tx.set(movementRef, {
        ingredientId: `product:${id}`,
        changeAmount: currentStock - prev,
        newStockAfter: currentStock,
        sourceType: "opname",
        sourceId: null,
        note: note || "Stock opname produk jadi manual",
        createdBy: auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, id, currentStock, previous: prev });
  } catch (err) {
    console.error("PATCH /api/products/stocks error:", err);
    return NextResponse.json({ error: "Gagal menyimpan opname produk" }, { status: 500 });
  }
}
