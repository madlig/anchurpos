"use client";

import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { messaging, db } from "@/lib/firebase-client";
import { useAuth } from "@/lib/auth-context";
import { doc, setDoc } from "firebase/firestore";
import { toast } from "sonner";

export function FCMProvider() {
  const { user } = useAuth();

  useEffect(() => {
    // Only run on client side and if messaging is supported
    if (typeof window === "undefined" || !user || !messaging) return;

    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const currentToken = await getToken(messaging, { 
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY 
          });
          
          if (currentToken) {
            // Save token to user profile so server can push to it
            await setDoc(doc(db, "users", user.uid), { fcmToken: currentToken }, { merge: true });
            console.log("FCM Token saved successfully.");
          }
        } else {
          console.warn("Notification permission not granted by user.");
        }
      } catch (err) {
        console.error("FCM Permission Error:", err);
      }
    };

    requestPermission();

    // Handle foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("Foreground FCM Message received:", payload);
      if (payload.data?.title) {
        toast.info(payload.data.title, { description: payload.data.body });
      }
      // Dispatch a custom event so the UI can auto-refresh
      window.dispatchEvent(new CustomEvent('fcm_message', { detail: payload }));
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  return null;
}
