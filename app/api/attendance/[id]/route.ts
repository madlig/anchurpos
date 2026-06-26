import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  }

  try {
    const snap = await adminDb.collection("attendance").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Absensi tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(snap.data());
  } catch (err) {
    return NextResponse.json({ error: "Gagal mengambil detail absensi" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { status, totalHours, regularHours, overtimeHours, overtimeBlocks, overtimeBonus, flaggedReason } = body;

    const attRef = adminDb.collection("attendance").doc(id);
    const snap = await attRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Absensi tidak ditemukan" }, { status: 404 });
    }

    const updates: Record<string, any> = {
      status: status || "lengkap",
      reviewedBy: user.uid,
      reviewedAt: FieldValue.serverTimestamp(),
    };

    if (totalHours !== undefined) updates.totalHours = Number(totalHours);
    if (regularHours !== undefined) updates.regularHours = Number(regularHours);
    if (overtimeHours !== undefined) updates.overtimeHours = Number(overtimeHours);
    if (overtimeBlocks !== undefined) updates.overtimeBlocks = Number(overtimeBlocks);
    if (overtimeBonus !== undefined) updates.overtimeBonus = Number(overtimeBonus);
    if (flaggedReason !== undefined) updates.flaggedReason = flaggedReason;

    await attRef.update(updates);

    // Resolve associated alerts
    const alertsSnap = await adminDb
      .collection("alerts")
      .where("sourceCollection", "==", "attendance")
      .where("sourceId", "==", id)
      .where("isRead", "==", false)
      .get();
    
    if (!alertsSnap.empty) {
      const batch = adminDb.batch();
      alertsSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          isRead: true,
          readBy: user.uid,
          readAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PATCH /api/attendance/[id] error:", err);
    return NextResponse.json({ error: err.message || "Gagal mereview absensi" }, { status: 500 });
  }
}
