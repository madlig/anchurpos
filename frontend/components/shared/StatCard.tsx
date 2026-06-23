import { Card } from "@/components/ui/card";
import { cn, formatRupiah } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: "emerald" | "red" | "amber" | "blue";
  sub?: string;
}

const colorMap = {
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", value: "text-emerald-700" },
  red:     { bg: "bg-red-50",     icon: "text-red-500",     value: "text-red-700"     },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-500",   value: "text-amber-700"   },
  blue:    { bg: "bg-blue-50",    icon: "text-blue-500",    value: "text-blue-700"    },
};

export function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  const c = colorMap[color];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-stone-500">{label}</p>
          <p className={cn("mt-1 font-mono text-xl font-bold", c.value)}>{formatRupiah(value)}</p>
          {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
        </div>
        <div className={cn("rounded-lg p-2", c.bg)}>
          <Icon className={cn("h-5 w-5", c.icon)} />
        </div>
      </div>
    </Card>
  );
}
