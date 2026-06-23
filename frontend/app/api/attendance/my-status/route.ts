import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const today = new Date().toISOString().split("T")[0];
    const attendanceId = `${today}_${user.uid}`;
    const todaySnap = await adminDb.doc(`attendance/${attendanceId}`).get();

    let todayStatus = null;
    if (todaySnap.exists) {
      const d = todaySnap.data()!;
      todayStatus = {
        id: todaySnap.id,
        date: d.date,
        checkIn: d.checkIn,
        checkOut: d.checkOut,
        totalHours: d.totalHours,
        status: d.status,
        flaggedReason: d.flaggedReason,
      };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split("T")[0];

    const historySnap = await adminDb
      .collection("attendance")
      .where("employeeId", "==", user.uid)
      .where("date", ">=", startDate)
      .where("date", "<=", today)
      .orderBy("date", "desc")
      .get();

    const history = historySnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        date: d.date,
        checkIn: d.checkIn,
        checkOut: d.checkOut,
        totalHours: d.totalHours,
        status: d.status,
      };
    });

    return NextResponse.json({ today: todayStatus, history });
  } catch (err) {
    console.error("GET /api/attendance/my-status error:", err);
    return NextResponse.json({ error: "Gagal mengambil status absen" }, { status: 500 });
  }
}
