import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

/**
 * GET /api/reports/trend?months=6
 * Lightweight multi-month trend series for owner dashboard charts.
 * Returns array (oldest → newest) of monthly P&L summaries.
 * Authorization: owner, manager.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const monthsParam = parseInt(searchParams.get("months") ?? "6", 10);
  const months = Math.min(Math.max(monthsParam || 6, 1), 12);

  try {
    const now = new Date();
    const series: {
      month: string;
      label: string;
      pemasukan: number;
      hppProduk: number;
      labaKotor: number;
      biayaOperasional: number;
      biayaPromosi: number;
      gajiBonus: number;
      labaBersih: number;
    }[] = [];

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    // Build list of {year, month} for the last N months (oldest first)
    const targets: { y: number; m: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      targets.push({ y: d.getFullYear(), m: d.getMonth() });
    }

    for (const { y, m } of targets) {
      const startOfMonth = new Date(y, m, 1);
      const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);
      const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;

      const [ordersSnap, expensesSnap, adjSnap, payrollSnap] = await Promise.all([
        adminDb.collection("orders").where("createdAt", ">=", startOfMonth).where("createdAt", "<=", endOfMonth).get(),
        adminDb.collection("expenses").where("date", ">=", startOfMonth).where("date", "<=", endOfMonth).get(),
        adminDb.collection("stockAdjustments").where("createdAt", ">=", startOfMonth).where("createdAt", "<=", endOfMonth).get(),
        adminDb.collection("payroll").where("month", "==", monthKey).get(),
      ]);

      let pemasukan = 0;
      let hppProduk = 0;
      for (const doc of ordersSnap.docs) {
        const d = doc.data();
        if (d.status === "void") continue;
        const orderVal = d.totalOrderValue ?? 0;
        pemasukan += orderVal - (d.platformFee ?? 0);
        hppProduk += d.totalHpp ?? 0;
      }

      let biayaOperasional = 0;
      for (const doc of expensesSnap.docs) {
        const d = doc.data();
        if (d.type === "income") continue;
        biayaOperasional += d.totalPrice ?? 0;
      }

      let biayaPromosi = 0;
      for (const doc of adjSnap.docs) {
        biayaPromosi += doc.data().totalCost ?? 0;
      }

      let gajiBonus = 0;
      for (const doc of payrollSnap.docs) {
        gajiBonus += doc.data().totalPaid ?? 0;
      }

      const labaKotor = pemasukan - hppProduk;
      const labaBersih = labaKotor - biayaOperasional - biayaPromosi - gajiBonus;

      series.push({
        month: monthKey,
        label: `${monthNames[m]} ${String(y).slice(2)}`,
        pemasukan,
        hppProduk,
        labaKotor,
        biayaOperasional,
        biayaPromosi,
        gajiBonus,
        labaBersih,
      });
    }

    return NextResponse.json({ series });
  } catch (err) {
    console.error("GET /api/reports/trend error:", err);
    return NextResponse.json({ error: "Gagal mengambil tren laporan" }, { status: 500 });
  }
}
