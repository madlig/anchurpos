import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb.collection("suppliers").orderBy("name", "asc").get();
    const suppliers = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        contactPerson: d.contactPerson ?? "",
        phoneNumber: d.phoneNumber ?? "",
        createdAt: d.createdAt?.toDate?.().toISOString() ?? "",
      };
    });
    return NextResponse.json(suppliers);
  } catch (err) {
    console.error("GET /api/suppliers error:", err);
    return NextResponse.json({ error: "Gagal mengambil data supplier" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await req.json();
    const { name, contactPerson, phoneNumber } = body as {
      name: string;
      contactPerson?: string;
      phoneNumber?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nama supplier wajib diisi" }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check duplicate name
    const existingSnap = await adminDb
      .collection("suppliers")
      .where("name", "==", trimmedName)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      return NextResponse.json({ 
        success: true, 
        id: doc.id, 
        message: "Supplier sudah terdaftar",
        name: doc.data().name
      });
    }

    const supplierRef = adminDb.collection("suppliers").doc();
    await supplierRef.set({
      name: trimmedName,
      contactPerson: contactPerson?.trim() || null,
      phoneNumber: phoneNumber?.trim() || null,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: supplierRef.id, name: trimmedName });
  } catch (err) {
    console.error("POST /api/suppliers error:", err);
    return NextResponse.json({ error: "Gagal menyimpan supplier" }, { status: 500 });
  }
}
