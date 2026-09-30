import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import { getJakartaDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const today = getJakartaDate();
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

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month") || today.substring(0, 7);

    // Ambil history hanya berdasarkan employeeId (satu field) lalu filter date di JS
    // — menghindari kebutuhan composite index di Firestore
    const historySnap = await adminDb
      .collection("attendance")
      .where("employeeId", "==", user.uid)
      .get();

    const history = historySnap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id as string,
          date: d.date as string,
          checkIn: d.checkIn,
          checkOut: d.checkOut,
          totalHours: d.totalHours,
          status: d.status,
        };
      })
      .filter((h) => h.date.startsWith(monthParam))
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ today: todayStatus, history });
  } catch (err: any) {
    console.error("GET /api/attendance/my-status error:", err);
    if (err?.code === 8 || err?.message?.includes("Quota exceeded") || err?.details?.includes("Quota exceeded")) {
      return NextResponse.json(
        { error: "Sistem absensi sedang sibuk. Silakan muat ulang atau hubungi Manager jika kendala berlanjut." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Gagal mengambil status absen" }, { status: 500 });
  }
}
