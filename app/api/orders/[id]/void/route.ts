import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Allow both manager and owner to void orders
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let voidReason: string | undefined;
  try {
    const body = await req.json();
    voidReason = body?.voidReason?.trim();
  } catch {
    // body optional parse error
  }

  if (!voidReason) {
    return NextResponse.json({ error: "Alasan pembatalan (voidReason) wajib diisi" }, { status: 400 });
  }

  try {
    const orderRef = adminDb.doc(`orders/${id}`);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    const order = orderSnap.data()!;
    if (order.status === "void") {
      return NextResponse.json({ error: "Order sudah di-void" }, { status: 400 });
    }

    const itemsSnap = await orderRef.collection("items").get();
    const stockReturned: { variantId: string; qty: number; source: string }[] = [];

    await adminDb.runTransaction(async (tx) => {
      for (const itemDoc of itemsSnap.docs) {
        const item = itemDoc.data();

        if (item.productId === "churros-rainbow") {
          if (item.assemblyStatus === "completed" && item.rainbowSourceBreakdown) {
            const breakdown = item.rainbowSourceBreakdown as {
              variantId: string;
              source: string;
              qty: number;
              productionId?: string;
            }[];

            for (const src of breakdown) {
              if (src.source === "pack_jadi") {
                stockReturned.push({
                  variantId: src.variantId,
                  qty: src.qty,
                  source: "pack_jadi",
                });
              } else if (src.source === "pool_loyang" && src.productionId) {
                const prodRef = adminDb.doc(`productions/${src.productionId}`);
                const prodSnap = await tx.get(prodRef);
                if (prodSnap.exists) {
                  const prodData = prodSnap.data()!;
                  const entries = (prodData.entries || []) as {
                    variantId: string;
                    loyangRemaining: number;
                  }[];
                  const entry = entries.find((e) => e.variantId === src.variantId);
                  if (entry) {
                    entry.loyangRemaining += src.qty;
                    tx.update(prodRef, { entries });
                  }
                }
                stockReturned.push({
                  variantId: src.variantId,
                  qty: src.qty,
                  source: "pool_loyang",
                });
              }
            }
          }
        } else {
          stockReturned.push({
            variantId: item.variantId,
            qty: item.qty,
            source: "product_stock",
          });
        }
      }

      // ── Revert glaze/sauce stock from sauceDistribution ─────────────────────
      const sauceDist = order.sauceDistribution as Record<string, number> | undefined;
      if (sauceDist && Object.keys(sauceDist).length > 0) {
        for (const [addOnId, cupCount] of Object.entries(sauceDist)) {
          if (cupCount <= 0) continue;
          const ingredientRef = adminDb.collection("ingredients").doc(addOnId);
          const ingredientSnap = await tx.get(ingredientRef);
          if (ingredientSnap.exists) {
            tx.update(ingredientRef, {
              currentStock: FieldValue.increment(cupCount),
            });
            const movRef = ingredientRef.collection("movements").doc();
            tx.set(movRef, {
              changeAmount: cupCount,
              newStock: null,
              reason: `Revert void pesanan #${order.orderNumber} — ${voidReason}`,
              sourceType: "opname_adjustment",
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }

      // ── Mark the order as void ───────────────────────────────────────────────
      tx.update(orderRef, {
        status: "void",
        voidedBy: auth.uid,
        voidedAt: FieldValue.serverTimestamp(),
        voidReason,
      });
    });

    return NextResponse.json({ success: true, stockReturned });
  } catch (err) {
    console.error("POST /api/orders/[id]/void error:", err);
    return NextResponse.json({ error: "Gagal void order" }, { status: 500 });
  }
}

