import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

/**
 * GET /api/owner/overview
 * Single aggregated payload for the Owner Command Center dashboard.
 * Returns: today's P&L, this-month book balances, today's cash feed,
 * low-stock items, alert + pending approval counts, and SFM snapshot.
 *
 * Authorization: owner only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // ── Parallel pulls ────────────────────────────────────────────────
    const [
      todayOrdersSnap,
      yestOrdersSnap,
      monthExpensesSnap,
      monthPurchasesSnap,
      monthTransfersSnap,
      ingredientsSnap,
      alertsSnap,
      opnameSnap,
      attendanceSnap,
      payrollSnap,
      activeWoSnap,
      todayCompletedWoSnap,
    ] = await Promise.all([
      adminDb.collection("orders").where("createdAt", ">=", startOfDay).where("createdAt", "<=", endOfDay).get(),
      adminDb.collection("orders")
        .where("createdAt", ">=", new Date(startOfDay.getTime() - 86400000))
        .where("createdAt", "<=", new Date(startOfDay.getTime() - 1)).get(),
      adminDb.collection("expenses").where("date", ">=", startOfMonth).where("date", "<=", endOfMonth).get(),
      adminDb.collection("purchases").where("date", ">=", startOfMonth).where("date", "<=", endOfMonth).get(),
      adminDb.collection("cashTransfers").where("date", ">=", startOfMonth).where("date", "<=", endOfMonth).get(),
      adminDb.collection("ingredients").get(),
      adminDb.collection("alerts").where("isRead", "==", false).get(),
      adminDb.collection("stockOpname").get(),
      adminDb.collection("attendance").where("flaggedReason", "!=", null).get(),
      adminDb.collection("payroll").where("month", "==", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`).get(),
      adminDb.collection("workOrders").where("status", "in", ["RELEASED", "IN_PROGRESS"]).get(),
      adminDb.collection("workOrders").where("status", "==", "COMPLETED").where("completedAt", ">=", startOfDay).where("completedAt", "<=", endOfDay).get(),
    ]);

    // ── 1. Today's P&L ────────────────────────────────────────────────
    let todayOmzet = 0;
    let todayHpp = 0;
    let todayOrderCount = 0;
    for (const doc of todayOrdersSnap.docs) {
      const d = doc.data();
      if (d.status === "void") continue;
      todayOrderCount++;
      todayOmzet += d.totalOrderValue ?? 0;
      todayHpp += d.totalHpp ?? 0;
    }

    // Yesterday's omzet for trend comparison
    let yesterdayOmzet = 0;
    for (const doc of yestOrdersSnap.docs) {
      const d = doc.data();
      if (d.status === "void") continue;
      yesterdayOmzet += d.totalOrderValue ?? 0;
    }

    // ── 2. Today's cash feed + month book balances ────────────────────
    type FeedItem = {
      id: string;
      time: string;
      type: "sales" | "expense" | "income" | "purchase" | "transfer" | "payroll";
      description: string;
      account: "cash" | "bank";
      amount: number; // signed: positive in, negative out
      notes?: string;
    };
    const todayFeed: FeedItem[] = [];

    // Month book-balance accumulators (only from PAID orders + settled cash items)
    let totalCashIn = 0;
    let totalCashOut = 0;
    let totalBankIn = 0;
    let totalBankOut = 0;
    let mutasiCashToBank = 0;
    let mutasiBankToCash = 0;
    let monthNonSalesIncome = 0;
    let monthOperationalExpense = 0;
    let monthPurchaseCost = 0;

    // Today's paid orders → sales feed entries
    for (const doc of todayOrdersSnap.docs) {
      const d = doc.data();
      if (d.status === "void" || d.paymentStatus !== "sudah_bayar") continue;
      const netVal = (d.totalOrderValue ?? 0) - (d.platformFee ?? 0);
      const ch = d.orderChannel || d.channel || "";
      const defaultMethod = ch === "whatsapp" || ch === "wa_form" ? "transfer" : "cash";
      const method = (d.paymentMethod || defaultMethod).toLowerCase();
      const account: "cash" | "bank" = method === "cash" || method === "tunai" ? "cash" : "bank";
      todayFeed.push({
        id: "sales_" + doc.id,
        time: d.createdAt?.toDate?.().toISOString() ?? now.toISOString(),
        type: "sales",
        description: `Penjualan #${d.orderNumber || doc.id.slice(0, 6)}`,
        account,
        amount: netVal,
        notes: d.customerName ? d.customerName : undefined,
      });
    }

    // Month: paid orders → balances
    const monthOrdersSnap = await adminDb.collection("orders").where("createdAt", ">=", startOfMonth).where("createdAt", "<=", endOfMonth).get();
    let monthOmzet = 0;
    for (const doc of monthOrdersSnap.docs) {
      const d = doc.data();
      if (d.status === "void") continue;
      const netVal = (d.totalOrderValue ?? 0) - (d.platformFee ?? 0);
      monthOmzet += netVal;
      if (d.paymentStatus === "sudah_bayar") {
        const ch = d.orderChannel || d.channel || "";
        const defaultMethod = ch === "whatsapp" || ch === "wa_form" ? "transfer" : "cash";
        const method = (d.paymentMethod || defaultMethod).toLowerCase();
        if (method === "cash" || method === "tunai") totalCashIn += netVal;
        else totalBankIn += netVal;
      }
    }

    // Month expenses (operational + non-sales income) → balances
    for (const doc of monthExpensesSnap.docs) {
      const d = doc.data();
      const val = d.totalPrice ?? 0;
      const method = (d.paymentMethod ?? "cash").toLowerCase();
      const account: "cash" | "bank" = method === "cash" || method === "tunai" ? "cash" : "bank";
      const isToday = d.date?.toDate ? isSameDay(d.date.toDate(), now) : false;

      if (d.type === "income") {
        monthNonSalesIncome += val;
        if (account === "cash") totalCashIn += val;
        else totalBankIn += val;
        if (isToday) {
          todayFeed.push({
            id: "income_" + doc.id,
            time: d.date?.toDate?.().toISOString() ?? now.toISOString(),
            type: "income",
            description: `Pemasukan: ${d.itemName || d.category || "Non-POS"}`,
            account,
            amount: val,
            notes: d.notes,
          });
        }
      } else {
        monthOperationalExpense += val;
        if (account === "cash") totalCashOut += val;
        else totalBankOut += val;
        if (isToday) {
          todayFeed.push({
            id: "expense_" + doc.id,
            time: d.date?.toDate?.().toISOString() ?? now.toISOString(),
            type: "expense",
            description: `Pengeluaran: ${d.itemName || d.category || "Operasional"}`,
            account,
            amount: -val,
            notes: d.notes,
          });
        }
      }
    }

    // Month purchases → balances + today feed
    for (const doc of monthPurchasesSnap.docs) {
      const d = doc.data();
      const val = d.totalPrice ?? 0;
      monthPurchaseCost += val;
      const method = (d.paymentMethod ?? "cash").toLowerCase();
      const account: "cash" | "bank" = method === "cash" || method === "tunai" ? "cash" : "bank";
      if (account === "cash") totalCashOut += val;
      else totalBankOut += val;
      if (d.date?.toDate && isSameDay(d.date.toDate(), now)) {
        todayFeed.push({
          id: "purchase_" + doc.id,
          time: d.date.toDate().toISOString(),
          type: "purchase",
          description: `Belanja: ${d.itemName || "Bahan Baku"}`,
          account,
          amount: -val,
          notes: d.supplier ? `Supplier: ${d.supplier}` : undefined,
        });
      }
    }

    // Month transfers → balances + today feed
    for (const doc of monthTransfersSnap.docs) {
      const d = doc.data();
      const amt = d.amount ?? 0;
      const dDate = d.date?.toDate;
      if (d.from === "cash" && d.to === "bank") {
        mutasiCashToBank += amt;
        if (dDate && isSameDay(dDate, now)) {
          todayFeed.push({ id: "trf_" + doc.id, time: dDate.toISOString(), type: "transfer", description: "Setoran Cash → Bank", account: "cash", amount: -amt, notes: d.notes });
        }
      } else if (d.from === "bank" && d.to === "cash") {
        mutasiBankToCash += amt;
        if (dDate && isSameDay(dDate, now)) {
          todayFeed.push({ id: "trf_" + doc.id, time: dDate.toISOString(), type: "transfer", description: "Tarik Bank → Cash", account: "bank", amount: -amt, notes: d.notes });
        }
      }
    }

    // Sort feed: newest first
    todayFeed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const saldoBukuCash = totalCashIn - totalCashOut - mutasiCashToBank + mutasiBankToCash;
    const saldoBukuBank = totalBankIn - totalBankOut + mutasiCashToBank - mutasiBankToCash;

    // ── 3. Low stock items ────────────────────────────────────────────
    const lowStockItems: { id: string; name: string; currentStock: number; minStock: number; baseUnit: string }[] = [];
    for (const doc of ingredientsSnap.docs) {
      const d = doc.data();
      const current = d.currentStock ?? d.stock ?? 0;
      const min = d.minStock ?? 0;
      if (current < min) {
        lowStockItems.push({ id: doc.id, name: d.name, currentStock: current, minStock: min, baseUnit: d.baseUnit ?? "" });
      }
    }

    // ── 4. Pending approvals / alerts ─────────────────────────────────
    const opnamePending = opnameSnap.docs.filter((doc) => {
      const d = doc.data();
      return d.hasDiscrepancy && !d.reviewAction;
    }).length;
    const attendancePending = attendanceSnap.size;
    const payrollPending = payrollSnap.docs.filter((doc) => (doc.data().status ?? "belum_dibayar") === "belum_dibayar").length;

    // ── 5. SFM snapshot (read-only) ───────────────────────────────────
    const activeWorkOrders = activeWoSnap.docs.map((doc) => {
      const d = doc.data();
      const ss = d.summaryState || {};
      const stage = d.currentStage || "DOUGH_COOKING";
      const producingStage = ["DOUGH_COOKING", "MIXING_EGG", "TRAY_MOLDING"].includes(stage);
      // Stuck detection: > 3.5h in a producing stage
      let stuck = false;
      if (producingStage && d.currentStepStartedAt?.toDate) {
        stuck = now.getTime() - d.currentStepStartedAt.toDate().getTime() > 3.5 * 3600 * 1000;
      }
      return {
        id: doc.id,
        woNumber: d.woNumber || `WO-${doc.id.slice(0, 6).toUpperCase()}`,
        woType: d.woType || "PRODUKSI",
        status: d.status || "RELEASED",
        currentStage: stage,
        assignedCrewName: d.assignedCrewName || "Crew Dapur",
        productName: d.productName || "Churros Frozen",
        variantNames: (d.variantIds || []).join(", "),
        targetPacks: d.targetPacks || 0,
        goodPacks: ss.totalGoodPacks || 0,
        defectPacks: ss.totalDefectPacks || 0,
        startedAt: d.startedAt?.toDate?.().toISOString(),
        currentStepStartedAt: d.currentStepStartedAt?.toDate?.().toISOString(),
        batchCode: d.batchCode || "",
        stuck,
      };
    });
    const stuckCount = activeWorkOrders.filter((w) => w.stuck).length;
    const inFreezerCount = activeWorkOrders.filter((w) => w.currentStage === "FREEZER_CHECKPOINT").length;

    // Today's completed production totals
    let todayGoodPacks = 0;
    let todayDefectPacks = 0;
    let todayBatchCount = todayCompletedWoSnap.size;
    for (const doc of todayCompletedWoSnap.docs) {
      const ss = doc.data().summaryState || {};
      todayGoodPacks += ss.totalGoodPacks || 0;
      todayDefectPacks += ss.totalDefectPacks || 0;
    }
    const todayYieldPct = todayGoodPacks + todayDefectPacks > 0
      ? Math.round((todayGoodPacks / (todayGoodPacks + todayDefectPacks)) * 100)
      : 0;

    // ── Assemble response ─────────────────────────────────────────────
    return NextResponse.json({
      date: now.toISOString(),
      pnl: {
        omzet: todayOmzet,
        hpp: todayHpp,
        labaKotor: todayOmzet - todayHpp,
        orderCount: todayOrderCount,
        yesterdayOmzet,
      },
      balances: {
        saldoBukuCash,
        saldoBukuBank,
        saldoTotal: saldoBukuCash + saldoBukuBank,
        monthOmzet,
        monthOperationalExpense,
        monthPurchaseCost,
        monthNonSalesIncome,
        // honestly scoped: flows within the current month only
        scope: "Aliran kas bulan berjalan",
      },
      todayFeed,
      lowStockItems,
      approvals: {
        opnamePending,
        attendancePending,
        payrollPending,
        total: opnamePending + attendancePending + payrollPending,
      },
      unreadAlerts: alertsSnap.size,
      sfm: {
        activeCount: activeWorkOrders.length,
        stuckCount,
        inFreezerCount,
        todayGoodPacks,
        todayDefectPacks,
        todayBatchCount,
        todayYieldPct,
        activeWorkOrders,
      },
    });
  } catch (err) {
    console.error("GET /api/owner/overview error:", err);
    return NextResponse.json({ error: "Gagal mengambil ringkasan dashboard owner" }, { status: 500 });
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
