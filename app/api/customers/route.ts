import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import type { Customer } from "@/types";
import { customerSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const snap = await adminDb
      .collection("customers")
      .where("isActive", "==", true)
      .get();

    const customers: Customer[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        code: data.code ?? `CUST-${doc.id.slice(0, 4).toUpperCase()}`,
        channel: data.channel ?? "walk_in",
        customerType: data.customerType ?? "reguler",
        phoneNumber: data.phoneNumber ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        discountPerUnit: data.discountPerUnit ?? 0,
        creditLimit: data.creditLimit ?? 0,
        poNumber: data.poNumber ?? null,
        notes: data.notes ?? "",
        isActive: data.isActive,
        createdVia: data.createdVia ?? "manual",
      };
    });

    return NextResponse.json(customers.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err) {
    console.error("GET /api/customers error:", err);
    return NextResponse.json({ error: "Gagal mengambil data pelanggan" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parseResult = customerSchema.safeParse(body);
  
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const { name, code, channel, customerType, phoneNumber, email, address, creditLimit, poNumber, discountPerUnit, notes, createdVia } = parseResult.data;

  try {
    const ref = adminDb.collection("customers").doc();
    const customerCode = code || `CUST-${Math.floor(1000 + Math.random() * 9000)}`;

    await ref.set({
      name: name.trim(),
      code: customerCode,
      channel,
      customerType,
      phoneNumber,
      email: email || null,
      address: address || null,
      notes: notes || "",
      discountPerUnit: discountPerUnit || 0,
      creditLimit: creditLimit || 0,
      poNumber: poNumber || null,
      isActive: true,
      createdVia,
      createdAt: new Date().toISOString()
    });
    return NextResponse.json({ id: ref.id, name: name.trim(), code: customerCode, channel, customerType }, { status: 201 });
  } catch (err) {
    console.error("POST /api/customers error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pelanggan" }, { status: 500 });
  }
}
