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
      // === FASE 1: READS ===
      let closestMatch: { id: string; name: string; baseUnit: string; unitAlternatives: any[]; currentStock: number } | null = null;
      let highestSim = 0;
      let existingIngredientData: any = null;

      // 1A. Jika ini bahan baku/packaging/operasional dan belum ada ID, lakukan pencarian fuzzy
      if ((category === "bahan_baku" || category === "packaging" || category === "operasional") && !finalIngredientId && !forceCreateNew) {
        const ingredientsSnap = await tx.get(
          adminDb.collection("ingredients").where("category", "==", category)
        );

        for (const doc of ingredientsSnap.docs) {
          const data = doc.data();
          const sim = getSimilarity(itemName, data.name || "");
          if (sim > highestSim) {
            highestSim = sim;
            closestMatch = {
              id: doc.id,
              name: data.name,
              baseUnit: data.baseUnit,
              unitAlternatives: data.unitAlternatives || [],
              currentStock: data.currentStock || 0,
            };
          }
        }
      }

      // 1B. Jika ada ID terlampir, ambil data bahan
      if (finalIngredientId) {
        const ingRef = adminDb.collection("ingredients").doc(finalIngredientId);
        const ingSnap = await tx.get(ingRef);
        if (ingSnap.exists) {
          existingIngredientData = { id: ingSnap.id, ...ingSnap.data() };
        }
      }

      // === FASE 2: KALKULASI LOKAL (Tanpa operasi database) ===
      let ingredientDataToUse = existingIngredientData;
      
      if (!finalIngredientId && highestSim >= 0.85 && closestMatch) {
        finalIngredientId = closestMatch.id;
        matchedIngredientName = closestMatch.name;
        ingredientDataToUse = closestMatch;
      } 
      
      let newIngId = "";
      if ((category === "bahan_baku" || category === "packaging" || category === "operasional") && !finalIngredientId) {
        // Harus membuat baru
        const cleanSlug = itemName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        newIngId = `${category}-${cleanSlug}-${Date.now().toString().slice(-4)}`;
        finalIngredientId = newIngId;
        isNewCreated = true;
        ingredientDataToUse = {
          id: newIngId,
          name: itemName.trim(),
          category,
          baseUnit: purchaseUnit || "pcs",
          currentStock: 0,
          unitAlternatives: [],
          isActive: true
        };
      }

      // Hitung konversi unit
      if (finalIngredientId && qtyPurchased && purchaseUnit && ingredientDataToUse) {
        const result = convertToBaseUnit(
          qtyPurchased,
          purchaseUnit,
          ingredientDataToUse.baseUnit,
          ingredientDataToUse.unitAlternatives ?? []
        );

        if (result) {
          qtyInBaseUnit = result.qtyInBaseUnit;
          pricePerBaseUnit = qtyInBaseUnit > 0 ? totalPrice / qtyInBaseUnit : 0;
        } else {
          qtyInBaseUnit = qtyPurchased;
          pricePerBaseUnit = totalPrice / qtyPurchased;
        }
      }

      // === FASE 3: WRITES ===
      
      // 3A. Buat bahan baru jika diperlukan
      if (isNewCreated && newIngId) {
        const newIngRef = adminDb.collection("ingredients").doc(newIngId);
        tx.set(newIngRef, {
          name: itemName.trim(),
          category,
          baseUnit: purchaseUnit || "pcs",
          currentStock: qtyInBaseUnit > 0 ? qtyInBaseUnit : 0, // Set stok awal langsung di sini
          unitAlternatives: [],
          isActive: true,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // 3B. Update stok bahan yang sudah ada
      if (!isNewCreated && finalIngredientId && qtyInBaseUnit > 0) {
        const ingRef = adminDb.collection("ingredients").doc(finalIngredientId);
        const currentStock = ingredientDataToUse?.currentStock ?? 0;
        tx.update(ingRef, { currentStock: currentStock + qtyInBaseUnit });
      }

      // 3C. Buat dokumen pengeluaran
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

      // 3D. Catat riwayat pergerakan stok
      if (finalIngredientId && qtyInBaseUnit > 0) {
        const movementRef = adminDb.collection("stockMovements").doc();
        const currentStock = ingredientDataToUse?.currentStock ?? 0;
        const newStock = isNewCreated ? qtyInBaseUnit : currentStock + qtyInBaseUnit;

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
