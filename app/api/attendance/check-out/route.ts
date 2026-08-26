import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import { BUSINESS } from "@/lib/constants";

async function uploadAttendancePhoto(
  userId: string,
  dateStr: string,
  type: string,
  base64Data: string
): Promise<string> {
  if (!base64Data) return "";
  if (!base64Data.startsWith("data:image")) {
    return base64Data;
  }

  try {
    const bucketName =
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      process.env.FIREBASE_STORAGE_BUCKET ||
      (process.env.FIREBASE_PROJECT_ID ? `${process.env.FIREBASE_PROJECT_ID}.appspot.com` : undefined);

    const bucket = bucketName ? adminStorage.bucket(bucketName) : adminStorage.bucket();
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Clean, "base64");
    const filename = `attendance/${userId}/${dateStr}_${type}_${Date.now()}.jpg`;
    const file = bucket.file(filename);

    await file.save(buffer, {
      metadata: { contentType: "image/jpeg" },
      public: true,
      resumable: false,
    });

    return `https://storage.googleapis.com/${bucket.name}/${filename}`;
  } catch (err) {
    console.warn("adminStorage upload failed, fallback to base64 DataURL:", err);
    return base64Data;
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const p1 = lat1 * Math.PI / 180; 
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  let payload: { photoUrl?: string; photoData?: string; latitude?: number; longitude?: number } = {};
  try { payload = await req.json(); } catch(e) {}
  let { photoUrl = null, photoData = null, latitude = null, longitude = null } = payload;

  try {
    const configSnap = await adminDb.doc("settings/attendanceConfig").get();
    const config = configSnap.data() || {};
    
    const storeLat = config.storeLat ?? -6.200000; 
    const storeLng = config.storeLng ?? 106.816666;
    const allowedRadius = config.radiusMeter ?? 50; 

    let distance = null;
    let locationValid = false;

    if (latitude !== null && longitude !== null) {
      distance = calculateDistance(latitude, longitude, storeLat, storeLng);
      locationValid = distance <= allowedRadius;
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
    
    // Best Practice: Lembur tidak otomatis didapat hanya karena telat pulang. Harus manual dari Manager.
    const overtimeHours = 0;
    const overtimeBlocks = 0;
    const overtimeBonus = 0;

    // Build list of anomalies
    const anomalies: string[] = [];
    if (data.checkIn?.latitude === null || data.checkIn?.latitude === undefined) {
      anomalies.push("Check-in tanpa GPS");
    } else if (data.checkIn?.locationValid === false) {
      anomalies.push(`Check-in di luar radius (${Math.round(data.checkIn.distance || 0)}m)`);
    }

    if (latitude === null || longitude === null) {
      anomalies.push("Check-out tanpa GPS");
    } else if (locationValid === false) {
      anomalies.push(`Check-out di luar radius (${Math.round(distance || 0)}m)`);
    }

    if (totalHours < 8) {
      anomalies.push("Check-out awal (<8 jam)");
    }

    // Every check-out goes to status: "direview" as requested: "semua absen akan direview oleh oleh manager atau owner"
    const status = "direview";
    const flaggedReason = anomalies.length > 0 ? anomalies.join(" & ") : "Selesai shift, menunggu review";

    if (!photoUrl && photoData) {
      photoUrl = await uploadAttendancePhoto(user.uid, today, "checkout", photoData);
    }

    await adminDb.doc(`attendance/${attendanceId}`).update({
      checkOut: {
        time: now.toISOString(),
        photoUrl,
        latitude,
        longitude,
        distance,
        locationValid,
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
