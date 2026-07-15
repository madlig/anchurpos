import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  const employeeId = "4ceVcbcULNZrl5N7SvE6wMvCG0n2"; // Ihsan
  const snap = await adminDb.collection("attendance").where("employeeId", "==", employeeId).where("date", "==", "2026-07-06").get();
  
  return NextResponse.json(snap.docs.map(d => d.data()));
}
