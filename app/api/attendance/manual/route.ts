import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";
import { BUSINESS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth || (auth.role !== "manager" && auth.role !== "owner")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { employeeId, date, checkInTime, checkOutTime } = await req.json();

    if (!employeeId || !date || !checkInTime || !checkOutTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get employee details
    const empDoc = await adminDb.collection("users").doc(employeeId).get();
    if (!empDoc.exists) {
      return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
    }
    const employeeName = empDoc.data()?.name || "Unknown";

    // Format doc id: YYYY-MM-DD_employeeId
    const docId = `${date}_${employeeId}`;

    const existingDoc = await adminDb.collection("attendance").doc(docId).get();
    if (existingDoc.exists) {
      const existingData = existingDoc.data();
      if (existingData?.status === "lengkap") {
        return NextResponse.json({ error: "Absensi lengkap untuk karyawan ini di tanggal tersebut sudah ada!" }, { status: 400 });
      }
      // If it exists but NOT 'lengkap' (e.g. 'belum_lengkap'), allow overwriting
    }

    // Calculate total hours
    const ci = new Date(`${date}T${checkInTime}:00+07:00`);
    const co = new Date(`${date}T${checkOutTime}:00+07:00`);
    const msDiff = co.getTime() - ci.getTime();
    
    if (msDiff < 0) {
       return NextResponse.json({ error: "Jam keluar tidak boleh sebelum jam masuk" }, { status: 400 });
    }

    let totalHours = msDiff / (1000 * 60 * 60);
    // Simple rounding to 1 decimal place
    totalHours = Math.round(totalHours * 10) / 10;
    
    const regularHours = Math.min(totalHours, BUSINESS.REGULAR_HOURS_PER_SHIFT);
    const overtimeHours = Math.max(0, totalHours - BUSINESS.REGULAR_HOURS_PER_SHIFT);

    await adminDb.collection("attendance").doc(docId).set({
      employeeId,
      employeeName,
      date,
      status: "lengkap",
      checkIn: {
        time: ci.toISOString(),
        ipValid: true,
        photoUrl: null,
        locationValid: true,
      },
      checkOut: {
        time: co.toISOString(),
        ipValid: true,
        photoUrl: null,
        locationValid: true,
      },
      totalHours,
      regularHours,
      overtimeHours,
      overtimeBlocks: Math.floor(overtimeHours),
      overtimeBonus: 0,
      flaggedReason: "Diinput manual oleh Manager/Owner",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Sync to payroll
    if (empDoc.data()?.role === "crew") {
      const [year, month, day] = date.split("-").map(Number);
      let payrollYear = year;
      let payrollMonth = month;
      if (day >= 29) {
        payrollMonth += 1;
        if (payrollMonth > 12) { payrollMonth = 1; payrollYear += 1; }
      }
      const payrollMonthStr = `${payrollYear}-${String(payrollMonth).padStart(2, "0")}`;
      let prevMonth = payrollMonth - 1;
      let prevYear = payrollYear;
      if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
      const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-29`;
      const endDate = `${payrollYear}-${String(payrollMonth).padStart(2, "0")}-28`;

      const lengkapSnap = await adminDb.collection("attendance")
        .where("employeeId", "==", employeeId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .where("status", "==", "lengkap")
        .get();

      const validLengkapDocs = lengkapSnap.docs.filter(d => (d.data().totalHours || 0) > 0);
      const workDays = validLengkapDocs.length;
      const dailyWage = empDoc.data()?.dailyWage || 60000;
      const totalRegularPay = workDays * dailyWage;
      let totalOvertimeBonus = 0;
      for (const doc of validLengkapDocs) {
        totalOvertimeBonus += doc.data().overtimeBonus ?? 0;
      }

      const payrollId = `${payrollMonthStr}_${employeeId}`;
      const existingSnap = await adminDb.doc(`payroll/${payrollId}`).get();
      if (!existingSnap.exists || !existingSnap.data()?.isLocked) {
        const existingBonus = existingSnap.exists ? (existingSnap.data()?.performanceBonus ?? 0) : 0;
        await adminDb.doc(`payroll/${payrollId}`).set({
          month: payrollMonthStr,
          employeeId,
          employeeName,
          workDays,
          dailyWage,
          totalRegularPay,
          totalOvertimeBonus,
          performanceBonus: existingBonus,
          totalPaid: totalRegularPay + totalOvertimeBonus + existingBonus,
          pendingReview: 0,
          dataStatus: "final",
          status: "belum_dibayar",
          isLocked: false,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    }

    return NextResponse.json({ success: true, docId });
  } catch (error: any) {
    console.error("Manual attendance error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
