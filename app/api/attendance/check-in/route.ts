import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

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
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  let payload: { photoUrl?: string; photoData?: string; latitude?: number; longitude?: number } = {};
  try { payload = await req.json(); } catch(e) {}
  let { photoUrl = null, photoData = null, latitude = null, longitude = null } = payload;

  try {
    const configSnap = await adminDb.doc("settings/attendanceConfig").get();
    const config = configSnap.data() || {};
    
    // Titik pusat toko default (Jika belum di set, set di titik 0,0 atau titik spesifik agar tidak error)
    // Sebaiknya defaultkan ke titik spesifik jika diperlukan
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

    if (!photoUrl && photoData) {
      photoUrl = await uploadAttendancePhoto(user.uid, today, "checkin", photoData);
    }

    const userSnap = await adminDb.doc(`users/${user.uid}`).get();
    const userName = userSnap.data()?.name ?? "Crew";

    await adminDb.doc(`attendance/${attendanceId}`).set({
      date: today,
      employeeId: user.uid,
      employeeName: userName,
      checkIn: {
        time: new Date().toISOString(),
        photoUrl,
        latitude,
        longitude,
        distance,
        locationValid,
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
