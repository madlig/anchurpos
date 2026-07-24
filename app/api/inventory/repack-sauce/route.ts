import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await req.json();
    const {
      glazeId,
      glazeQty,
      cupId,
      cupQty,
      sauceId,
      yieldQty,
      date
    } = body;

    if (!glazeId || !glazeQty || !cupId || !cupQty || !sauceId || !yieldQty) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const dateToUse = date ? new Date(date) : new Date();

    await adminDb.runTransaction(async (tx) => {
      const glazeRef = adminDb.collection("ingredients").doc(glazeId);
      const cupRef = adminDb.collection("ingredients").doc(cupId);
      const sauceRef = adminDb.collection("addOns").doc(sauceId);

      const [glazeSnap, cupSnap, sauceSnap] = await Promise.all([
        tx.get(glazeRef),
        tx.get(cupRef),
        tx.get(sauceRef)
      ]);

      if (!glazeSnap.exists) throw new Error("Glaze tidak ditemukan");
      if (!cupSnap.exists) throw new Error("Cup tidak ditemukan");
      if (!sauceSnap.exists) throw new Error("Saus (Add-on) tidak ditemukan");

      const glazeData = glazeSnap.data()!;
      const cupData = cupSnap.data()!;
      const sauceData = sauceSnap.data()!;

      // 1. Potong Stok Glaze
      const newGlazeStock = (glazeData.currentStock || 0) - Number(glazeQty);
      tx.update(glazeRef, { currentStock: newGlazeStock });

      // 2. Potong Stok Cup
      const newCupStock = (cupData.currentStock || 0) - Number(cupQty);
      tx.update(cupRef, { currentStock: newCupStock });

      // 3. Tambah Stok Saus
      const newSauceStock = (sauceData.currentStock || 0) + Number(yieldQty);
      tx.update(sauceRef, { currentStock: newSauceStock });

      // 4. Catat Mutasi Glaze (Keluar)
      tx.set(adminDb.collection("stockMovements").doc(), {
        date: dateToUse,
        itemId: glazeId,
        itemName: glazeData.name,
        type: "repack_out",
        qty: -Number(glazeQty),
        unit: glazeData.baseUnit,
        reason: `Repacking ke ${sauceData.name}`,
        notes: `Digunakan ${glazeQty} ${glazeData.baseUnit}`,
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp()
      });

      // 5. Catat Mutasi Cup (Keluar)
      tx.set(adminDb.collection("stockMovements").doc(), {
        date: dateToUse,
        itemId: cupId,
        itemName: cupData.name,
        type: "repack_out",
        qty: -Number(cupQty),
        unit: cupData.baseUnit,
        reason: `Repacking ke ${sauceData.name}`,
        notes: `Digunakan ${cupQty} ${cupData.baseUnit}`,
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp()
      });

      // 6. Catat Mutasi Saus (Masuk)
      tx.set(adminDb.collection("stockMovements").doc(), {
        date: dateToUse,
        itemId: sauceId,
        itemName: sauceData.name,
        type: "repack_in",
        qty: Number(yieldQty),
        unit: "pcs",
        reason: `Hasil repacking dari ${glazeData.name} & ${cupData.name}`,
        notes: `Menghasilkan ${yieldQty} pcs`,
        createdBy: user.uid,
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Repack Sauce Error:", err);
    return NextResponse.json({ error: err.message || "Gagal melakukan repacking" }, { status: 500 });
  }
}
