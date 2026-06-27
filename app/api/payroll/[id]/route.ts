import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await req.json()) as {
    workPeriod?: string;
    workDays?: number;
    dailyWage?: number;
    performanceBonus?: number;
    performanceBonusNote?: string;
  };

  const { workPeriod, workDays, dailyWage, performanceBonus, performanceBonusNote } = body;

  try {
    const docRef = adminDb.doc(`payroll/${id}`);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Payroll tidak ditemukan" }, { status: 404 });
    }

    const data = snap.data()!;
    if (data.isLocked) {
      return NextResponse.json({ error: "Payroll sudah terkunci (sudah dibayar)" }, { status: 400 });
    }

    const finalWorkDays = workDays !== undefined ? Number(workDays) : (data.workDays ?? 0);
    const finalDailyWage = dailyWage !== undefined ? Number(dailyWage) : (data.dailyWage ?? 0);
    const finalPerformanceBonus = performanceBonus !== undefined ? Number(performanceBonus) : (data.performanceBonus ?? 0);
    const finalWorkPeriod = workPeriod !== undefined ? workPeriod : (data.workPeriod ?? "");
    const finalPerformanceBonusNote = performanceBonusNote !== undefined ? performanceBonusNote : (data.performanceBonusNote ?? "");

    if (finalWorkDays < 0 || finalDailyWage < 0 || finalPerformanceBonus < 0) {
      return NextResponse.json({ error: "Nilai nominal tidak valid" }, { status: 400 });
    }

    const totalRegularPay = finalWorkDays * finalDailyWage;
    const totalPaid = totalRegularPay + (data.totalOvertimeBonus ?? 0) + finalPerformanceBonus;

    await docRef.update({
      workPeriod: finalWorkPeriod,
      workDays: finalWorkDays,
      dailyWage: finalDailyWage,
      totalRegularPay,
      performanceBonus: finalPerformanceBonus,
      performanceBonusNote: finalPerformanceBonusNote,
      totalPaid,
    });

    return NextResponse.json({ success: true, totalPaid });
  } catch (err) {
    console.error("PATCH /api/payroll/[id] error:", err);
    return NextResponse.json({ error: "Gagal update payroll" }, { status: 500 });
  }
}
