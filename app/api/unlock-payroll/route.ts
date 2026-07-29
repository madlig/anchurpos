import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snap = await adminDb.collection("payroll").where("isLocked", "==", true).get();
    
    if (snap.empty) {
      return NextResponse.json({ message: "No locked payroll found." });
    }

    const batch = adminDb.batch();
    let count = 0;

    snap.docs.forEach(doc => {
      batch.update(doc.ref, {
        isLocked: false,
        paidAt: null
      });
      count++;
    });

    await batch.commit();
    return NextResponse.json({ message: `Successfully unlocked ${count} payroll records.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
