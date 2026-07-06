import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

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
    const existingSnap = await adminDb.doc(`attendance/${attendanceId}`).get();

    if (existingSnap.exists) {
      const existing = existingSnap.data();
      if (!existing?.checkOut?.time) {
        return NextResponse.json(
          { error: "Sudah absen masuk hari ini, belum checkout" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Sudah absen masuk dan pulang hari ini" },
        { status: 400 }
      );
    }

    const userSnap = await adminDb.doc(`users/${user.uid}`).get();
    const userName = userSnap.data()?.name ?? "Crew";

    await adminDb.doc(`attendance/${attendanceId}`).set({
      date: today,
      employeeId: user.uid,
      employeeName: userName,
      checkIn: {
        time: new Date().toISOString(),
        ipAddress: ip,
        ipValid: ipValid,
      },
      checkOut: null,
      totalHours: null,
      regularHours: null,
      overtimeHours: null,
      overtimeBlocks: null,
      overtimeBonus: null,
      status: "belum_lengkap",
      flaggedReason: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, attendanceId });
  } catch (err) {
    console.error("POST /api/attendance/check-in error:", err);
    return NextResponse.json({ error: "Gagal absen masuk" }, { status: 500 });
  }
}
