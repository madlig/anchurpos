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
    }

    const snap = await query.get();

    // Query shift reports for this month to provide production summary & overtime claims
    let shiftReportsSnap: FirebaseFirestore.QuerySnapshot;
    try {
      shiftReportsSnap = await adminDb
        .collection("shiftReports")
        .where("date", ">=", `${month}-01`)
        .where("date", "<=", `${month}-31`)
        .get();
    } catch {
      shiftReportsSnap = { docs: [] } as any;
    }

    const shiftReportsByEmployee: Record<string, {
      totalBatches: number;
      totalPcs: number;
      totalThinwalls: number;
      overtimeClaimsCount: number;
      speedScores: number[];
      reportsCount: number;
    }> = {};

    shiftReportsSnap.docs.forEach((doc) => {
      const rep = doc.data();
      const crewIds: string[] = rep.crewIds || [];
      const targets = rep.activities?.cookingAndMolding?.targets || [];
      const batches = targets.reduce((sum: number, t: any) => sum + (Number(t.batches) || 0), 0);
      const pcs = targets.reduce((sum: number, t: any) => sum + (Number(t.pcs) || 0), 0);
      
      const prepackItems = rep.activities?.thinwallPrepack?.items || [];
      const thinwalls = prepackItems.reduce((sum: number, p: any) => sum + (Number(p.regularPacks) || 0) + (Number(p.fullPacks) || 0), 0);
      const hasOvertime = !!rep.overtimeClaim?.isOvertimeEligible;
      const speed = Number(rep.speedScore) || 100;

      crewIds.forEach((cId) => {
        if (!shiftReportsByEmployee[cId]) {
          shiftReportsByEmployee[cId] = {
            totalBatches: 0,
            totalPcs: 0,
            totalThinwalls: 0,
            overtimeClaimsCount: 0,
            speedScores: [],
            reportsCount: 0,
          };
        }
        shiftReportsByEmployee[cId].totalBatches += batches;
        shiftReportsByEmployee[cId].totalPcs += pcs;
        shiftReportsByEmployee[cId].totalThinwalls += thinwalls;
        if (hasOvertime) shiftReportsByEmployee[cId].overtimeClaimsCount += 1;
        shiftReportsByEmployee[cId].speedScores.push(speed);
        shiftReportsByEmployee[cId].reportsCount += 1;
      });
    });

    const records = snap.docs.map((doc) => {
      const d = doc.data();
      const empProd = shiftReportsByEmployee[d.employeeId];
      const avgSpeed = empProd && empProd.speedScores.length > 0
        ? Math.round(empProd.speedScores.reduce((a, b) => a + b, 0) / empProd.speedScores.length)
        : 100;

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
        status: d.status ?? (d.isLocked ? "sudah_dibayar" : "belum_dibayar"),
        paidAt: d.paidAt?.toDate?.().toISOString() ?? (typeof d.paidAt === "string" ? d.paidAt : null) ?? d.lockedAt ?? null,
        paidBy: d.paidBy ?? null,
        isLocked: d.isLocked ?? false,
        productionSummary: empProd ? {
          totalBatches: empProd.totalBatches,
          totalPcs: empProd.totalPcs,
          totalThinwalls: empProd.totalThinwalls,
          overtimeClaimsCount: empProd.overtimeClaimsCount,
          avgSpeedScore: avgSpeed,
          reportsCount: empProd.reportsCount,
        } : null,
      };
    });

    // In-memory sort by employeeName asc to avoid Firestore composite index requirement
    records.sort((a, b) => (a.employeeName || "").localeCompare(b.employeeName || ""));

    return NextResponse.json(records);
  } catch (err) {
    console.error("GET /api/payroll error:", err);
    return NextResponse.json({ error: "Gagal mengambil data payroll" }, { status: 500 });
  }
}
