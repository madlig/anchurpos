import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Parameter month wajib (format YYYY-MM)" }, { status: 400 });
  }

  try {
    const [year, mon] = month.split("-").map(Number);
    const startOfMonth = new Date(year, mon - 1, 1);
    const endOfMonth = new Date(year, mon, 0, 23, 59, 59, 999);

    let pemasukan = 0;
    let hppProduk = 0;

    const ordersSnap = await adminDb
      .collection("orders")
      .where("createdAt", ">=", startOfMonth)
      .where("createdAt", "<=", endOfMonth)
      .get();

    for (const doc of ordersSnap.docs) {
      const data = doc.data();
      if (data.status === "void") continue;

      // Add shipping cost as income if borne by the customer
      if (data.shippingBorneBy === "customer" && (data.shippingCost ?? 0) > 0) {
        pemasukan += data.shippingCost;
      }

      const itemsSnap = await doc.ref.collection("items").get();
      for (const itemDoc of itemsSnap.docs) {
        const item = itemDoc.data();
        pemasukan += item.totalPrice ?? 0;
        hppProduk += item.totalHpp ?? 0;
      }
    }

    const labaKotor = pemasukan - hppProduk;

    let biayaOperasional = 0;
    const expensesSnap = await adminDb
      .collection("expenses")
      .where("date", ">=", startOfMonth)
      .where("date", "<=", endOfMonth)
      .get();

    for (const doc of expensesSnap.docs) {
      const d = doc.data();
      if (d.category === "operasional") {
        biayaOperasional += d.totalPrice ?? 0;
      }
    }

    let biayaPromosi = 0;
    const adjustmentsSnap = await adminDb
      .collection("stockAdjustments")
      .where("createdAt", ">=", startOfMonth)
      .where("createdAt", "<=", endOfMonth)
      .get();

    for (const doc of adjustmentsSnap.docs) {
      biayaPromosi += doc.data().totalCost ?? 0;
    }

    let gajiBonus = 0;
    const payrollSnap = await adminDb
      .collection("payroll")
      .where("month", "==", month)
      .get();

    for (const doc of payrollSnap.docs) {
      gajiBonus += doc.data().totalPaid ?? 0;
    }

    const labaBersih = labaKotor - biayaOperasional - biayaPromosi - gajiBonus;

    return NextResponse.json({
      month,
      pemasukan,
      hppProduk,
      labaKotor,
      biayaOperasional,
      biayaPromosi,
      gajiBonus,
      labaBersih,
    });
  } catch (err) {
    console.error("GET /api/reports/pnl error:", err);
    return NextResponse.json({ error: "Gagal mengambil laporan P&L" }, { status: 500 });
  }
}
