"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import type { Role } from "@/types";

const ROLE_HOME: Record<Role, string> = {
  owner: "/owner/dashboard",
  manager: "/manager/dashboard",
  crew: "/crew/attendance",
};

export default function RootPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !role) {
      router.replace("/login");
    } else {
      router.replace(ROLE_HOME[role]);
    }
  }, [user, role, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center" style={{ background: "#F0EDE8" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#E85D8C" }} />
    </div>
  );
}
