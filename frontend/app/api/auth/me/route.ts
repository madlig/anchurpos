import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-middleware";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userDoc = await adminDb.collection("users").doc(user.uid).get();
  const userData = userDoc.data();

  return NextResponse.json({
    uid: user.uid,
    email: user.email,
    role: user.role,
    name: userData?.name ?? "",
    active: userData?.active ?? true,
  });
}
