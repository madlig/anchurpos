import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import { productSchema } from "@/lib/validations";
import type { Product, PriceTier } from "@/types";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const [snap, allTiersSnap] = await Promise.all([
      adminDb.collection("products").where("isActive", "==", true).get(),
      adminDb.collectionGroup("priceTiers").get()
    ]);

    // Group price tiers by productId
    const tiersByProduct = new Map<string, PriceTier[]>();
    for (const tDoc of allTiersSnap.docs) {
      const productId = tDoc.ref.parent.parent?.id;
      if (!productId) continue;
      
      const tData = tDoc.data();
      const tier = {
        id: tDoc.id,
        minQty: tData.minQty,
        maxQty: tData.maxQty ?? null,
        price: tData.price,
      };
      
      if (!tiersByProduct.has(productId)) {
        tiersByProduct.set(productId, []);
      }
      tiersByProduct.get(productId)!.push(tier);
    }

    const products: (Product & { priceTiers: PriceTier[] })[] = snap.docs.map((doc) => {
      const data = doc.data();
      const priceTiers = (tiersByProduct.get(doc.id) || []).sort((a, b) => a.minQty - b.minQty);
      
      return {
        id: doc.id,
        code: data.code,
        name: data.name,
        description: data.description ?? "",
        packPerBatch: data.packPerBatch,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
        channels: data.channels ?? [],
        priceTiers,
      };
    });

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
  const parseResult = productSchema.safeParse(body);
  
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const { name, code, description, packPerBatch, priceTiers = [], channels } = parseResult.data;

  try {
    const ref = adminDb.collection("products").doc();
    await ref.set({
      name: name.trim(), code: code.trim().toUpperCase(),
      description, packPerBatch, isActive: true,
      channels,
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
