"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function StepperInput({ value, onChange, min = 0, max = 999, className }: StepperInputProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="h-12 w-12 rounded-full border border-stone-200 bg-white text-stone-700 flex items-center justify-center active:scale-95 disabled:opacity-40 transition-transform"
      >
        <Minus size={20} />
      </button>
      <div className="font-mono text-3xl font-semibold w-14 text-center tabular-nums text-stone-900">{value}</div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center active:scale-95 shadow-sm shadow-emerald-600/20 disabled:opacity-40 transition-transform"
      >
        <Plus size={20} />
      </button>
    </div>
  );
}
