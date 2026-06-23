import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  if (!month) {
    return NextResponse.json({ error: "month wajib diisi (format: 2026-06)" }, { status: 400 });
  }

  try {
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    const snap = await adminDb
      .collection("productions")
      .where("date", ">=", start)
      .where("date", "<", end)
      .get();

    const summary = new Map<string, { batches: number; loyangCount: number; entries: number }>();

    for (const doc of snap.docs) {
      const data = doc.data();
      const vid = data.variantId as string;
      const existing = summary.get(vid) ?? { batches: 0, loyangCount: 0, entries: 0 };
      existing.batches += data.batches ?? 0;
      existing.loyangCount += data.loyangCount ?? 0;
      existing.entries += 1;
      summary.set(vid, existing);
    }

    const result = Array.from(summary.entries()).map(([variantId, data]) => ({
      variantId,
      ...data,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/productions/summary error:", err);
    return NextResponse.json({ error: "Gagal mengambil ringkasan produksi" }, { status: 500 });
  }
}
