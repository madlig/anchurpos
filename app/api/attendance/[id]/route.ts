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

    // Automatic payroll sync for crew
    const attData = snap.data()!;
    const employeeId = attData.employeeId;
    const date = attData.date;
    const month = date.substring(0, 7);

    const userSnap = await adminDb.doc(`users/${employeeId}`).get();
    if (userSnap.exists && userSnap.data()?.role === "crew") {
      const userData = userSnap.data()!;
      const [year, mon] = month.split("-").map(Number);
      const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
      const endMonth = mon === 12 ? 1 : mon + 1;
      const endYear = mon === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const lengkapSnap = await adminDb
        .collection("attendance")
        .where("employeeId", "==", employeeId)
        .where("date", ">=", startDate)
        .where("date", "<", endDate)
        .where("status", "==", "lengkap")
        .get();

      const direviewSnap = await adminDb
        .collection("attendance")
        .where("employeeId", "==", employeeId)
        .where("date", ">=", startDate)
        .where("date", "<", endDate)
        .where("status", "==", "direview")
        .get();

      const workDays = lengkapSnap.size;
      const dailyWage = userData.dailyWage || 60000;
      const totalRegularPay = workDays * dailyWage;

      let totalOvertimeBonus = 0;
      for (const doc of lengkapSnap.docs) {
        totalOvertimeBonus += doc.data().overtimeBonus ?? 0;
      }

      const payrollId = `${month}_${employeeId}`;
      const existingSnap = await adminDb.doc(`payroll/${payrollId}`).get();
      if (!existingSnap.exists || !existingSnap.data()?.isLocked) {
        const existingBonus = existingSnap.exists
          ? (existingSnap.data()?.performanceBonus ?? 0)
          : 0;

        const pendingReview = direviewSnap.size;
        const dataStatus = pendingReview > 0 ? "parsial" : "final";
        const totalPaid = totalRegularPay + totalOvertimeBonus + existingBonus;

        await adminDb.doc(`payroll/${payrollId}`).set(
          {
            month,
            employeeId,
            employeeName: userData.name ?? employeeId,
            workDays,
            dailyWage,
            totalRegularPay,
            totalOvertimeBonus,
            performanceBonus: existingBonus,
            totalPaid,
            pendingReview,
            dataStatus,
            status: existingSnap.exists ? (existingSnap.data()?.status ?? "belum_dibayar") : "belum_dibayar",
            paidAt: existingSnap.exists ? (existingSnap.data()?.paidAt ?? null) : null,
            isLocked: false,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: false }
        );
      }
    }

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
