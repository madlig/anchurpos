import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const docRef = adminDb.collection("systemConfigs").doc("posPackagingRules");
    const snap = await docRef.get();

    if (!snap.exists) {
      // Default initial rules
      const defaultRules = [
        { id: "rule-1", minQty: 1, maxQty: 3, ingredientId: "plastik-regular", isActive: true },
        { id: "rule-2", minQty: 4, maxQty: 8, ingredientId: "plastik-full", isActive: true },
        { id: "rule-3", minQty: 9, maxQty: 999, ingredientId: "plastik-full", isActive: true },
      ];
      return NextResponse.json({ rules: defaultRules });
    }

    return NextResponse.json(snap.data() || { rules: [] });
  } catch (error) {
    console.error("GET /api/settings/pos-packaging error:", error);
    return NextResponse.json({ error: "Gagal mengambil aturan kemasan POS" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { rules } = body;

    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: "Rules harus berupa array" }, { status: 400 });
    }

    const docRef = adminDb.collection("systemConfigs").doc("posPackagingRules");
    await docRef.set({ rules, updatedAt: new Date() }, { merge: true });

    return NextResponse.json({ success: true, message: "Aturan kemasan POS berhasil disimpan" });
  } catch (error) {
    console.error("POST /api/settings/pos-packaging error:", error);
    return NextResponse.json({ error: "Gagal menyimpan aturan kemasan POS" }, { status: 500 });
  }
}
