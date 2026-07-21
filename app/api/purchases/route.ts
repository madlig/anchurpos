import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import { convertToBaseUnit } from "@/lib/unit-conversion";
import type { AuthUser } from "@/lib/auth-middleware";
import { purchaseCreateSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    let query = adminDb.collection("purchases").orderBy("date", "desc") as FirebaseFirestore.Query;

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query = query.where("date", ">=", start).where("date", "<=", end);
    }

    const snap = await query.limit(200).get();

    const purchases = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.date?.toDate?.().toISOString() ?? "",
        category: d.category,
        ingredientId: d.ingredientId,
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

    return NextResponse.json(purchases);
  } catch (err) {
    console.error("GET /api/purchases error:", err);
    return NextResponse.json({ error: "Gagal mengambil data pembelian" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const body = await req.json();
  
  // Validasi ketat menggunakan Zod
  const parseResult = purchaseCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const {
    category,
    ingredientId,
    qtyPurchased,
    purchaseUnit,
    totalPrice,
    paymentMethod,
    supplier,
    notes,
    customDate
  } = parseResult.data;

  try {
    const purchaseRef = adminDb.collection("purchases").doc();
    const dateToUse = customDate ? new Date(customDate) : new Date();

    let qtyInBaseUnit = 0;
    let pricePerBaseUnit = 0;
    let ingredientName = "";

    await adminDb.runTransaction(async (tx) => {
      // 1. Validasi Master Data Bahan Baku
      const ingRef = adminDb.collection("ingredients").doc(ingredientId);
      const ingSnap = await tx.get(ingRef);

      if (!ingSnap.exists) {
        throw new Error("Bahan baku tidak ditemukan di Master Data.");
      }

      const ingData = ingSnap.data()!;
      ingredientName = ingData.name;

      // 2. Hitung Konversi Unit
      const result = convertToBaseUnit(
        qtyPurchased,
        purchaseUnit,
        ingData.baseUnit,
        ingData.unitAlternatives ?? []
      );

      if (result) {
        qtyInBaseUnit = result.qtyInBaseUnit;
        pricePerBaseUnit = qtyInBaseUnit > 0 ? totalPrice / qtyInBaseUnit : 0;
      } else {
        // Jika satuan beli = satuan dasar (misal sama-sama "gram")
        qtyInBaseUnit = qtyPurchased;
        pricePerBaseUnit = totalPrice / qtyPurchased;
      }

      // 3. Tambah Stok Bahan Baku (Inventory)
      const currentStock = ingData.currentStock ?? 0;
      const newStock = currentStock + qtyInBaseUnit;
      tx.update(ingRef, { currentStock: newStock });

      // 4. Catat Log Pembelian (Purchases)
      tx.set(purchaseRef, {
        date: dateToUse,
        category,
        ingredientId,
        itemName: ingredientName,
        qtyPurchased,
        purchaseUnit,
        qtyInBaseUnit,
        totalPrice,
        pricePerBaseUnit,
        paymentMethod,
        supplier: supplier ?? "",
        notes: notes ?? "",
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 5. Catat Log Pergerakan Stok (Stock Movements)
      const movementRef = adminDb.collection("stockMovements").doc();
      tx.set(movementRef, {
        ingredientId,
        changeAmount: qtyInBaseUnit,
        newStockAfter: newStock,
        sourceType: "purchase",
        sourceId: purchaseRef.id,
        note: `Restock via Pembelian`,
        createdBy: user.uid,
        createdAt: dateToUse,
      });
    });

    return NextResponse.json({
      success: true,
      id: purchaseRef.id,
      ingredientName,
      qtyInBaseUnit,
      pricePerBaseUnit,
    });
  } catch (err: any) {
    console.error("POST /api/purchases error:", err);
    return NextResponse.json({ error: err.message || "Gagal menyimpan pembelian" }, { status: 500 });
  }
}
