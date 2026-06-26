import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb.doc("settings/productionConfig").get();
    if (!snap.exists) {
      return NextResponse.json({
        dailyLoyangTarget: 8,
      });
    }

    const d = snap.data()!;
    return NextResponse.json({
      dailyLoyangTarget: d.dailyLoyangTarget ?? 8,
    });
  } catch (err) {
    console.error("GET /api/settings/production error:", err);
    return NextResponse.json({ error: "Gagal mengambil pengaturan produksi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const { dailyLoyangTarget } = (await req.json()) as { dailyLoyangTarget: number };
    if (typeof dailyLoyangTarget !== "number" || dailyLoyangTarget < 0) {
      return NextResponse.json({ error: "Target loyang tidak valid" }, { status: 400 });
    }

    const configRef = adminDb.doc("settings/productionConfig");
    await configRef.set(
      {
        dailyLoyangTarget,
        updatedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, dailyLoyangTarget });
  } catch (err) {
    console.error("POST /api/settings/production error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan produksi" }, { status: 500 });
  }
}
