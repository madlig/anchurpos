import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET() {
  const snap = await adminDb.collection("orders").get();
  
  const updates = [];
  const results = [];
  
  for (const doc of snap.docs) {
    const data = doc.data();
    results.push({ id: doc.id, data });
    
    const updateData: any = {};
    let needsUpdate = false;
    
    if (!data.orderChannel) {
      updateData.orderChannel = "walkin";
      needsUpdate = true;
    }
    if (!data.paymentStatus) {
      updateData.paymentStatus = "belum_bayar";
      needsUpdate = true;
    }
    if (!data.status) {
      updateData.status = "pending";
      needsUpdate = true;
    }
    if (!data.createdAt) {
      updateData.createdAt = FieldValue.serverTimestamp();
      needsUpdate = true;
    }
    if (typeof data.createdAt === "string") {
      updateData.createdAt = new Date(data.createdAt);
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      updates.push({ ref: doc.ref, data: updateData });
    }
  }
  
  // Batch update
  const batch = adminDb.batch();
  updates.forEach(u => batch.update(u.ref, u.data));
  if (updates.length > 0) {
    await batch.commit();
  }
  
  return NextResponse.json({ 
    totalChecked: snap.size,
    totalUpdated: updates.length,
    orders: results 
  });
}
