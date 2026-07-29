import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  try {
    let query: FirebaseFirestore.Query = adminDb.collection("stockAdjustments");

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, mon] = month.split("-").map(Number);
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0, 23, 59, 59, 999);
      query = query.where("createdAt", ">=", start).where("createdAt", "<=", end);
    }

    query = query.orderBy("createdAt", "desc").limit(100);
    const snap = await query.get();

    const items = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.createdAt?.toDate?.().toISOString() ?? d.date ?? "",
        itemType: d.itemType ?? "variant",
        itemId: d.itemId ?? d.variantId ?? "",
        itemName: d.itemName ?? d.variantName ?? "Item",
        qty: d.qty ?? 0,
        direction: d.direction ?? "decrease", // decrease | increase
        reasonCategory: d.reasonCategory ?? "lainnya",
        reasonCustom: d.reasonCustom ?? null,
        recipientName: d.recipientName ?? null,
        hppPerUnit: d.hppPerUnit ?? 0,
        totalCost: d.totalCost ?? 0,
        createdBy: d.createdBy ?? "",
        createdAt: d.createdAt?.toDate?.().toISOString() ?? "",
      };
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /api/stock-adjustments error:", err);
    return NextResponse.json({ error: "Gagal mengambil data adjustment stok" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { 
      itemType, // "variant" | "ingredient"
      itemId,
      qty,
      direction, // "decrease" | "increase"
      reasonCategory, 
      reasonCustom, 
      recipientName,
      customDate
    } = body;

    const qtyNum = parseFloat(qty);
    if (!itemId || !qtyNum || qtyNum <= 0 || !reasonCategory) {
      return NextResponse.json({ error: "Data adjustment tidak lengkap" }, { status: 400 });
    }

    const type = itemType === "ingredient" ? "ingredient" : "variant";
    const dir = direction === "increase" ? "increase" : "decrease";
    const actualDelta = dir === "increase" ? qtyNum : -qtyNum;

    let itemName = "Item";
    let hppPerUnit = 0;

    if (type === "variant") {
      const vRef = adminDb.collection("variants").doc(itemId);
      const vDoc = await vRef.get();
      if (!vDoc.exists) {
        return NextResponse.json({ error: "Varian produk tidak ditemukan" }, { status: 404 });
      }
      const vData = vDoc.data()!;
      itemName = vData.name ?? "Varian Produk";
      hppPerUnit = vData.costPrice ?? vData.price ?? 0;

      // Update variant stock in Firestore
      await vRef.update({
        currentStock: FieldValue.increment(actualDelta),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Record movement
      await adminDb.collection("ingredientMovements").add({
        variantId: itemId,
        variantName: itemName,
        type: "adjustment",
        quantity: actualDelta,
        unit: "Pack",
        notes: `Adjustment Stok (${dir === "increase" ? "+" : "-"}${qtyNum}): ${reasonCategory} ${reasonCustom ? `- ${reasonCustom}` : ""}`,
        createdBy: auth.uid,
        createdAt: customDate ? new Date(customDate) : FieldValue.serverTimestamp(),
      });

    } else {
      const ingRef = adminDb.collection("ingredients").doc(itemId);
      const ingDoc = await ingRef.get();
      if (!ingDoc.exists) {
        return NextResponse.json({ error: "Bahan / Packaging tidak ditemukan" }, { status: 404 });
      }
      const ingData = ingDoc.data()!;
      itemName = ingData.name ?? "Bahan Baku";
      hppPerUnit = ingData.pricePerBaseUnit ?? ingData.lastPurchasePrice ?? 0;

      // Update ingredient stock in Firestore
      await ingRef.update({
        currentStock: FieldValue.increment(actualDelta),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Record movement
      await adminDb.collection("ingredientMovements").add({
        ingredientId: itemId,
        ingredientName: itemName,
        type: "adjustment",
        quantity: actualDelta,
        unit: ingData.baseUnit ?? "Unit",
        notes: `Adjustment Stok (${dir === "increase" ? "+" : "-"}${qtyNum}): ${reasonCategory} ${reasonCustom ? `- ${reasonCustom}` : ""}`,
        createdBy: auth.uid,
        createdAt: customDate ? new Date(customDate) : FieldValue.serverTimestamp(),
      });
    }

    const totalCost = Math.round(qtyNum * hppPerUnit);

    const docRef = adminDb.collection("stockAdjustments").doc();
    await docRef.set({
      itemType: type,
      itemId,
      itemName,
      qty: qtyNum,
      direction: dir,
      reasonCategory,
      reasonCustom: reasonCustom || null,
      recipientName: recipientName || null,
      hppPerUnit,
      totalCost,
      createdBy: auth.uid,
      createdAt: customDate ? new Date(customDate) : FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ 
      success: true, 
      adjustmentId: docRef.id, 
      itemName,
      totalCost 
    });
  } catch (err) {
    console.error("POST /api/stock-adjustments error:", err);
    return NextResponse.json({ error: "Gagal menyimpan adjustment stok" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID adjustment wajib" }, { status: 400 });
  }

  try {
    const docRef = adminDb.collection("stockAdjustments").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Data adjustment tidak ditemukan" }, { status: 404 });
    }

    const d = doc.data()!;
    const type = d.itemType ?? "variant";
    const itemId = d.itemId ?? d.variantId;
    const qty = d.qty ?? 0;
    const dir = d.direction ?? "decrease";

    // Revert stock adjustment effect
    const reverseDelta = dir === "increase" ? -qty : qty;

    if (itemId) {
      if (type === "variant") {
        await adminDb.collection("variants").doc(itemId).update({
          currentStock: FieldValue.increment(reverseDelta),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        await adminDb.collection("ingredients").doc(itemId).update({
          currentStock: FieldValue.increment(reverseDelta),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/stock-adjustments error:", err);
    return NextResponse.json({ error: "Gagal menghapus adjustment stok" }, { status: 500 });
  }
}
