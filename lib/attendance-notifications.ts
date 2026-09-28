import { adminDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { pushNotificationToRole } from "./sfm-notifications";

export interface AttendanceNotificationParams {
  type: "checkin" | "checkout";
  employeeId: string;
  employeeName: string;
  timeStr: string;
  locationValid?: boolean;
  distance?: number | null;
  totalHours?: number | null;
  anomalies?: string[];
  attendanceId: string;
}

export async function sendAttendanceNotification(params: AttendanceNotificationParams) {
  try {
    const {
      type,
      employeeId,
      employeeName,
      timeStr,
      locationValid = true,
      distance = null,
      totalHours = null,
      anomalies = [],
      attendanceId,
    } = params;

    const isCheckIn = type === "checkin";
    const hasAnomaly = !locationValid || (anomalies && anomalies.length > 0);

    const title = isCheckIn
      ? `🟢 ${employeeName} Absen Masuk`
      : `🔵 ${employeeName} Selesai Shift`;

    const locText = locationValid
      ? "Di Toko"
      : distance !== null && distance !== undefined
      ? `Luar Radius (${Math.round(distance)}m)`
      : "Tanpa GPS";

    const body = isCheckIn
      ? `${employeeName} masuk jam ${timeStr} · ${locText}`
      : `${employeeName} pulang jam ${timeStr} (${totalHours !== null ? totalHours.toFixed(1) : 0} jam)${
          anomalies.length > 0 ? ` · ${anomalies.join(", ")}` : ""
        }`;

    const severity = hasAnomaly ? "warning" : isCheckIn ? "info" : "success";

    // 1. Simpan alert ke Firestore agar tampil di lonceng notifikasi (NotificationBell)
    await adminDb.collection("alerts").add({
      type: `attendance_${type}`,
      severity,
      title,
      message: body,
      sourceCollection: "attendance",
      sourceId: attendanceId,
      isRead: false,
      readBy: null,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. Kirim FCM Push ke peran Manager dan Owner secara paralel
    await Promise.allSettled([
      pushNotificationToRole({
        role: "manager",
        title,
        body,
        data: {
          type: `attendance_${type}`,
          attendanceId,
          employeeId,
        },
      }),
      pushNotificationToRole({
        role: "owner",
        title,
        body,
        data: {
          type: `attendance_${type}`,
          attendanceId,
          employeeId,
        },
      }),
    ]);
  } catch (error) {
    console.error("Error in sendAttendanceNotification:", error);
    // Silent fail agar proses absensi utama tidak terganggu
  }
}
