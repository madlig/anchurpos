import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const EMAIL_DOMAIN = "anchur.internal";

// Simple in-memory rate limiter (resets on server restart, good enough for basic protection)
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const now = Date.now();
    const rateLimit = rateLimitMap.get(ip);
    
    if (rateLimit && now < rateLimit.expiresAt) {
      if (rateLimit.count >= MAX_ATTEMPTS) {
        return NextResponse.json({ error: "Terlalu banyak percobaan login. Coba lagi dalam 1 menit." }, { status: 429 });
      }
      rateLimitMap.set(ip, { count: rateLimit.count + 1, expiresAt: rateLimit.expiresAt });
    } else {
      rateLimitMap.set(ip, { count: 1, expiresAt: now + WINDOW_MS });
    }

    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi" },
        { status: 400 }
      );
    }

    const email = `${username.toLowerCase().trim()}@${EMAIL_DOMAIN}`;

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }

    const data = await res.json();
    const decoded = await adminAuth.verifyIdToken(data.idToken);
    const role = decoded.role ?? null;

    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const userData = userDoc.data();

    return NextResponse.json({
      uid: decoded.uid,
      email: decoded.email,
      role,
      name: userData?.name ?? "",
      token: data.idToken,
      refreshToken: data.refreshToken,
    });
  } catch {
    return NextResponse.json(
      { error: "Login gagal" },
      { status: 500 }
    );
  }
}
