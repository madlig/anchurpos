import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  
  try {
    const data = await req.json();
    
    // Validasi basic
    if (!data.employeeId || !data.month || data.totalPaid === undefined) {
      return NextResponse.json({ error: "Data payroll tidak valid" }, { status: 400 });
    }

    const docRef = adminDb.doc(`payroll/${id}`);
    const snap = await docRef.get();

    if (snap.exists && snap.data()?.isLocked) {
      return NextResponse.json({ error: "Payroll sudah terkunci (sudah dibayar)" }, { status: 400 });
    }

    // Pastikan diset locked true
    data.isLocked = true;
    if (!data.lockedAt) {
      data.lockedAt = new Date().toISOString();
    }

    await docRef.set(data, { merge: true });

    return NextResponse.json({ success: true, totalPaid: data.totalPaid });
  } catch (err) {
    console.error("PUT /api/payroll/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengunci payroll" }, { status: 500 });
  }
}
