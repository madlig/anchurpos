import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const employeeId = searchParams.get("employeeId");

  if (!month) {
    return NextResponse.json({ error: "month wajib diisi (format: 2026-06)" }, { status: 400 });
  }

  try {
    const [year, mon] = month.split("-").map(Number);
    const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
    const endMonth = mon === 12 ? 1 : mon + 1;
    const endYear = mon === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    let query = adminDb
      .collection("attendance")
      .where("date", ">=", startDate)
      .where("date", "<", endDate)
      .orderBy("date", "desc");

    if (employeeId) {
      query = query.where("employeeId", "==", employeeId);
    }

    const snap = await query.get();

    const records = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.date,
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        checkIn: d.checkIn,
        checkOut: d.checkOut,
        totalHours: d.totalHours,
        regularHours: d.regularHours,
        overtimeHours: d.overtimeHours,
        overtimeBlocks: d.overtimeBlocks,
        overtimeBonus: d.overtimeBonus,
        status: d.status,
        flaggedReason: d.flaggedReason,
        reviewedBy: d.reviewedBy,
        reviewedAt: d.reviewedAt?.toDate?.().toISOString() ?? d.reviewedAt,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt,
      };
    });

    return NextResponse.json(records);
  } catch (err) {
    console.error("GET /api/attendance error:", err);
    return NextResponse.json({ error: "Gagal mengambil data absensi" }, { status: 500 });
  }
}
