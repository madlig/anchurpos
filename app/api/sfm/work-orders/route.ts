import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const dateStr = searchParams.get("date");

  try {
    let query = adminDb.collection("workOrders") as FirebaseFirestore.Query;

    if (status) {
      query = query.where("status", "==", status);
    }

    const snap = await query.orderBy("createdAt", "desc").get();

    let workOrders = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        woNumber: d.woNumber || `WO-${doc.id.slice(0, 6).toUpperCase()}`,
        productId: d.productId || "",
        productName: d.productName || "Churros Frozen",
        variantIds: d.variantIds || [],
        targetBatches: d.targetBatches || 1,
        targetLoyang: d.targetLoyang || 10,
        targetPacks: d.targetPacks || 50,
        status: d.status || "PLANNED",
        currentStage: d.currentStage || "DOUGH",
        summaryState: d.summaryState || {
          totalDoughBatchesDone: 0,
          totalTrayPrinted: 0,
          totalTrayInFreezer: 0,
          totalGoodPacks: 0,
          totalDefectPacks: 0,
          totalDefectPcs: 0,
        },
        createdAt: d.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        startedAt: d.startedAt?.toDate?.().toISOString() ?? undefined,
        freezerInAt: d.freezerInAt?.toDate?.().toISOString() ?? undefined,
        completedAt: d.completedAt?.toDate?.().toISOString() ?? undefined,
        assignedCrewId: d.assignedCrewId || "",
        assignedCrewName: d.assignedCrewName || "Crew Dapur",
        notes: d.notes || "",
        batchCode: d.batchCode || "",
        expiredDate: d.expiredDate || "",
      };
    });

    if (dateStr) {
      workOrders = workOrders.filter(wo => wo.createdAt.startsWith(dateStr));
    }

    return NextResponse.json(workOrders);
  } catch (err) {
    console.error("GET /api/sfm/work-orders error:", err);
    return NextResponse.json({ error: "Gagal mengambil data Work Order" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await req.json();
    const { productId, productName, variantIds, targetBatches, targetLoyang, targetPacks, notes } = body;

    const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(10 + Math.random() * 90);
    const woNumber = `WO-${todayStr}-${randomSuffix}`;

    const woRef = adminDb.collection("workOrders").doc();
    const newWo = {
      woNumber,
      productId: productId || "churros-frozen-food",
      productName: productName || "Churros Frozen Food",
      variantIds: Array.isArray(variantIds) ? variantIds : [],
      targetBatches: Number(targetBatches) || 1,
      targetLoyang: Number(targetLoyang) || 10,
      targetPacks: Number(targetPacks) || 50,
      status: "PLANNED",
      currentStage: "DOUGH",
      summaryState: {
        totalDoughBatchesDone: 0,
        totalTrayPrinted: 0,
        totalTrayInFreezer: 0,
        totalGoodPacks: 0,
        totalDefectPacks: 0,
        totalDefectPcs: 0,
      },
      createdAt: FieldValue.serverTimestamp(),
      assignedCrewId: user.uid,
      assignedCrewName: user.email || "Crew Dapur",
      notes: notes || "",
    };

    await woRef.set(newWo);

    return NextResponse.json({ success: true, id: woRef.id, woNumber });
  } catch (err) {
    console.error("POST /api/sfm/work-orders error:", err);
    return NextResponse.json({ error: "Gagal membuat Work Order" }, { status: 500 });
  }
}
