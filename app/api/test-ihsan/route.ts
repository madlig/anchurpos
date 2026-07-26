import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const users = await adminDb.collection("users").where("name", "==", "Ihsan").get();
  if (users.empty) return NextResponse.json({ error: "Ihsan not found" });
  
  const ihsanId = users.docs[0].id;
  
  const snap = await adminDb.collection("attendance")
    .where("employeeId", "==", ihsanId)
    .where("date", ">=", "2026-06-26")
    .where("date", "<=", "2026-07-28")
    .get();

  const records = snap.docs.map(d => d.data());
  records.sort((a, b) => a.date.localeCompare(b.date));
  
  return NextResponse.json(records);
}
