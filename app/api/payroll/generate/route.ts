import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { month, startDate: reqStartDate, endDate: reqEndDate } = (await req.json()) as {
    month: string;
    startDate?: string;
    endDate?: string;
  };

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month wajib format YYYY-MM" }, { status: 400 });
  }

  try {
    const [year, mon] = month.split("-").map(Number);

    // Determine the date bounds for the query (inclusive)
    let finalStartDate: string;
    let finalEndDate: string;

    if (reqStartDate && reqEndDate) {
      finalStartDate = reqStartDate;
      finalEndDate = reqEndDate;
    } else {
      finalStartDate = `${year}-${String(mon).padStart(2, "0")}-01`;
      const daysInMonth = new Date(year, mon, 0).getDate();
      finalEndDate = `${year}-${String(mon).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    }

    const usersSnap = await adminDb
      .collection("users")
      .where("active", "==", true)
      .where("role", "==", "crew")
      .get();

    const generated: string[] = [];
    const skippedLocked: string[] = [];
    const warnings: string[] = [];

    // Helper to format Indonesian dates
    function formatIndoDate(dateStr: string) {
      const parts = dateStr.split("-");
      if (parts.length !== 3) return dateStr;
      const [yy, mm, dd] = parts;
      const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const mName = monthNames[parseInt(mm) - 1] || mm;
      return `${parseInt(dd)} ${mName} ${yy}`;
    }

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const employeeId = userDoc.id;
      const payrollId = `${month}_${employeeId}`;

      const existingSnap = await adminDb.doc(`payroll/${payrollId}`).get();
      if (existingSnap.exists && existingSnap.data()?.isLocked) {
        skippedLocked.push(userData.name ?? employeeId);
        continue;
      }

      const lengkapSnap = await adminDb
        .collection("attendance")
        .where("employeeId", "==", employeeId)
        .where("date", ">=", finalStartDate)
        .where("date", "<=", finalEndDate)
        .where("status", "==", "lengkap")
        .get();

      const direviewSnap = await adminDb
        .collection("attendance")
        .where("employeeId", "==", employeeId)
        .where("date", ">=", finalStartDate)
        .where("date", "<=", finalEndDate)
        .where("status", "==", "direview")
        .get();

      const workDays = lengkapSnap.size;
      const dailyWage = userData.dailyWage || 60000;
      const totalRegularPay = workDays * dailyWage;

      let totalOvertimeBonus = 0;
      for (const doc of lengkapSnap.docs) {
        totalOvertimeBonus += doc.data().overtimeBonus ?? 0;
      }

      const existingBonus = existingSnap.exists
        ? (existingSnap.data()?.performanceBonus ?? 0)
        : 0;

      // Format default work period
      let defaultWorkPeriod: string;
      if (reqStartDate && reqEndDate) {
        defaultWorkPeriod = `${formatIndoDate(finalStartDate)} - ${formatIndoDate(finalEndDate)}`;
      } else {
        const [y, m] = month.split("-");
        const monthNames = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        const monthName = monthNames[parseInt(m) - 1] || m;
        defaultWorkPeriod = `${monthName} ${y}`;
      }

      const existingWorkPeriod = existingSnap.exists
        ? (existingSnap.data()?.workPeriod ?? defaultWorkPeriod)
        : defaultWorkPeriod;

      const existingBonusNote = existingSnap.exists
        ? (existingSnap.data()?.performanceBonusNote ?? "")
        : "";

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
          performanceBonusNote: existingBonusNote,
          workPeriod: existingWorkPeriod,
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

      generated.push(userData.name ?? employeeId);

      if (pendingReview > 0) {
        warnings.push(`${userData.name}: ${pendingReview} absen masih direview`);
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      skippedLocked,
      warnings,
    });
  } catch (err) {
    console.error("POST /api/payroll/generate error:", err);
    return NextResponse.json({ error: "Gagal generate payroll" }, { status: 500 });
  }
}
