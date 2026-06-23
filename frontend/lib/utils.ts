import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number): string {
  if (isNaN(amount)) return "Rp 0";
  const sign = amount < 0 ? "-" : "";
  return sign + "Rp " + Math.abs(amount).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export function formatRupiahCompact(n: number): string {
  if (isNaN(n)) return "Rp 0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " jt";
  if (abs >= 1_000) return "Rp " + Math.round(n / 1_000) + " rb";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(dateStr));
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " +
    d.toTimeString().slice(0, 5);
}
