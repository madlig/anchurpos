import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as any; // We know it's AuthUser

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  if (!month) {
    return NextResponse.json({ error: "month wajib diisi (format: 2026-06)" }, { status: 400 });
  }

  try {
    let query = adminDb
      .collection("payroll")
      .where("month", "==", month);
      
    if (user.role === "crew") {
       query = query.where("employeeId", "==", user.uid).where("isLocked", "==", true);
    } else {
       query = query.orderBy("employeeName", "asc");
    }

    const snap = await query.get();

    const records = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        month: d.month,
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        workDays: d.workDays,
        dailyWage: d.dailyWage,
        totalRegularPay: d.totalRegularPay,
        totalOvertimeBonus: d.totalOvertimeBonus,
        performanceBonus: d.performanceBonus ?? 0,
        performanceBonusNote: d.performanceBonusNote ?? "",
        deductions: d.deductions ?? 0,
        deductionNote: d.deductionNote ?? "",
        workPeriod: d.workPeriod ?? "",
        totalPaid: d.totalPaid,
        paidAt: d.paidAt?.toDate?.().toISOString() ?? d.paidAt,
        isLocked: d.isLocked ?? false,
      };
    });

    return NextResponse.json(records);
  } catch (err) {
    console.error("GET /api/payroll error:", err);
    return NextResponse.json({ error: "Gagal mengambil data payroll" }, { status: 500 });
  }
}
