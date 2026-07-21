import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import { BUSINESS } from "@/lib/constants";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function isIpWhitelisted(clientIp: string, whitelist: string[]): boolean {
  const cleanClient = clientIp.trim();
  if (cleanClient === "unknown") return false;

  return whitelist.some((whitelisted) => {
    const w = whitelisted.trim();
    if (!w) return false;

    // 1. Exact match
    if (w === cleanClient) return true;

    // 2. Wildcard match (e.g. "182.10.131.*" or "182.10.131.--")
    if (w.includes("*") || w.includes("-")) {
      const cleanPattern = w.replace(/--/g, "*").replace(/\*/g, ".*");
      const regexStr = "^" + cleanPattern.replace(/\./g, "\\.") + "$";
      try {
        const regex = new RegExp(regexStr);
        return regex.test(cleanClient);
      } catch {
        return false;
      }
    }

    // 3. Subnet ending with .0 (e.g. "182.10.131.0")
    if (w.endsWith(".0")) {
      const prefix = w.substring(0, w.lastIndexOf(".") + 1); // e.g. "182.10.131."
      return cleanClient.startsWith(prefix);
    }

    // 4. Subnet slash notation (e.g. "182.10.131.0/24")
    if (w.includes("/")) {
      const [baseIp, rangeStr] = w.split("/");
      const range = parseInt(rangeStr, 10);
      if (range === 24) {
        const prefix = baseIp.substring(0, baseIp.lastIndexOf(".") + 1); // e.g. "182.10.131."
        return cleanClient.startsWith(prefix);
      }
    }

    // 5. General check if it ends with dot (e.g. "182.10.131.")
    if (w.endsWith(".")) {
      return cleanClient.startsWith(w);
    }

    return false;
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  const ip = getClientIp(req);

  try {
    const configSnap = await adminDb.doc("settings/attendanceConfig").get();
    const config = configSnap.data();
    const whitelist: string[] = config?.whitelistedIps ?? [];
    const ipValid = isIpWhitelisted(ip, whitelist);

    if (!ipValid) {
      await adminDb.doc("settings/attendanceConfig").set(
        { lastDetectedIp: ip, lastDetectedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const attendanceId = `${today}_${user.uid}`;
    const docSnap = await adminDb.doc(`attendance/${attendanceId}`).get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "Belum absen masuk hari ini" },
        { status: 400 }
      );
    }

    const data = docSnap.data()!;
    if (data.checkOut?.time) {
      return NextResponse.json(
        { error: "Sudah absen pulang hari ini" },
        { status: 400 }
      );
    }

    const checkInTime = new Date(data.checkIn.time).getTime();
    const now = new Date();
    const totalHours = (now.getTime() - checkInTime) / (1000 * 60 * 60);
    const regularHours = Math.min(totalHours, BUSINESS.REGULAR_HOURS_PER_SHIFT);
    const overtimeHours = Math.max(0, totalHours - BUSINESS.REGULAR_HOURS_PER_SHIFT);
    const overtimeBlocks = Math.floor(overtimeHours / 2);
    const overtimeBonus = overtimeBlocks * BUSINESS.OVERTIME_BONUS_PER_BLOCK;

    // Build list of anomalies
    const anomalies: string[] = [];
    if (data.checkIn?.ipValid === false) {
      anomalies.push("IP Check-in tidak dikenal");
    }
    if (!ipValid) {
      anomalies.push("IP Check-out tidak dikenal");
    }
    if (totalHours < 8) {
      anomalies.push("Check-out awal (<8 jam)");
    }

    // Every check-out goes to status: "direview" as requested: "semua absen akan direview oleh oleh manager atau owner"
    const status = "direview";
    const flaggedReason = anomalies.length > 0 ? anomalies.join(" & ") : "Selesai shift, menunggu review";

    await adminDb.doc(`attendance/${attendanceId}`).update({
      checkOut: {
        time: now.toISOString(),
        ipAddress: ip,
        ipValid,
      },
      totalHours: Math.round(totalHours * 100) / 100,
      regularHours: Math.round(regularHours * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      overtimeBlocks,
      overtimeBonus,
      status,
      flaggedReason,
    });

    // Alert created if there are flagged anomalies
    if (anomalies.length > 0) {
      const alertRef = adminDb.collection("alerts").doc();
      await alertRef.set({
        type: "attendance_review",
        severity: "warning",
        title: `Absen ${data.employeeName} perlu review`,
        message: flaggedReason,
        sourceCollection: "attendance",
        sourceId: attendanceId,
        isRead: false,
        readBy: null,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      status,
      totalHours: Math.round(totalHours * 100) / 100,
      overtimeBonus,
    });
  } catch (err) {
    console.error("POST /api/attendance/check-out error:", err);
    return NextResponse.json({ error: "Gagal absen pulang" }, { status: 500 });
  }
}
