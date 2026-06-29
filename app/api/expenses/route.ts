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

function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = a[i - 1] === b[j - 1] 
        ? tmp[i - 1][j - 1] 
        : Math.min(tmp[i - 1][j] + 1, tmp[i][j - 1] + 1, tmp[i - 1][j - 1] + 1);
    }
  }
  return tmp[a.length][b.length];
}

function getSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;
  return (longer.length - getLevenshteinDistance(longer, shorter)) / longer.length;
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const body = await req.json();
  const {
    ingredientId: initialIngredientId,
    itemName,
    category,
    qtyPurchased,
    purchaseUnit,
    totalPrice,
    paymentMethod,
    supplier,
    notes,
    customDate,
    forceCreateNew,
  } = body;

  if (!itemName || !category || !totalPrice || !paymentMethod) {
    return NextResponse.json({ error: "Field wajib tidak lengkap" }, { status: 400 });
  }

  try {
    const expenseRef = adminDb.collection("expenses").doc();
    const dateToUse = customDate ? new Date(customDate) : new Date();

    let finalIngredientId = initialIngredientId ?? null;
    let qtyInBaseUnit = 0;
    let pricePerBaseUnit = 0;
    let matchedIngredientName = "";
    let isNewCreated = false;

    // Run transaction to resolve ingredient, create if new, and record expense
    await adminDb.runTransaction(async (tx) => {
      // 1. Jika ini adalah bahan baku / packaging dan belum ada ID terlampir, cari secara fuzzy (kecuali dipaksa buat baru)
      if ((category === "bahan_baku" || category === "packaging") && !finalIngredientId) {
        let shouldSearchFuzzy = !forceCreateNew;
        let closestMatch: { id: string; name: string; baseUnit: string; unitAlternatives: any[] } | null = null;
        let highestSim = 0;

        if (shouldSearchFuzzy) {
          const ingredientsSnap = await tx.get(
            adminDb.collection("ingredients").where("category", "==", category)
          );

          ingredientsSnap.docs.forEach((doc) => {
            const data = doc.data();
            const sim = getSimilarity(itemName, data.name || "");
            if (sim > highestSim) {
              highestSim = sim;
              closestMatch = {
                id: doc.id,
                name: data.name,
                baseUnit: data.baseUnit,
                unitAlternatives: data.unitAlternatives || [],
              };
            }
          });
        }

        // Threshold kecocokan fuzzy: 85% mirip
        if (highestSim >= 0.85 && closestMatch) {
          finalIngredientId = (closestMatch as any).id;
          matchedIngredientName = (closestMatch as any).name;
        } else {
          // Buat data bahan baku baru di database
          const cleanSlug = itemName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
          
          const newId = `${category}-${cleanSlug}-${Date.now().toString().slice(-4)}`;
          const newIngRef = adminDb.collection("ingredients").doc(newId);

          tx.set(newIngRef, {
            name: itemName.trim(),
            category,
            baseUnit: purchaseUnit || "pcs",
            currentStock: 0,
            unitAlternatives: [],
            isActive: true,
            createdAt: FieldValue.serverTimestamp(),
          });

          finalIngredientId = newId;
          isNewCreated = true;
        }
      }

      // 2. Kalkulasi konversi unit berdasarkan bahan terpilih / baru dibuat
      if (finalIngredientId && qtyPurchased && purchaseUnit) {
        const ingRef = adminDb.collection("ingredients").doc(finalIngredientId);
        const ingSnap = await tx.get(ingRef);
        const ingData = ingSnap.data();

        if (ingData) {
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
            // Jika konversi gagal (satuan tidak dikenal), anggap 1:1 jika baru saja dibuat
            qtyInBaseUnit = qtyPurchased;
            pricePerBaseUnit = totalPrice / qtyPurchased;
          }
        }
      }

      // 3. Tulis Dokumen Pengeluaran
      tx.set(expenseRef, {
        date: dateToUse,
        category,
        ingredientId: finalIngredientId,
        itemName: matchedIngredientName || itemName.trim(),
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

      // 4. Update stok & log movement
      if (finalIngredientId && qtyInBaseUnit > 0) {
        const ingRef = adminDb.collection("ingredients").doc(finalIngredientId);
        const ingSnap = await tx.get(ingRef);
        const currentStock = ingSnap.data()?.currentStock ?? 0;
        const newStock = currentStock + qtyInBaseUnit;

        tx.update(ingRef, { currentStock: newStock });

        const movementRef = adminDb.collection("stockMovements").doc();
        tx.set(movementRef, {
          ingredientId: finalIngredientId,
          changeAmount: qtyInBaseUnit,
          newStockAfter: newStock,
          sourceType: "expense",
          sourceId: expenseRef.id,
          note: isNewCreated ? `Bahan baru dibuat otomatis dari input pengeluaran` : null,
          createdBy: user.uid,
          createdAt: dateToUse,
        });
      }
    });

    return NextResponse.json({
      success: true,
      id: expenseRef.id,
      ingredientId: finalIngredientId,
      matchedName: matchedIngredientName || null,
      isNewCreated,
      qtyInBaseUnit,
      pricePerBaseUnit,
    });
  } catch (err) {
    console.error("POST /api/expenses error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pengeluaran" }, { status: 500 });
  }
}
