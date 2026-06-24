import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { Product, PriceTier } from "@/types";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("products")
      .where("isActive", "==", true)
      .get();

    const products: (Product & { priceTiers: PriceTier[] })[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const tiersSnap = await adminDb
        .collection("products")
        .doc(doc.id)
        .collection("priceTiers")
        .orderBy("minQty")
        .get();

      const priceTiers: PriceTier[] = tiersSnap.docs.map((t) => ({
        id: t.id,
        minQty: t.data().minQty,
        maxQty: t.data().maxQty ?? null,
        price: t.data().price,
      }));

      products.push({
        id: doc.id,
        code: data.code,
        name: data.name,
        description: data.description ?? "",
        packPerBatch: data.packPerBatch,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
        priceTiers,
      });
    }

    return NextResponse.json(products.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil data produk" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { name, code, description = "", packPerBatch = 1, priceTiers = [] } = body as {
    name: string; code: string; description?: string;
    packPerBatch?: number; priceTiers?: { minQty: number; maxQty: number | null; price: number }[];
  };

  if (!name?.trim() || !code?.trim()) {
    return NextResponse.json({ error: "Nama dan kode produk wajib diisi" }, { status: 400 });
  }

  try {
    const ref = adminDb.collection("products").doc();
    await ref.set({
      name: name.trim(), code: code.trim().toUpperCase(),
      description, packPerBatch, isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    for (let i = 0; i < priceTiers.length; i++) {
      const tier = priceTiers[i];
      await ref.collection("priceTiers").doc(`t${i + 1}`).set({
        minQty: tier.minQty, maxQty: tier.maxQty ?? null, price: tier.price,
      });
    }
    return NextResponse.json({ id: ref.id, name: name.trim() }, { status: 201 });
  } catch (err) {
    console.error("POST /api/products error:", err);
    return NextResponse.json({ error: "Gagal membuat produk" }, { status: 500 });
  }
}
