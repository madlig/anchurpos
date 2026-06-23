import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import type { Ingredient } from "@/types";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb
      .collection("ingredients")
      .orderBy("name")
      .get();

    const ingredients: Ingredient[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        category: data.category,
        baseUnit: data.baseUnit,
        currentStock: data.currentStock,
        minStock: data.minStock,
        unitAlternatives: data.unitAlternatives ?? [],
        opnameMethod: data.opnameMethod ?? "direct",
        packagedConfig: data.packagedConfig ?? null,
      };
    });

    return NextResponse.json(ingredients);
  } catch (err) {
    console.error("GET /api/ingredients error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data bahan" },
      { status: 500 }
    );
  }
}
