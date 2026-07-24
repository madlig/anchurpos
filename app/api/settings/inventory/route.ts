import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

const DEFAULT_GLAZE_KEYWORDS = ["glaze", "saus", "jam", "selai", "krim", "cream", "curah"];

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const docRef = adminDb.collection("settings").doc("inventory");
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ glazeKeywords: DEFAULT_GLAZE_KEYWORDS });
    }

    const data = snap.data();
    const glazeKeywords = Array.isArray(data?.glazeKeywords) && data?.glazeKeywords.length > 0 
      ? data?.glazeKeywords 
      : DEFAULT_GLAZE_KEYWORDS;

    return NextResponse.json({ glazeKeywords });
  } catch (error) {
    console.error("GET /api/settings/inventory error:", error);
    return NextResponse.json({ error: "Gagal memuat pengaturan inventaris" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { glazeKeywords } = body;

    if (!Array.isArray(glazeKeywords)) {
      return NextResponse.json({ error: "Data kata kunci tidak valid" }, { status: 400 });
    }

    // Ubah ke huruf kecil semua untuk konsistensi pencarian
    const normalizedKeywords = glazeKeywords.map((k: string) => k.toLowerCase().trim()).filter(Boolean);

    await adminDb.collection("settings").doc("inventory").set({
      glazeKeywords: normalizedKeywords,
      updatedAt: new Date()
    }, { merge: true });

    return NextResponse.json({ success: true, glazeKeywords: normalizedKeywords });
  } catch (error) {
    console.error("POST /api/settings/inventory error:", error);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan inventaris" }, { status: 500 });
  }
}
