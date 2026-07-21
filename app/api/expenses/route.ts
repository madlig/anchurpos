import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import { expenseCreateSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    let query = adminDb.collection("expenses").orderBy("date", "desc") as FirebaseFirestore.Query;

    if (startDate && endDate) {
      // Firebase stores dates as Timestamps, so we need Date objects
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query = query.where("date", ">=", start).where("date", "<=", end);
    }

    const snap = await query.limit(200).get();

    const expenses = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.date?.toDate?.().toISOString() ?? "",
        category: d.category,
        itemName: d.itemName,
        totalPrice: d.totalPrice,
        paymentMethod: d.paymentMethod,
        supplier: d.supplier ?? "",
        notes: d.notes ?? "",
        createdBy: d.createdBy,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? "",
        
        // Legacy fields for backward compatibility in UI temporarily
        ingredientId: d.ingredientId ?? null,
        qtyPurchased: d.qtyPurchased ?? null,
        purchaseUnit: d.purchaseUnit ?? null,
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
  
  // Zod validation using the strict create schema (only operasional and lain_lain)
  const parseResult = expenseCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const {
    itemName,
    category,
    totalPrice,
    paymentMethod,
    supplier,
    notes,
    customDate
  } = parseResult.data;
  
  try {
    const expenseRef = adminDb.collection("expenses").doc();
    const dateToUse = customDate ? new Date(customDate) : new Date();

    await expenseRef.set({
      date: dateToUse,
      category,
      itemName: itemName.trim(),
      totalPrice,
      paymentMethod,
      supplier: supplier ?? "",
      notes: notes ?? "",
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      id: expenseRef.id,
    });
  } catch (err) {
    console.error("POST /api/expenses error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pengeluaran" }, { status: 500 });
  }
}
