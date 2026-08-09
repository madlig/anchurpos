import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import { supplierSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb.collection("suppliers").orderBy("name", "asc").get();
    const suppliers = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        code: d.code ?? `VEND-${doc.id.slice(0, 4).toUpperCase()}`,
        name: d.name,
        category: d.category ?? "Bahan Baku",
        contactPerson: d.contactPerson ?? "",
        phoneNumber: d.phoneNumber ?? "",
        email: d.email ?? "",
        address: d.address ?? "",
        notes: d.notes ?? "",
        paymentTerms: d.paymentTerms ?? "Cash",
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
    const parseResult = supplierSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
    }

    const { name, code, category, contactPerson, phoneNumber, email, address, bankName, bankAccount, notes } = parseResult.data;
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

    const supplierCode = body.code || `VEND-${Math.floor(1000 + Math.random() * 9000)}`;
    const supplierRef = adminDb.collection("suppliers").doc();
    await supplierRef.set({
      code: supplierCode,
      name: trimmedName,
      category: category || "Bahan Baku",
      contactPerson: contactPerson || null,
      phoneNumber: phoneNumber || null,
      email: email || null,
      address: address || null,
      bankName: bankName || null,
      bankAccount: bankAccount || null,
      notes: notes || "",
      paymentTerms: body.paymentTerms || "Cash",
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: supplierRef.id, code: supplierCode, name: trimmedName });
  } catch (err) {
    console.error("POST /api/suppliers error:", err);
    return NextResponse.json({ error: "Gagal menyimpan supplier" }, { status: 500 });
  }
}
