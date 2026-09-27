import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { payrollLockSchema } from "@/lib/validations";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const docRef = adminDb.doc(`payroll/${id}`);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Data payroll tidak ditemukan" }, { status: 404 });
    }

    const d = snap.data() || {};

    // Crew can only view their own payroll
    if (auth.role === "crew" && d.employeeId !== auth.uid) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const record = {
      id: snap.id,
      month: d.month,
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      workDays: d.workDays,
      dailyWage: d.dailyWage,
      totalRegularPay: d.totalRegularPay,
      totalOvertimeBonus: d.totalOvertimeBonus ?? 0,
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
    };

    return NextResponse.json(record);
  } catch (err) {
    console.error("GET /api/payroll/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengambil data payroll" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  
  try {
    const body = await req.json();
    const parseResult = payrollLockSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ 
        error: "Validasi data payroll gagal", 
        details: parseResult.error.format() 
      }, { status: 400 });
    }

    const data = parseResult.data;

    const docRef = adminDb.doc(`payroll/${id}`);
    const snap = await docRef.get();

    if (snap.exists && snap.data()?.isLocked) {
      return NextResponse.json({ error: "Payroll sudah terkunci (sudah dibayar)" }, { status: 400 });
    }

    // Pastikan diset locked true dan status sudah dibayar
    const nowIso = new Date().toISOString();
    const updatePayload = {
      ...data,
      isLocked: true,
      status: "sudah_dibayar",
      paidAt: data.paidAt || nowIso,
      paidBy: auth.uid,
      lockedAt: data.lockedAt || nowIso,
    };

    await docRef.set(updatePayload, { merge: true });

    return NextResponse.json({ success: true, totalPaid: data.totalPaid });
  } catch (err) {
    console.error("PUT /api/payroll/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengunci payroll" }, { status: 500 });
  }
}

