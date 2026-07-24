import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  try {
    const snap = await adminDb.collection("order_channels").get();
    const channels = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Default fallback if empty
    if (channels.length === 0) {
      return NextResponse.json([
        { id: "walkin", name: "Walk-in", defaultPlatformFeePercent: 0, isActive: true },
        { id: "whatsapp", name: "WhatsApp", defaultPlatformFeePercent: 0, isActive: true },
        { id: "tiktok", name: "TikTok", defaultPlatformFeePercent: 0, isActive: true },
        { id: "shopee", name: "Shopee", defaultPlatformFeePercent: 0, isActive: true }
      ]);
    }

    return NextResponse.json(channels);
  } catch (err) {
    console.error("GET /api/order-channels error:", err);
    return NextResponse.json({ error: "Gagal mengambil data channel" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { id, name, defaultPlatformFeePercent, isActive } = body as {
      id: string; name: string; defaultPlatformFeePercent: number; isActive: boolean;
    };

    if (!id || !name) {
      return NextResponse.json({ error: "ID dan Nama wajib diisi" }, { status: 400 });
    }

    await adminDb.collection("order_channels").doc(id).set({
      name,
      defaultPlatformFeePercent: defaultPlatformFeePercent || 0,
      isActive: isActive ?? true,
      updatedAt: new Date()
    });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("POST /api/order-channels error:", err);
    return NextResponse.json({ error: "Gagal menyimpan channel" }, { status: 500 });
  }
}
