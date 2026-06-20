import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatRupiahCompact, formatShortDate } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { Transaction } from "@/types";

interface TransactionItemProps {
  tx: Transaction;
  productName?: string;
}

export function TransactionItem({ tx, productName = "Churros Pack" }: TransactionItemProps) {
  return (
    <Link
      href={`/reports/${tx.id}`}
      className="flex items-center gap-3 bg-white rounded-2xl border border-stone-200/80 px-4 py-3 hover:bg-stone-50 active:bg-stone-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-stone-900">{productName}</span>
          {tx.voided && <Badge variant="destructive" className="text-[10px]">Void</Badge>}
        </div>
        <p className="text-xs text-stone-500 mt-0.5">{formatShortDate(tx.date)} · {tx.qty} pack</p>
      </div>
      <div className="text-right">
        <p className={`font-mono text-sm font-semibold ${tx.voided ? "text-stone-400 line-through" : "text-stone-900"}`}>
          {formatRupiah(tx.totalPrice)}
        </p>
        {!tx.voided && (
          <p className="text-xs text-emerald-600">+{formatRupiahCompact(tx.profit)}</p>
        )}
      </div>
      <ChevronRight size={14} className="text-stone-400 shrink-0" />
    </Link>
  );
}
