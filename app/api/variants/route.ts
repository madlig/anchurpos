import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { Variant } from "@/types";
import { variantSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb
      .collection("variants")
      .orderBy("sortOrder")
      .get();

    const variants: Variant[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        productId: data.productId ?? "",
        name: data.name,
        isProductionVariant: data.isProductionVariant ?? true,
        sortOrder: data.sortOrder ?? 0,
        currentStock: data.currentStock ?? 0,
        minStock: data.minStock ?? 10,
        freeSauceAllowance: data.freeSauceAllowance,
      };
    });

    return NextResponse.json(variants);
  } catch (err) {
    console.error("GET /api/variants error:", err);
    return NextResponse.json({ error: "Gagal mengambil data varian" }, { status: 500 });
  }
}

// POST — tambah varian baru (Master Data)
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parseResult = variantSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const { name, productId, sortOrder, minStock, freeSauceAllowance } = parseResult.data;

  try {
    const ref = adminDb.collection("variants").doc();
    await ref.set({
      name: name.trim(),
      productId: productId.trim(),
      isProductionVariant: true,
      sortOrder,
      currentStock: 0,
      minStock,
      ...(typeof freeSauceAllowance === "number" ? { freeSauceAllowance } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, name: name.trim(), currentStock: 0, minStock });
  } catch (err) {
    console.error("POST /api/variants error:", err);
    return NextResponse.json({ error: "Gagal membuat varian" }, { status: 500 });
  }
}
