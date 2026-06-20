"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
  className?: string;
}

export function Header({ title, subtitle, back, action, className }: HeaderProps) {
  const router = useRouter();
  return (
    <div className={cn("px-5 pt-4 pb-3 flex items-center gap-3 lg:hidden", className)}>
      {back && (
        <button
          onClick={() => router.back()}
          className="h-10 w-10 -ml-2 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-700 shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-stone-900 leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-stone-500 truncate">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
