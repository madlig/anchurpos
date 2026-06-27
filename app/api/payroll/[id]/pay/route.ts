import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await req.json()) as { confirmedDespitePartial?: boolean };

  try {
    const docRef = adminDb.doc(`payroll/${id}`);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Payroll tidak ditemukan" }, { status: 404 });
    }

    const data = snap.data()!;
    if (data.isLocked) {
      return NextResponse.json({ error: "Payroll sudah dibayar sebelumnya" }, { status: 400 });
    }

    if (data.dataStatus === "parsial" && !body.confirmedDespitePartial) {
      return NextResponse.json(
        {
          error: "Data masih parsial",
          pendingReview: data.pendingReview,
          requiresConfirmation: true,
        },
        { status: 400 }
      );
    }

    await docRef.update({
      status: "sudah_dibayar",
      isLocked: true,
      paidAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/payroll/[id]/pay error:", err);
    return NextResponse.json({ error: "Gagal update status bayar" }, { status: 500 });
  }
}
