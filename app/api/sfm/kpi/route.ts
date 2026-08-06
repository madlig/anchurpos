import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const snap = await adminDb.collection("crewKpiLogs").get();

    const logs = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        workOrderId: d.workOrderId || "",
        crewId: d.crewId || "",
        crewName: d.crewName || "Crew Dapur",
        date: d.date || dateStr,
        durationMinutes: d.durationMinutes || 0,
        effectiveDurationMinutes: d.effectiveDurationMinutes || d.durationMinutes || 0,
        pauseMinutes: d.pauseMinutes || 0,
        pauseCount: d.pauseCount || 0,
        standardDurationMinutes: d.standardDurationMinutes || 120,
        speedScore: d.speedScore || 85,
        totalTargetPacks: d.totalTargetPacks || 50,
        goodPacks: d.goodPacks || 50,
        defectPacks: d.defectPacks || 0,
        yieldRatePercentage: d.yieldRatePercentage || 100,
        accuracyScore: d.accuracyScore || 100,
        neatnessChecklist: d.neatnessChecklist || {
          workstationClean: true,
          trayArrangementNeat: true,
          freezerOrganization: true,
          vacuumSealTight: true,
        },
        neatnessScore: d.neatnessScore || 90,
        finalKpiScore: d.finalKpiScore || 90,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      };
    });

    return NextResponse.json(logs);
  } catch (err) {
    console.error("GET /api/sfm/kpi error:", err);
    return NextResponse.json({ error: "Gagal mengambil data KPI Kru" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await req.json();
    const {
      workOrderId,
      crewId,
      crewName,
      durationMinutes,
      standardDurationMinutes,
      goodPacks,
      defectPacks,
      totalTargetPacks,
      neatnessChecklist,
    } = body;

    const realDuration = Number(durationMinutes) || 120;
    const stdDuration = Number(standardDurationMinutes) || 120;
    
    let totalPauseMin = 0;
    let pauseCount = 0;
    if (workOrderId) {
      const woSnap = await adminDb.collection("workOrders").doc(workOrderId).get();
      if (woSnap.exists) {
        const woData = woSnap.data()!;
        if (woData.totalPauseMs) {
          totalPauseMin = Math.round(woData.totalPauseMs / 60000);
          pauseCount = woData.pauseCount || 0;
        }
      }
    }

    const effectiveDuration = Math.max(1, realDuration - totalPauseMin);
    const speedScore = Math.min(100, Math.round((stdDuration / effectiveDuration) * 100));

    const totalGood = Number(goodPacks) || 0;
    const totalDefect = Number(defectPacks) || 0;
    const totalProduced = totalGood + totalDefect;
    const yieldRatePercentage = totalProduced > 0 ? Number(((totalGood / totalProduced) * 100).toFixed(1)) : 100;
    const accuracyScore = yieldRatePercentage;

    const nCheck = neatnessChecklist || {
      workstationClean: true,
      trayArrangementNeat: true,
      freezerOrganization: true,
      vacuumSealTight: true,
    };
    const checklistCount = Object.values(nCheck).filter(Boolean).length;
    const neatnessScore = Math.round((checklistCount / 4) * 100);

    const finalKpiScore = Number((speedScore * 0.35 + accuracyScore * 0.45 + neatnessScore * 0.20).toFixed(1));

    const todayStr = new Date().toISOString().split("T")[0];
    const kpiRef = adminDb.collection("crewKpiLogs").doc();
    const newKpiData = {
      workOrderId: workOrderId || "",
      crewId: crewId || user.uid,
      crewName: crewName || user.email || "Crew Dapur",
      date: todayStr,
      durationMinutes: realDuration,
      effectiveDurationMinutes: effectiveDuration,
      pauseMinutes: totalPauseMin,
      pauseCount,
      standardDurationMinutes: stdDuration,
      speedScore,
      totalTargetPacks: Number(totalTargetPacks) || 50,
      goodPacks: totalGood,
      defectPacks: totalDefect,
      yieldRatePercentage,
      accuracyScore,
      neatnessChecklist: nCheck,
      neatnessScore,
      finalKpiScore,
      createdAt: FieldValue.serverTimestamp(),
    };

    await kpiRef.set(newKpiData);

    return NextResponse.json({ success: true, id: kpiRef.id, finalKpiScore });
  } catch (err) {
    console.error("POST /api/sfm/kpi error:", err);
    return NextResponse.json({ error: "Gagal menyimpan evaluasi KPI Kru" }, { status: 500 });
  }
}
