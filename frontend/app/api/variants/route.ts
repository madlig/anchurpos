import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { Variant } from "@/types";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("variants")
      .orderBy("sortOrder")
      .get();

    const variants: Variant[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        isProductionVariant: data.isProductionVariant,
        sortOrder: data.sortOrder,
      };
    });

    return NextResponse.json(variants);
  } catch (err) {
    console.error("GET /api/variants error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data varian" },
      { status: 500 }
    );
  }
}
