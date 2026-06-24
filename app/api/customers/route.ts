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
        channel: data.channel,
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
    return NextResponse.json(
      { error: "Gagal mengambil data pelanggan" },
      { status: 500 }
    );
  }
}
