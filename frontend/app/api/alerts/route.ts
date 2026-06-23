import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const unread = searchParams.get("unread");

  try {
    let query: FirebaseFirestore.Query = adminDb
      .collection("alerts")
      .orderBy("createdAt", "desc")
      .limit(50);

    if (unread === "true") {
      query = adminDb
        .collection("alerts")
        .where("isRead", "==", false)
        .orderBy("createdAt", "desc")
        .limit(50);
    }

    const snap = await query.get();
    const results = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        type: d.type,
        severity: d.severity,
        title: d.title,
        message: d.message,
        sourceCollection: d.sourceCollection,
        sourceId: d.sourceId,
        isRead: d.isRead,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt,
      };
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/alerts error:", err);
    return NextResponse.json({ error: "Gagal mengambil alerts" }, { status: 500 });
  }
}
