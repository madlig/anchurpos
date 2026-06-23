import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import { convertToBaseUnit } from "@/lib/unit-conversion";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  try {
    let query = adminDb.collection("expenses").orderBy("date", "desc") as FirebaseFirestore.Query;

    if (month) {
      const [year, mon] = month.split("-").map(Number);
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 1);
      query = query.where("date", ">=", start).where("date", "<", end);
    }

    const snap = await query.limit(200).get();

    const expenses = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.date?.toDate?.().toISOString() ?? "",
        category: d.category,
        ingredientId: d.ingredientId ?? null,
        itemName: d.itemName,
        qtyPurchased: d.qtyPurchased,
        purchaseUnit: d.purchaseUnit,
        qtyInBaseUnit: d.qtyInBaseUnit,
        totalPrice: d.totalPrice,
        pricePerBaseUnit: d.pricePerBaseUnit,
        paymentMethod: d.paymentMethod,
        supplier: d.supplier ?? "",
        notes: d.notes ?? "",
        createdBy: d.createdBy,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? "",
      };
    });

    return NextResponse.json(expenses);
  } catch (err) {
    console.error("GET /api/expenses error:", err);
    return NextResponse.json({ error: "Gagal mengambil data pengeluaran" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const body = await req.json();
  const {
    ingredientId,
    itemName,
    category,
    qtyPurchased,
    purchaseUnit,
    totalPrice,
    paymentMethod,
    supplier,
    notes,
  } = body;

  if (!itemName || !category || !totalPrice || !paymentMethod) {
    return NextResponse.json({ error: "Field wajib tidak lengkap" }, { status: 400 });
  }

  try {
    let qtyInBaseUnit = 0;
    let pricePerBaseUnit = 0;

    if (ingredientId && qtyPurchased && purchaseUnit) {
      const ingDoc = await adminDb.collection("ingredients").doc(ingredientId).get();
      if (!ingDoc.exists) {
        return NextResponse.json({ error: "Bahan tidak ditemukan" }, { status: 404 });
      }
      const ingData = ingDoc.data()!;

      const result = convertToBaseUnit(
        qtyPurchased,
        purchaseUnit,
        ingData.baseUnit,
        ingData.unitAlternatives ?? []
      );

      if (!result) {
        return NextResponse.json(
          { error: `Satuan "${purchaseUnit}" tidak dikenali untuk ${ingData.name}. Tambahkan konversi di pengaturan bahan.` },
          { status: 400 }
        );
      }

      qtyInBaseUnit = result.qtyInBaseUnit;
      pricePerBaseUnit = qtyInBaseUnit > 0 ? totalPrice / qtyInBaseUnit : 0;
    }

    const expenseRef = adminDb.collection("expenses").doc();

    await adminDb.runTransaction(async (tx) => {
      tx.set(expenseRef, {
        date: FieldValue.serverTimestamp(),
        category,
        ingredientId: ingredientId ?? null,
        itemName,
        qtyPurchased: qtyPurchased ?? 0,
        purchaseUnit: purchaseUnit ?? "",
        qtyInBaseUnit,
        totalPrice,
        pricePerBaseUnit,
        paymentMethod,
        supplier: supplier ?? "",
        notes: notes ?? "",
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      if (ingredientId && qtyInBaseUnit > 0) {
        const ingRef = adminDb.collection("ingredients").doc(ingredientId);
        const ingSnap = await tx.get(ingRef);
        const currentStock = ingSnap.data()?.currentStock ?? 0;
        const newStock = currentStock + qtyInBaseUnit;

        tx.update(ingRef, { currentStock: newStock });

        const movementRef = adminDb.collection("stockMovements").doc();
        tx.set(movementRef, {
          ingredientId,
          changeAmount: qtyInBaseUnit,
          newStockAfter: newStock,
          sourceType: "expense",
          sourceId: expenseRef.id,
          note: null,
          createdBy: user.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({
      success: true,
      id: expenseRef.id,
      qtyInBaseUnit,
      pricePerBaseUnit,
    });
  } catch (err) {
    console.error("POST /api/expenses error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pengeluaran" }, { status: 500 });
  }
}
