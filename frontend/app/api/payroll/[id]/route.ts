import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { performanceBonus } = (await req.json()) as { performanceBonus: number };

  if (performanceBonus === undefined || performanceBonus < 0) {
    return NextResponse.json({ error: "performanceBonus tidak valid" }, { status: 400 });
  }

  try {
    const docRef = adminDb.doc(`payroll/${id}`);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Payroll tidak ditemukan" }, { status: 404 });
    }

    const data = snap.data()!;
    if (data.isLocked) {
      return NextResponse.json({ error: "Payroll sudah terkunci (sudah dibayar)" }, { status: 400 });
    }

    const totalPaid = (data.totalRegularPay ?? 0) + (data.totalOvertimeBonus ?? 0) + performanceBonus;

    await docRef.update({ performanceBonus, totalPaid });

    return NextResponse.json({ success: true, totalPaid });
  } catch (err) {
    console.error("PATCH /api/payroll/[id] error:", err);
    return NextResponse.json({ error: "Gagal update payroll" }, { status: 500 });
  }
}
