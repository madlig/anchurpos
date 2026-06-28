import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import type { Customer } from "@/types";

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
        channel: data.channel ?? "walk_in",
        customerType: data.customerType ?? "reguler",
        phoneNumber: data.phoneNumber ?? null,
        address: data.address ?? null,
        discountPerUnit: data.discountPerUnit ?? 0,
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
  const {
    name,
    channel = "walk_in",
    customerType = "reguler",
    phoneNumber = null,
    address = null,
    notes = "",
    createdVia = "manual"
  } = body as {
    name: string;
    channel?: string;
    customerType?: string;
    phoneNumber?: string | null;
    address?: string | null;
    notes?: string;
    createdVia?: string;
  };

  if (!name?.trim()) return NextResponse.json({ error: "Nama pelanggan wajib diisi" }, { status: 400 });

  try {
    const ref = adminDb.collection("customers").doc();
    await ref.set({
      name: name.trim(),
      channel,
      customerType,
      phoneNumber,
      address,
      notes,
      discountPerUnit: 0,
      isActive: true,
      createdVia,
      createdAt: new Date().toISOString()
    });
    return NextResponse.json({ id: ref.id, name: name.trim(), channel, customerType }, { status: 201 });
  } catch (err) {
    console.error("POST /api/customers error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pelanggan" }, { status: 500 });
  }
}
