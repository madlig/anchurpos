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
    let totalCashIn = 0;
    let totalBankIn = 0;

    const cashJournal: any[] = [];

    // 1. Query POS Orders
    const ordersSnap = await adminDb
      .collection("orders")
      .where("createdAt", ">=", startOfMonth)
      .where("createdAt", "<=", endOfMonth)
      .get();

    for (const doc of ordersSnap.docs) {
      const data = doc.data();
      if (data.status === "void") continue;

      let orderPemasukan = data.totalOrderValue ?? 0;
      let orderHpp = data.totalHpp ?? 0;

      if (typeof data.totalOrderValue !== 'number') {
        orderPemasukan = 0;
        const itemsSnap = await doc.ref.collection("items").get();
        for (const itemDoc of itemsSnap.docs) {
          const item = itemDoc.data();
          orderPemasukan += item.totalPrice ?? 0;
          orderHpp += item.totalHpp ?? 0;
        }
      }

      if (data.shippingBorneBy === "customer" && (data.shippingCost ?? 0) > 0) {
        orderPemasukan += data.shippingCost;
      }
      
      const netOrderPemasukan = orderPemasukan - (data.platformFee ?? 0);
      pemasukan += netOrderPemasukan;
      hppProduk += orderHpp;

      if (data.paymentStatus === "sudah_bayar") {
        const ch = data.orderChannel || data.channel || "";
        const defaultMethod = (ch === "whatsapp" || ch === "wa_form") ? "transfer" : "cash";
        const method = (data.paymentMethod || defaultMethod).toLowerCase();
        const account = (method === "cash" || method === "tunai") ? "cash" : "bank";

        if (account === "cash") {
          totalCashIn += netOrderPemasukan;
        } else {
          totalBankIn += netOrderPemasukan;
        }

        cashJournal.push({
          id: "pos_" + doc.id,
          date: data.createdAt?.toDate?.().toISOString() ?? startOfMonth.toISOString(),
          type: "pos_sales",
          description: `Penjualan POS #${data.orderNumber || doc.id.slice(0, 6)} (${data.customerName || "Walk-in"})`,
          account,
          amount: netOrderPemasukan,
          notes: data.orderChannel ? `Channel: ${data.orderChannel}` : undefined,
        });
      }
    }

    // 2. Query Purchases (Belanja Bahan & Packaging)
    let totalBelanjaBahan = 0;
    const purchasesSnap = await adminDb
      .collection("purchases")
      .where("date", ">=", startOfMonth)
      .where("date", "<=", endOfMonth)
      .get();

    let totalCashOut = 0;
    let totalBankOut = 0;

    for (const doc of purchasesSnap.docs) {
      const d = doc.data();
      const cost = d.totalPrice ?? 0;
      totalBelanjaBahan += cost;

      const method = (d.paymentMethod ?? "cash").toLowerCase();
      const account = (method === "cash" || method === "tunai") ? "cash" : "bank";

      if (account === "cash") {
        totalCashOut += cost;
      } else {
        totalBankOut += cost;
      }

      cashJournal.push({
        id: "pur_" + doc.id,
        date: d.date?.toDate?.().toISOString() ?? startOfMonth.toISOString(),
        type: "purchases",
        description: `Belanja ${d.itemName || "Bahan"} (${d.qtyPurchased || 1} ${d.purchaseUnit || ""})`,
        account,
        amount: -cost,
        notes: d.supplier ? `Supplier: ${d.supplier}` : d.notes,
      });
    }

    // 3. Query Expenses & Non-Sales Income (Buku Kas)
    let biayaOperasional = 0;
    let totalNonSalesIncome = 0;

    const expensesSnap = await adminDb
      .collection("expenses")
      .where("date", ">=", startOfMonth)
      .where("date", "<=", endOfMonth)
      .get();

    for (const doc of expensesSnap.docs) {
      const d = doc.data();
      const isIncome = d.type === "income";
      const val = d.totalPrice ?? 0;
      const method = (d.paymentMethod ?? "cash").toLowerCase();
      const account = (method === "cash" || method === "tunai") ? "cash" : "bank";

      if (isIncome) {
        totalNonSalesIncome += val;
        if (account === "cash") totalCashIn += val;
        else totalBankIn += val;

        cashJournal.push({
          id: "exp_" + doc.id,
          date: d.date?.toDate?.().toISOString() ?? startOfMonth.toISOString(),
          type: "non_sales_income",
          description: `Pemasukan: ${d.itemName} (${d.category || "General"})`,
          account,
          amount: val,
          notes: d.notes,
        });
      } else {
        biayaOperasional += val;
        if (account === "cash") totalCashOut += val;
        else totalBankOut += val;

        cashJournal.push({
          id: "exp_" + doc.id,
          date: d.date?.toDate?.().toISOString() ?? startOfMonth.toISOString(),
          type: "expense",
          description: `Pengeluaran: ${d.itemName}`,
          account,
          amount: -val,
          notes: d.notes,
        });
      }
    }

    // 4. Query Stock Adjustments (Non-Cash Writeoff for P&L)
    let biayaPromosi = 0;
    const adjustmentsSnap = await adminDb
      .collection("stockAdjustments")
      .where("createdAt", ">=", startOfMonth)
      .where("createdAt", "<=", endOfMonth)
      .get();

    for (const doc of adjustmentsSnap.docs) {
      biayaPromosi += doc.data().totalCost ?? 0;
    }

    // 5. Query Payroll
    let gajiBonus = 0;
    const payrollSnap = await adminDb
      .collection("payroll")
      .where("month", "==", month)
      .get();

    for (const doc of payrollSnap.docs) {
      const p = doc.data();
      const val = p.totalPaid ?? 0;
      gajiBonus += val;
      totalBankOut += val;

      cashJournal.push({
        id: "pay_" + doc.id,
        date: p.createdAt?.toDate?.().toISOString() ?? startOfMonth.toISOString(),
        type: "payroll",
        description: `Gaji & Payroll Karyawan`,
        account: "bank",
        amount: -val,
        notes: `Gaji ${month}`,
      });
    }

    // 6. Query Internal Cash Transfers
    let mutasiCashToBank = 0;
    let mutasiBankToCash = 0;
    
    const transfersSnap = await adminDb
      .collection("cashTransfers")
      .where("date", ">=", startOfMonth)
      .where("date", "<=", endOfMonth)
      .get();

    for (const doc of transfersSnap.docs) {
      const d = doc.data();
      const amt = d.amount ?? 0;
      if (d.from === "cash" && d.to === "bank") {
        mutasiCashToBank += amt;
        cashJournal.push({
          id: "trf_" + doc.id,
          date: d.date?.toDate?.().toISOString() ?? startOfMonth.toISOString(),
          type: "transfer",
          description: `Setoran Tunai (Cash Laci → Bank)`,
          account: "cash",
          amount: -amt,
          notes: d.notes || "Setoran Bank",
        });
      } else if (d.from === "bank" && d.to === "cash") {
        mutasiBankToCash += amt;
        cashJournal.push({
          id: "trf_" + doc.id,
          date: d.date?.toDate?.().toISOString() ?? startOfMonth.toISOString(),
          type: "transfer",
          description: `Penarikan Tunai (Bank → Cash Laci)`,
          account: "bank",
          amount: -amt,
          notes: d.notes || "Tarik Tunai",
        });
      }
    }

    // Sort cash journal by date desc
    cashJournal.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const labaKotor = pemasukan - hppProduk;
    const labaBersih = labaKotor - biayaOperasional - biayaPromosi - gajiBonus;

    const saldoBukuCash = totalCashIn - totalCashOut - mutasiCashToBank + mutasiBankToCash;
    const saldoBukuBank = totalBankIn - totalBankOut + mutasiCashToBank - mutasiBankToCash;

    return NextResponse.json({
      month,
      pemasukan,
      hppProduk,
      labaKotor,
      biayaOperasional,
      biayaPromosi,
      gajiBonus,
      labaBersih,
      totalBelanjaBahan,
      totalNonSalesIncome,
      // Cash Flow formal breakdown
      totalCashIn,
      totalCashOut,
      totalBankIn,
      totalBankOut,
      mutasiCashToBank,
      mutasiBankToCash,
      saldoBukuCash,
      saldoBukuBank,
      // Full Chronological Journal
      cashJournal,
    });
  } catch (err) {
    console.error("GET /api/reports/pnl error:", err);
    return NextResponse.json({ error: "Gagal mengambil laporan P&L" }, { status: 500 });
  }
}
