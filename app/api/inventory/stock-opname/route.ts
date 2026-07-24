import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

interface OpnameItem {
  itemId: string;
  itemType: "ingredient" | "variant";
  actualStock: number;
  systemStock: number;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const { items } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Data stock opname tidak valid" }, { status: 400 });
    }

    const batch = adminDb.batch();
    const now = new Date().toISOString();

    for (const item of items as OpnameItem[]) {
      // Backward compatibility for old UI payload (ingredientId)
      const itemId = item.itemId || (item as any).ingredientId;
      const itemType = item.itemType || "ingredient";
      const { actualStock, systemStock, notes } = item;
      
      const diff = actualStock - systemStock;
      
      // Jika tidak ada selisih, lewati
      if (diff === 0) continue;

      const collectionName = itemType === "variant" ? "variants" : "ingredients";
      const itemRef = adminDb.collection(collectionName).doc(itemId);
      
      // 1. Update stok saat ini
      batch.update(itemRef, {
        currentStock: actualStock,
        updatedAt: now,
      });

      // 2. Catat pergerakan (Movement)
      const movementRef = adminDb.collection("stockMovements").doc();
      batch.set(movementRef, {
        ingredientId: itemId, // Walau dinamakan ingredientId, kita simpan ID varian jika itu produk jadi
        itemType, // Tambahkan tipe untuk membedakan di riwayat nantinya
        changeAmount: diff,
        source: "stock_opname_adjustment",
        timestamp: now,
        userId: user.uid,
        userName: "Manager",
        notes: notes || `Stock Opname (Sistem: ${systemStock}, Fisik: ${actualStock})`,
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true, message: "Stock Opname berhasil disimpan" });
  } catch (err) {
    console.error("POST /api/inventory/stock-opname error:", err);
    return NextResponse.json({ error: "Gagal memproses stock opname" }, { status: 500 });
  }
}
