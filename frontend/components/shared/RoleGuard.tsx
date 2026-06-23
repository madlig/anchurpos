"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/types";
import { Loader2 } from "lucide-react";

interface RoleGuardProps {
  allowedRoles: Role[];
  children: React.ReactNode;
}

const ROLE_HOME: Record<Role, string> = {
  owner: "/owner/dashboard",
  manager: "/manager/dashboard",
  crew: "/crew/attendance",
};

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role && !allowedRoles.includes(role)) {
      router.replace(ROLE_HOME[role]);
    }
  }, [user, role, loading, allowedRoles, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user || !role || !allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
