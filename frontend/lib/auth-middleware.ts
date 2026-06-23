import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./firebase-admin";
import type { Role } from "@/types";

export interface AuthUser {
  uid: string;
  email: string;
  role: Role;
}

export async function verifyAuth(req: NextRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const role = decoded.role as Role | undefined;
    if (!role) return null;
    return { uid: decoded.uid, email: decoded.email ?? "", role };
  } catch {
    return null;
  }
}

export async function requireRole(
  req: NextRequest,
  allowedRoles: Role[]
): Promise<AuthUser | NextResponse> {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}
