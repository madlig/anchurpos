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
    items,
    paymentMethod,
    supplier,
    notes,
    customDate
  } = parseResult.data;

  try {
    const dateToUse = customDate ? new Date(customDate) : new Date();
    
    // Validate no duplicate ingredients in the request to prevent transaction conflicts on same doc
    const uniqueIds = new Set(items.map(i => i.ingredientId));
    if (uniqueIds.size !== items.length) {
      return NextResponse.json({ error: "Terdapat bahan baku yang sama di dalam keranjang nota. Harap gabungkan kuantitasnya menjadi satu baris." }, { status: 400 });
    }

    const savedIds: string[] = [];

    await adminDb.runTransaction(async (tx) => {
      // 1. Read all required ingredients first
      const ingDataMap = new Map();
      for (const item of items) {
        const ingRef = adminDb.collection("ingredients").doc(item.ingredientId);
        const ingSnap = await tx.get(ingRef);
        if (!ingSnap.exists) {
          throw new Error(`Bahan baku dengan ID ${item.ingredientId} tidak ditemukan.`);
        }
        ingDataMap.set(item.ingredientId, { ref: ingRef, data: ingSnap.data()! });
      }

      // 2. Process writes for all items
      for (const item of items) {
        const { ref: ingRef, data: ingData } = ingDataMap.get(item.ingredientId);
        const ingredientName = ingData.name;

        // Hitung Konversi Unit
        let qtyInBaseUnit = 0;
        let pricePerBaseUnit = 0;

        const result = convertToBaseUnit(
          item.qtyPurchased,
          item.purchaseUnit,
          ingData.baseUnit,
          ingData.unitAlternatives ?? []
        );

        if (result) {
          qtyInBaseUnit = result.qtyInBaseUnit;
          pricePerBaseUnit = qtyInBaseUnit > 0 ? item.totalPrice / qtyInBaseUnit : 0;
        } else {
          qtyInBaseUnit = item.qtyPurchased;
          pricePerBaseUnit = item.totalPrice / item.qtyPurchased;
        }

        // Tambah Stok Bahan Baku (Inventory) & Update HPP Dasar (Time-Aware)
        const currentStock = ingData.currentStock ?? 0;
        const newStock = currentStock + qtyInBaseUnit;
        
        const lastHppDateStr = ingData.lastHppUpdateDate;
        const purchaseDateStr = dateToUse.toISOString();
        
        const updateData: any = {
          currentStock: newStock,
        };

        // Update HPP ONLY IF this purchase is newer or equal to the last recorded HPP date, OR if current HPP is 0
        if (!lastHppDateStr || purchaseDateStr >= lastHppDateStr || ingData.defaultCostPerBaseUnit === 0) {
          updateData.defaultCostPerBaseUnit = pricePerBaseUnit;
          updateData.lastHppUpdateDate = purchaseDateStr;
        }

        tx.update(ingRef, updateData);

        // Catat Log Pembelian (Purchases)
        const purchaseRef = adminDb.collection("purchases").doc();
        savedIds.push(purchaseRef.id);
        
        tx.set(purchaseRef, {
          date: dateToUse,
          category: item.category,
          ingredientId: item.ingredientId,
          itemName: ingredientName,
          qtyPurchased: item.qtyPurchased,
          purchaseUnit: item.purchaseUnit,
          qtyInBaseUnit,
          totalPrice: item.totalPrice,
          pricePerBaseUnit,
          paymentMethod,
          supplier: supplier ?? "",
          notes: notes ?? "",
          createdBy: user.uid,
          createdAt: FieldValue.serverTimestamp(),
        });

        // Catat Log Pergerakan Stok (Stock Movements)
        const movementRef = adminDb.collection("stockMovements").doc();
        tx.set(movementRef, {
          ingredientId: item.ingredientId,
          changeAmount: qtyInBaseUnit,
          newStockAfter: newStock,
          sourceType: "purchase",
          sourceId: purchaseRef.id,
          note: `Restock via Pembelian`,
          createdBy: user.uid,
          createdAt: dateToUse,
        });
      }
    });

    return NextResponse.json({
      success: true,
      ids: savedIds,
      message: `${items.length} barang berhasil dibeli.`
    });
  } catch (err: any) {
    console.error("POST /api/purchases error:", err);
    return NextResponse.json({ error: err.message || "Gagal menyimpan pembelian" }, { status: 500 });
  }
}
