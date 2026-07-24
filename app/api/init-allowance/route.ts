import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  const products = await adminDb.collection("products").get();
  const batch = adminDb.batch();
  let count = 0;
  
  for (const doc of products.docs) {
    const data = doc.data();
    if (data.name.toLowerCase().includes("churros")) {
      batch.update(doc.ref, { freeSauceAllowance: 2 });
      count++;
    }
  }

  const variants = await adminDb.collection("variants").get();
  for (const doc of variants.docs) {
    const data = doc.data();
    if (data.name.toLowerCase().includes("full")) {
      batch.update(doc.ref, { freeSauceAllowance: 0 });
      count++;
    }
  }
  
  await batch.commit();
  return NextResponse.json({ updated: count });
}
