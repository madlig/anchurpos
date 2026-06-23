import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-stone-100 text-stone-700",
        success: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
        warning: "bg-amber-50 text-amber-700 border border-amber-200/60",
        destructive: "bg-red-50 text-red-700 border border-red-200/60",
        primary: "bg-emerald-600 text-white",
        outline: "border border-stone-200 text-stone-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
