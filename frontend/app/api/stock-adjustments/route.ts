import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  try {
    let query: FirebaseFirestore.Query = adminDb.collection("stockAdjustments");

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, mon] = month.split("-").map(Number);
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0, 23, 59, 59, 999);
      query = query.where("date", ">=", start).where("date", "<=", end);
    }

    query = query.orderBy("date", "desc").limit(100);
    const snap = await query.get();

    const items = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.date?.toDate?.().toISOString() ?? d.date,
        productId: d.productId,
        variantId: d.variantId,
        qty: d.qty,
        reasonCategory: d.reasonCategory,
        reasonCustom: d.reasonCustom,
        recipientName: d.recipientName,
        hppPerUnit: d.hppPerUnit,
        totalCost: d.totalCost,
        createdBy: d.createdBy,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt,
      };
    });

    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /api/stock-adjustments error:", err);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { productId, variantId, qty, reasonCategory, reasonCustom, recipientName } = body;

    if (!productId || !variantId || !qty || qty <= 0 || !reasonCategory) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const validReasons = ["sample_affiliate", "hadiah_bonus", "rusak_reject", "konsumsi_internal", "lainnya"];
    if (!validReasons.includes(reasonCategory)) {
      return NextResponse.json({ error: "Kategori alasan tidak valid" }, { status: 400 });
    }

    const hppPerUnit = 0;

    const docRef = adminDb.collection("stockAdjustments").doc();
    await docRef.set({
      date: FieldValue.serverTimestamp(),
      productId,
      variantId,
      qty,
      reasonCategory,
      reasonCustom: reasonCustom || null,
      recipientName: recipientName || null,
      hppPerUnit,
      totalCost: qty * hppPerUnit,
      createdBy: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, adjustmentId: docRef.id, totalCost: qty * hppPerUnit });
  } catch (err) {
    console.error("POST /api/stock-adjustments error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pengeluaran stok" }, { status: 500 });
  }
}
