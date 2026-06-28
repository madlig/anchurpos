import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

const DOC_REF = "settings/marketplace_fees";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb.doc(DOC_REF).get();
    if (!snap.exists) {
      return NextResponse.json({ tiktok: 0, shopee: 0 });
    }
    const data = snap.data()!;
    return NextResponse.json({ tiktok: data.tiktok ?? 0, shopee: data.shopee ?? 0 });
  } catch (err) {
    console.error("GET /api/settings/marketplace-fee error:", err);
    return NextResponse.json({ error: "Gagal mengambil data fee" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const updates: Record<string, number> = {};

    if (body.tiktok !== undefined) updates.tiktok = Number(body.tiktok) || 0;
    if (body.shopee !== undefined) updates.shopee = Number(body.shopee) || 0;

    await adminDb.doc(DOC_REF).set(updates, { merge: true });
    return NextResponse.json({ success: true, ...updates });
  } catch (err) {
    console.error("PATCH /api/settings/marketplace-fee error:", err);
    return NextResponse.json({ error: "Gagal menyimpan fee" }, { status: 500 });
  }
}
