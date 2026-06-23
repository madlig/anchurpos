import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { Role } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

const EMAIL_DOMAIN = "anchur.internal";

interface SetupUser {
  username: string;
  password: string;
  name: string;
  role: Role;
}

export async function POST(req: NextRequest) {
  try {
    const { users, secret } = (await req.json()) as {
      users: SetupUser[];
      secret: string;
    };

    if (secret !== process.env.FIREBASE_PRIVATE_KEY?.slice(0, 20)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: { username: string; uid: string; role: Role }[] = [];

    for (const u of users) {
      const email = `${u.username.toLowerCase().trim()}@${EMAIL_DOMAIN}`;

      let uid: string;
      try {
        const existing = await adminAuth.getUserByEmail(email);
        uid = existing.uid;
      } catch {
        const created = await adminAuth.createUser({
          email,
          password: u.password,
          displayName: u.name,
        });
        uid = created.uid;
      }

      await adminAuth.setCustomUserClaims(uid, { role: u.role });

      await adminDb
        .collection("users")
        .doc(uid)
        .set(
          {
            name: u.name,
            email,
            role: u.role,
            active: true,
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      results.push({ username: u.username, uid, role: u.role });
    }

    return NextResponse.json({ success: true, users: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Setup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
