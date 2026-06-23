import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const EMAIL_DOMAIN = "anchur.internal";

export async function POST(req: NextRequest) {
  try {
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
