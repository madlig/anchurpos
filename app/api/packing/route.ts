import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import {
  repackGlaze,
  blenderCinnamon,
  repackCinnamonClip,
  clearCinnamonBulk,
  repackRegToFull,
  packOrder,
  manualUsage,
} from "@/lib/services/packing-service";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const variantId = searchParams.get("variantId");

  if (action === "get_repack_data") {
    if (!variantId) {
      return NextResponse.json({ error: "variantId wajib diisi" }, { status: 400 });
    }

    try {
      const regStockRef = adminDb.collection("productStocks").doc(`churros-frozen-regular_${variantId}`);
      const bufferRef = adminDb.collection("prePackingBuffer").doc(`${variantId}_standard`);

      const [regSnap, bufferSnap] = await Promise.all([
        regStockRef.get(),
        bufferRef.get(),
      ]);

      const regularStock = regSnap.exists ? (regSnap.data()?.currentStock ?? 0) : 0;
      const bufferPcs = bufferSnap.exists ? (bufferSnap.data()?.currentBufferPcs ?? 0) : 0;

      return NextResponse.json({ regularStock, bufferPcs });
    } catch (err) {
      console.error("GET /api/packing repack data error:", err);
      return NextResponse.json({ error: "Gagal mengambil data repack" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Action tidak dikenali" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth as AuthUser;

  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "Action wajib diisi" }, { status: 400 });
    }

    if (action === "repack_glaze") {
      const { flavorId, targetType, cupQty } = body;
      if (!flavorId || !targetType || !cupQty || cupQty <= 0) {
        return NextResponse.json({ error: "Parameter repack_glaze tidak valid" }, { status: 400 });
      }
      await repackGlaze(flavorId, targetType, cupQty, user.uid);
      return NextResponse.json({ success: true });
    }

    if (action === "blender_cinnamon") {
      const { batchCount } = body;
      if (!batchCount || batchCount <= 0) {
        return NextResponse.json({ error: "Jumlah batch blender tidak valid" }, { status: 400 });
      }
      await blenderCinnamon(batchCount, user.uid);
      return NextResponse.json({ success: true });
    }

    if (action === "repack_cinnamon_clip") {
      const { producedQty } = body;
      if (!producedQty || producedQty <= 0) {
        return NextResponse.json({ error: "Jumlah kemasan clip tidak valid" }, { status: 400 });
      }
      await repackCinnamonClip(producedQty, user.uid);
      return NextResponse.json({ success: true });
    }

    if (action === "clear_cinnamon_bulk") {
      await clearCinnamonBulk(user.uid);
      return NextResponse.json({ success: true });
    }

    if (action === "repack_reg_to_full") {
      const { variantId, regularPacksToUnpack } = body;
      if (!variantId || !regularPacksToUnpack || regularPacksToUnpack <= 0) {
        return NextResponse.json({ error: "Parameter repack_reg_to_full tidak valid" }, { status: 400 });
      }
      const result = await repackRegToFull(variantId, regularPacksToUnpack, user.uid);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "pack_order") {
      const { orderId, glazeSelections } = body;
      if (!orderId) {
        return NextResponse.json({ error: "OrderId wajib diisi" }, { status: 400 });
      }
      await packOrder(orderId, glazeSelections, user.uid);
      return NextResponse.json({ success: true });
    }

    if (action === "manual_usage") {
      const { updates, note } = body;
      if (!updates || !updates.length) {
        return NextResponse.json({ error: "Updates tidak boleh kosong" }, { status: 400 });
      }
      await manualUsage(updates, note, user.uid);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action tidak dikenali" }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/packing error:", err);
    return NextResponse.json({ error: err.message || "Gagal memproses packing" }, { status: 500 });
  }
}
