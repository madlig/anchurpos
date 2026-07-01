import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb.collection("addOns").orderBy("name", "asc").get();
    const addOns = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        price: d.price ?? 0,
        currentStock: d.currentStock ?? 0,
        minStock: d.minStock ?? 10,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? "",
      };
    });
    return NextResponse.json(addOns);
  } catch (err) {
    console.error("GET /api/addons error:", err);
    return NextResponse.json({ error: "Gagal mengambil data add-on" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await req.json();
    const { name, price, minStock } = body as {
      name: string;
      price: number;
      minStock?: number;
    };

    if (!name || !name.trim() || price === undefined) {
      return NextResponse.json({ error: "Nama dan harga wajib diisi" }, { status: 400 });
    }

    const docId = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
    const addOnRef = adminDb.collection("addOns").doc(docId);
    await addOnRef.set({
      name: name.trim(),
      price: Number(price),
      currentStock: 0,
      minStock: Number(minStock || 10),
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: docId });
  } catch (err) {
    console.error("POST /api/addons error:", err);
    return NextResponse.json({ error: "Gagal menyimpan data add-on" }, { status: 500 });
  }
}
