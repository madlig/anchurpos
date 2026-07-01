import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Parameter month wajib (format YYYY-MM)" }, { status: 400 });
  }

  try {
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 0, 23, 59, 59, 999);

    const snap = await adminDb
      .collection("cashTransfers")
      .where("date", ">=", start)
      .where("date", "<=", end)
      .orderBy("date", "desc")
      .get();

    const transfers = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.date?.toDate?.().toISOString() ?? "",
        amount: d.amount,
        from: d.from,
        to: d.to,
        notes: d.notes ?? "",
        createdBy: d.createdBy,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? "",
      };
    });

    return NextResponse.json(transfers);
  } catch (err) {
    console.error("GET /api/cash-transfers error:", err);
    return NextResponse.json({ error: "Gagal mengambil data mutasi kas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await req.json();
    const { amount, from, to, notes, customDate } = body as {
      amount: number;
      from: "cash" | "bank";
      to: "cash" | "bank";
      notes?: string;
      customDate?: string;
    };

    if (!amount || amount <= 0 || !from || !to) {
      return NextResponse.json({ error: "Data input mutasi kas tidak lengkap" }, { status: 400 });
    }

    if (from === to) {
      return NextResponse.json({ error: "Sumber transfer dan tujuan tidak boleh sama" }, { status: 400 });
    }

    const dateToUse = customDate ? new Date(customDate) : new Date();

    const transferRef = adminDb.collection("cashTransfers").doc();
    await transferRef.set({
      date: dateToUse,
      amount,
      from,
      to,
      notes: notes?.trim() || null,
      createdBy: user.uid,
      createdAt: dateToUse,
    });

    return NextResponse.json({ success: true, id: transferRef.id });
  } catch (err) {
    console.error("POST /api/cash-transfers error:", err);
    return NextResponse.json({ error: "Gagal mencatat mutasi kas" }, { status: 500 });
  }
}
