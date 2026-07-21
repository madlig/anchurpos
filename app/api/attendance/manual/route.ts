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
        ipValid: true
      },
      checkOut: {
        time: co.toISOString(),
        ipValid: true
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

    return NextResponse.json({ success: true, docId });
  } catch (error: any) {
    console.error("Manual attendance error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
