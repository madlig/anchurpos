import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";
import type { FreezerRakStock } from "@/types";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const [variantsSnap, rakSnap] = await Promise.all([
      adminDb.collection("variants").orderBy("sortOrder").get(),
      adminDb.collection("freezerRakStocks").get(),
    ]);

    const rakMap = new Map<string, { totalLoyang: number; totalPcs: number; updatedAt?: string }>();
    rakSnap.docs.forEach((doc) => {
      const data = doc.data();
      rakMap.set(doc.id, {
        totalLoyang: data.totalLoyang ?? 0,
        totalPcs: data.totalPcs ?? 0,
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      });
    });

    const results: FreezerRakStock[] = variantsSnap.docs.map((doc) => {
      const v = doc.data();
      const stock = rakMap.get(doc.id) ?? { totalLoyang: 0, totalPcs: 0, updatedAt: new Date().toISOString() };
      return {
        id: doc.id,
        variantId: doc.id,
        variantName: v.name || "Varian",
        totalLoyang: stock.totalLoyang,
        totalPcs: stock.totalPcs,
        updatedAt: stock.updatedAt || new Date().toISOString(),
      };
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/sfm/freezer-rak error:", err);
    return NextResponse.json({ error: "Gagal mengambil data stok freezer rak" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { variantId, variantName, totalLoyang, totalPcs, note } = body as {
      variantId: string;
      variantName?: string;
      totalLoyang: number;
      totalPcs: number;
      note?: string;
    };

    if (!variantId || totalLoyang === undefined || totalPcs === undefined) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const docRef = adminDb.collection("freezerRakStocks").doc(variantId);
    await docRef.set(
      {
        variantId,
        variantName: variantName || variantId,
        totalLoyang: Math.max(0, Number(totalLoyang)),
        totalPcs: Math.max(0, Number(totalPcs)),
        updatedAt: FieldValue.serverTimestamp(),
        lastUpdatedBy: auth.uid,
        lastNote: note || "Koreksi manual freezer rak",
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, variantId, totalLoyang, totalPcs });
  } catch (err) {
    console.error("PATCH /api/sfm/freezer-rak error:", err);
    return NextResponse.json({ error: "Gagal memperbarui stok freezer rak" }, { status: 500 });
  }
}
