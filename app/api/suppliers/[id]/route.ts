import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { supplierSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const body = await req.json();
    const parseResult = supplierSchema.partial().safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
    }

    const supplierRef = adminDb.collection("suppliers").doc(id);
    const snap = await supplierRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Supplier tidak ditemukan" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const { name, code, category, contactPerson, phoneNumber, email, address, bankName, bankAccount, notes, paymentTerms, isActive } = parseResult.data;
    
    if (name !== undefined) updates.name = name.trim();
    if (code !== undefined) updates.code = code;
    if (category !== undefined) updates.category = category;
    if (contactPerson !== undefined) updates.contactPerson = contactPerson;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    if (bankName !== undefined) updates.bankName = bankName;
    if (bankAccount !== undefined) updates.bankAccount = bankAccount;
    if (notes !== undefined) updates.notes = notes;
    if (paymentTerms !== undefined) updates.paymentTerms = paymentTerms;
    if (isActive !== undefined) updates.isActive = isActive;

    await supplierRef.update(updates);
    return NextResponse.json({ id, ...updates });
  } catch (err) {
    console.error("PATCH /api/suppliers/[id] error:", err);
    return NextResponse.json({ error: "Gagal memperbarui supplier" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const supplierRef = adminDb.collection("suppliers").doc(id);
    await supplierRef.delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/suppliers/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus supplier" }, { status: 500 });
  }
}
