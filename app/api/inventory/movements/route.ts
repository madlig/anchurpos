import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "owner" && auth.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const ingredientId = url.searchParams.get("ingredientId");
  const limitParam = url.searchParams.get("limit") || "100";

  try {
    let query: FirebaseFirestore.Query = adminDb.collection("stockMovements");

    if (ingredientId) {
      query = query.where("ingredientId", "==", ingredientId);
    }
    
    query = query.orderBy("timestamp", "desc").limit(parseInt(limitParam, 10));

    const snap = await query.get();
    const movements = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json(movements);
  } catch (error: any) {
    console.error("GET StockMovements error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
