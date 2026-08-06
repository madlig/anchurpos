import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { createSfmAlert } from "@/lib/sfm-notifications";
import { getTotalFrozenTrays } from "@/lib/frozen-stock-reader";

/**
 * GET /api/owner/sfm-summary
 * Read-only Shop Floor Management overview for the Owner dashboard tab.
 * Returns active work orders, today's completed batches, freezer status,
 * stuck-WO flags (>3.5h in a producing stage), and a 7-day audit digest.
 * Authorization: owner, manager.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);
    const sevenDaysAgo = new Date(startOfDay.getTime() - 6 * 86400000);

    const [activeSnap, todaySnap, weekSnap, logsSnap] = await Promise.all([
      adminDb.collection("workOrders").where("status", "in", ["RELEASED", "IN_PROGRESS"]).get(),
      adminDb.collection("workOrders").where("status", "==", "COMPLETED").where("completedAt", ">=", startOfDay).where("completedAt", "<=", endOfDay).get(),
      adminDb.collection("workOrders").orderBy("createdAt", "desc").limit(40).get(),
      adminDb.collection("workOrderLogs").orderBy("createdAt", "desc").limit(50).get(),
    ]);

    const STUCK_THRESHOLD_MS = 3.5 * 3600 * 1000;
    const PRODUCING_STAGES = new Set(["DOUGH_COOKING", "MIXING_EGG", "TRAY_MOLDING"]);
    const ALL_STEPS = ["DOUGH_COOKING", "MIXING_EGG", "TRAY_MOLDING", "FREEZER_CHECKPOINT", "PRE_PACK", "FINAL_PACK"];

    const activeWorkOrders = activeSnap.docs.map((doc) => {
      const d = doc.data();
      const ss = d.summaryState || {};
      const stage = d.currentStage || "DOUGH_COOKING";
      const stepStarted = d.currentStepStartedAt?.toDate ? d.currentStepStartedAt.toDate() : null;
      
      const isPaused = !!d.pausedAt;
      const pauseDurationMs = isPaused ? (now.getTime() - d.pausedAt.toDate().getTime()) : 0;
      
      const stuck = !isPaused && PRODUCING_STAGES.has(stage) && stepStarted
        ? now.getTime() - stepStarted.getTime() > STUCK_THRESHOLD_MS
        : false;

      // Phase 4: Orphan Close Check (frozenTrays === 0 but IN_PROGRESS)
      let needsClose = false;
      const variantState = d.variantState;
      if (variantState && Object.keys(variantState).length > 0 && d.status === "IN_PROGRESS") {
        let totalFrozen = 0;
        for (const vid in variantState) {
          totalFrozen += (variantState[vid].frozenTrays || 0);
        }
        if (totalFrozen === 0 && stepStarted && (now.getTime() - stepStarted.getTime() > 86400000)) {
           needsClose = true;
        }
      }

      if (needsClose) {
         Promise.resolve().then(async () => {
          const alertType = "sfm_wo_needs_close";
          const existing = await adminDb.collection("alerts").where("type", "==", alertType).where("sourceId", "==", doc.id).get();
          if (existing.empty) {
            await createSfmAlert({
              type: alertType, severity: "warning", title: "WO Perlu Ditutup",
              message: `WO ${d.woNumber || doc.id.slice(0,6).toUpperCase()} kosong di freezer tapi masih IN_PROGRESS`,
              sourceId: doc.id
            });
          }
         }).catch(err => console.error(err));
      }

      if (isPaused && pauseDurationMs > 30 * 60000) {
        Promise.resolve().then(async () => {
          const alertType = "sfm_wo_paused";
          const existing = await adminDb.collection("alerts").where("type", "==", alertType).where("sourceId", "==", doc.id).get();
          if (existing.empty) {
            await createSfmAlert({
              type: alertType, severity: "warning", title: "Jeda > 30 Menit",
              message: `WO ${d.woNumber || doc.id.slice(0,6).toUpperCase()} dijeda selama lebih dari 30 menit. Alasan: ${d.pausedReason || ""}`,
              sourceId: doc.id
            });
          }
         }).catch(err => console.error(err));
      }

      // Phase 3: Trigger alert for stuck WO (deduplicated by sourceId + type in a fire-and-forget manner)
      if (stuck) {
        // Run async check without blocking the response
        Promise.resolve().then(async () => {
          const alertType = "sfm_wo_stuck";
          const existing = await adminDb.collection("alerts")
            .where("type", "==", alertType)
            .where("sourceId", "==", doc.id)
            .get();
          
          if (existing.empty) {
            await createSfmAlert({
              type: alertType,
              severity: "warning",
              title: "Work Order Stuck",
              message: `WO ${d.woNumber || doc.id.slice(0, 6).toUpperCase()} tertahan di tahap ${stage} selama >3.5 jam`,
              sourceId: doc.id,
            });
          }
        }).catch(err => console.error("Stuck WO alert error:", err));
      }

      const currentStepIndex = ALL_STEPS.indexOf(stage);

      return {
        id: doc.id,
        woNumber: d.woNumber || `WO-${doc.id.slice(0, 6).toUpperCase()}`,
        woType: d.woType || "PRODUKSI",
        status: d.status || "RELEASED",
        currentStage: stage,
        currentStepIndex: currentStepIndex < 0 ? 0 : currentStepIndex,
        progressPct: Math.round(((currentStepIndex < 0 ? 0 : currentStepIndex) / (ALL_STEPS.length - 1)) * 100),
        assignedCrewName: d.assignedCrewName || "Crew Dapur",
        productName: d.productName || "Churros Frozen",
        variantNames: (d.variantIds || []).join(", "),
        targetPacks: d.targetPacks || 0,
        targetPcs: d.targetPcs || 0,
        goodPacks: ss.totalGoodPacks || 0,
        goodPcs: ss.totalGoodPcs || 0,
        defectPacks: ss.totalDefectPacks || 0,
        defectPcs: ss.totalDefectPcs || 0,
        startedAt: d.startedAt?.toDate?.().toISOString(),
        currentStepStartedAt: stepStarted?.toISOString(),
        freezerInAt: d.freezerInAt?.toDate?.().toISOString(),
        completedAt: d.completedAt?.toDate?.().toISOString(),
        batchCode: d.batchCode || "",
        notes: d.notes || "",
        stuck,
        needsClose,
        paused: isPaused,
        pausedReason: d.pausedReason || "",
        totalPauseMs: d.totalPauseMs || 0,
        pauseCount: d.pauseCount || 0,
        variantState: d.variantState || null,
      };
    });

    // Executive metrics
    const stuckCount = activeWorkOrders.filter((w) => w.stuck).length;
    const needsCloseCount = activeWorkOrders.filter((w) => w.needsClose).length;
    const pausedCount = activeWorkOrders.filter((w) => w.paused).length;
    const inFreezerCount = activeWorkOrders.filter((w) => w.currentStage === "FREEZER_CHECKPOINT").length;

    let todayGoodPacks = 0;
    let todayDefectPacks = 0;
    let todayGoodPcs = 0;
    for (const doc of todaySnap.docs) {
      const d = doc.data();
      const vs = d.variantState;
      
      if (vs && Object.keys(vs).length > 0) {
        Object.values(vs).forEach((v: any) => {
          todayGoodPacks += v.goodPacks || 0;
          todayDefectPacks += v.defectPacks || 0;
          todayGoodPcs += v.goodPcs || 0;
        });
      } else {
        const ss = d.summaryState || {};
        todayGoodPacks += ss.totalGoodPacks || 0;
        todayDefectPacks += ss.totalDefectPacks || 0;
        todayGoodPcs += ss.totalGoodPcs || 0;
      }
    }
    const totalPacks = todayGoodPacks + todayDefectPacks;
    const todayYieldPct = totalPacks > 0 ? Math.round((todayGoodPacks / totalPacks) * 100) : 0;

    // Audit digest — last 7 days, recent work orders (any status)
    const audit = weekSnap.docs
      .filter((doc) => {
        const created = doc.data().createdAt?.toDate;
        return created && created >= sevenDaysAgo;
      })
      .map((doc) => {
        const d = doc.data();
        const ss = d.summaryState || {};
        return {
          id: doc.id,
          woNumber: d.woNumber || `WO-${doc.id.slice(0, 6).toUpperCase()}`,
          woType: d.woType || "PRODUKSI",
          status: d.status || "PLANNED",
          assignedCrewName: d.assignedCrewName || "Crew Dapur",
          goodPacks: ss.totalGoodPacks || 0,
          defectPacks: ss.totalDefectPacks || 0,
          createdAt: d.createdAt?.toDate?.().toISOString(),
          completedAt: d.completedAt?.toDate?.().toISOString(),
          batchCode: d.batchCode || "",
          expiredDate: d.expiredDate || "",
        };
      });

    // Recent crew activity (compressed for owner)
    const recentActivity = logsSnap.docs.slice(0, 12).map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        action: d.action || "",
        crewName: d.loggedByCrewName || d.crewName || "Crew",
        woNumber: d.woNumber || "",
        valueAdded: d.valueAdded ?? null,
        unit: d.unit ?? null,
        createdAt: d.createdAt?.toDate?.().toISOString(),
      };
    });

    const totalFrozenTrays = await getTotalFrozenTrays();

    return NextResponse.json({
      metrics: {
        activeCount: activeWorkOrders.length,
        stuckCount,
        needsCloseCount,
        pausedCount,
        inFreezerCount,
        totalFrozenTrays,
        todayCompletedCount: todaySnap.size,
        todayGoodPacks,
        todayGoodPcs,
        todayDefectPacks,
        todayYieldPct,
      },
      activeWorkOrders,
      audit,
      recentActivity,
    });
  } catch (err) {
    console.error("GET /api/owner/sfm-summary error:", err);
    return NextResponse.json({ error: "Gagal mengambil ringkasan SFM" }, { status: 500 });
  }
}
