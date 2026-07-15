import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const reqStartDate = searchParams.get("startDate");
  const reqEndDate = searchParams.get("endDate");
  const employeeId = searchParams.get("employeeId");
  const flagged = searchParams.get("flagged") === "true";

  if (!month && !flagged && (!reqStartDate || !reqEndDate)) {
    return NextResponse.json({ error: "month atau startDate/endDate wajib diisi" }, { status: 400 });
  }

  try {
    const query = adminDb.collection("attendance");
    let snap;

    if (flagged) {
      // Query all records requiring review (status == "direview")
      snap = await query.where("status", "==", "direview").get();
    } else {
      let qStartDate = "";
      let qEndDate = "";

      if (reqStartDate && reqEndDate) {
        qStartDate = reqStartDate;
        qEndDate = reqEndDate; // inclusive if we use <=, but the original logic uses < endDate. If it's a specific date range (like 29 to 28), it should be <=.
        // Wait, the payroll route uses <= finalEndDate. So let's use <= here too for consistency if reqStartDate is provided.
      } else {
        const [year, mon] = month!.split("-").map(Number);
        qStartDate = `${year}-${String(mon).padStart(2, "0")}-01`;
        const endMonth = mon === 12 ? 1 : mon + 1;
        const endYear = mon === 12 ? year + 1 : year;
        qEndDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      }

      let q = query.where("date", ">=", qStartDate);
      if (reqStartDate && reqEndDate) {
        q = q.where("date", "<=", qEndDate);
      } else {
        q = q.where("date", "<", qEndDate);
      }

      if (employeeId) {
        q = q.where("employeeId", "==", employeeId);
      }
      snap = await q.get();
    }

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
        issue: d.flaggedReason ?? "Perlu review", // Map flaggedReason to issue for owner approval page
        reviewedBy: d.reviewedBy,
        reviewedAt: d.reviewedAt?.toDate?.().toISOString() ?? d.reviewedAt,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt,
      };
    });

    // Sort by date desc safely in-memory (avoids missing composite index errors in Firestore)
    records.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json(records);
  } catch (err) {
    console.error("GET /api/attendance error:", err);
    return NextResponse.json({ error: "Gagal mengambil data absensi" }, { status: 500 });
  }
}
