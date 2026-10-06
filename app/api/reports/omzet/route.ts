import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const timeRange = searchParams.get("timeRange") ?? "today";

  try {
    // Offset for WIB (UTC+7)
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const nowWIB = new Date(Date.now() + WIB_OFFSET);
    const curYear = nowWIB.getUTCFullYear();
    const curMonth = nowWIB.getUTCMonth();
    const curDate = nowWIB.getUTCDate();

    // 00:00:00 WIB in UTC
    const todayStart = new Date(Date.UTC(curYear, curMonth, curDate) - WIB_OFFSET);

    let startDate: Date;
    let endDate: Date | null = null;

    if (timeRange === "yesterday") {
      startDate = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      endDate = todayStart;
    } else if (timeRange === "7days") {
      startDate = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "month") {
      startDate = new Date(Date.UTC(curYear, curMonth, 1) - WIB_OFFSET);
    } else {
      // default: "today"
      startDate = todayStart;
    }

    let query: FirebaseFirestore.Query = adminDb
      .collection("orders")
      .where("createdAt", ">=", startDate);

    if (endDate) {
      query = query.where("createdAt", "<", endDate);
    }

    const snap = await query.get();

    let grossSales = 0;
    let totalPlatformFees = 0;
    let orderCount = 0;

    const channels: Record<string, { count: number; omzet: number }> = {
      walkin: { count: 0, omzet: 0 },
      whatsapp: { count: 0, omzet: 0 },
      tiktok: { count: 0, omzet: 0 },
      shopee: { count: 0, omzet: 0 },
    };

    let cash = 0;
    let bank = 0;
    let qris = 0;

    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.status === "void") continue;

      orderCount++;
      const val = d.totalOrderValue ?? d.totalPrice ?? 0;
      const fee = d.platformFee ?? 0;

      grossSales += val;
      totalPlatformFees += fee;

      // Channel breakdown
      const ch = d.orderChannel || "walkin";
      if (!channels[ch]) channels[ch] = { count: 0, omzet: 0 };
      channels[ch].count += 1;
      channels[ch].omzet += val;

      // Payment breakdown
      if (d.paymentStatus === "sudah_bayar") {
        const method = (d.paymentMethod || "cash").toLowerCase();
        if (method.includes("bank") || method.includes("transfer")) {
          bank += val;
        } else if (method.includes("qris")) {
          qris += val;
        } else {
          cash += val;
        }
      }
    }

    const netSales = grossSales - totalPlatformFees;
    const avgBasketSize = orderCount > 0 ? Math.round(grossSales / orderCount) : 0;

    return NextResponse.json({
      timeRange,
      grossSales,
      netSales,
      totalPlatformFees,
      orderCount,
      avgBasketSize,
      channels,
      payments: {
        cash,
        bank,
        qris,
        totalPaid: cash + bank + qris,
      },
    });
  } catch (err) {
    console.error("GET /api/reports/omzet error:", err);
    return NextResponse.json({ error: "Gagal mengambil ringkasan omzet" }, { status: 500 });
  }
}
