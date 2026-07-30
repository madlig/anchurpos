"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StockOpnameReviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/manager/inventory?tab=opname");
  }, [router]);

  return null;
}
