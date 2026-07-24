import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import { ingredientSchema } from "@/lib/validations";
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
        channels: data.channels ?? [],
        defaultCostPerBaseUnit: data.defaultCostPerBaseUnit ?? 0,
      };
    });

    return NextResponse.json(ingredients);
  } catch (err) {
    console.error("GET /api/ingredients error:", err);
    return NextResponse.json({ error: "Gagal mengambil data bahan" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parseResult = ingredientSchema.safeParse(body);
  
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const { name, category, baseUnit, minStock, channels, unitAlternatives, defaultCostPerBaseUnit } = parseResult.data;

  try {
    const ref = adminDb.collection("ingredients").doc();
    await ref.set({
      name: name.trim(), category, baseUnit: baseUnit.trim(),
      currentStock: 0, minStock,
      unitAlternatives, opnameMethod: "direct",
      packagedConfig: null,
      channels,
      defaultCostPerBaseUnit: defaultCostPerBaseUnit ?? 0,
      lastHppUpdateDate: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, name: name.trim() }, { status: 201 });
  } catch (err) {
    console.error("POST /api/ingredients error:", err);
    return NextResponse.json({ error: "Gagal membuat bahan" }, { status: 500 });
  }
}
