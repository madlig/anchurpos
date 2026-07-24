import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  try {
    const snap = await adminDb.collection("customer_tiers").get();
    const tiers = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Default fallback if empty
    if (tiers.length === 0) {
      return NextResponse.json([
        { id: "reguler", name: "Reguler", isB2B: false, themeColor: { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" }, isActive: true },
        { id: "b2b", name: "B2B", isB2B: true, themeColor: { bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" }, isActive: true },
        { id: "reseller", name: "Reseller", isB2B: true, themeColor: { bg: "#FEF3C7", color: "#D97706", border: "#FDE68A" }, isActive: true }
      ]);
    }

    return NextResponse.json(tiers);
  } catch (err) {
    console.error("GET /api/customer-tiers error:", err);
    return NextResponse.json({ error: "Gagal mengambil data tier pelanggan" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { id, name, isB2B, themeColor, isActive } = body as {
      id: string; name: string; isB2B: boolean; themeColor: any; isActive: boolean;
    };

    if (!id || !name) {
      return NextResponse.json({ error: "ID dan Nama wajib diisi" }, { status: 400 });
    }

    await adminDb.collection("customer_tiers").doc(id).set({
      name,
      isB2B: isB2B ?? false,
      themeColor: themeColor || { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
      isActive: isActive ?? true,
      updatedAt: new Date()
    });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("POST /api/customer-tiers error:", err);
    return NextResponse.json({ error: "Gagal menyimpan tier pelanggan" }, { status: 500 });
  }
}
