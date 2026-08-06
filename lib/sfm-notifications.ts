import { adminDb, adminMessaging } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface PushNotificationParams {
  role: "crew" | "manager" | "owner";
  title: string;
  body: string;
  data?: { [key: string]: string };
  targetUserId?: string; // Optional: if provided, push only to this user
}

export async function pushNotificationToRole({ role, title, body, data = {}, targetUserId }: PushNotificationParams) {
  try {
    let query = adminDb.collection("users").where("role", "==", role);
    
    const usersSnap = await query.get();
    let tokens: string[] = [];

    usersSnap.forEach((doc) => {
      const userData = doc.data();
      // If targetUserId is provided, filter out other users
      if (targetUserId && doc.id !== targetUserId) {
        return;
      }
      if (userData.fcmToken) {
        tokens.push(userData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      console.log(`No FCM tokens found for role: ${role}${targetUserId ? ` (user ${targetUserId})` : ""}`);
      return;
    }

    // Prepare message with `data` payload so the SW handles it via onBackgroundMessage 
    // consistently with existing pattern. We inject title/body into data so the client 
    // can decide how to render (or the SW handles it).
    const payload = {
      tokens,
      data: {
        title,
        body,
        ...data
      }
    };

    const response = await adminMessaging.sendEachForMulticast(payload);
    console.log(`Successfully sent ${response.successCount} messages to ${role}. Failed: ${response.failureCount}`);
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
        }
      });
    }
  } catch (error) {
    console.error("Error in pushNotificationToRole:", error);
    // Don't throw, we don't want to fail the main request if push fails
  }
}

interface CreateSfmAlertParams {
  type: string;
  severity: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  sourceId: string; // To link back to a WO or related document
}

export async function createSfmAlert({ type, severity, title, message, sourceId }: CreateSfmAlertParams) {
  try {
    await adminDb.collection("alerts").add({
      type,
      severity,
      title,
      message,
      sourceId,
      isRead: false,
      readBy: null,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Error in createSfmAlert:", error);
    // Don't throw
  }
}
