import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { publicOrderSchema } from "@/lib/validations";



async function getApplicableTier(productId: string, qty: number): Promise<number> {
  const tiersSnap = await adminDb
    .collection(`products/${productId}/priceTiers`)
    .orderBy("minQty", "asc")
    .get();

  let price = 0;
  for (const doc of tiersSnap.docs) {
    const tier = doc.data();
    if (qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty)) {
      price = tier.price;
      break;
    }
  }
  return price;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parseResult = publicOrderSchema.safeParse(body);
  
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data pesanan tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

  const {
    phoneNumber,
    name,
    address,
    items,
    requestedDeliveryDate,
    orderNotes,
  } = parseResult.data;

  try {
    let customerId = "";
    let discountPerUnit = 0;

    const customerSnap = await adminDb
      .collection("customers")
      .where("phoneNumber", "==", phoneNumber)
      .limit(1)
      .get();

    if (!customerSnap.empty) {
      const existing = customerSnap.docs[0];
      customerId = existing.id;
      discountPerUnit = existing.data().discountPerUnit ?? 0;
      if (address && address !== existing.data().address) {
        await existing.ref.update({ address });
      }
    } else {
      const newCustRef = adminDb.collection("customers").doc();
      await newCustRef.set({
        name,
        phoneNumber,
        address: address ?? "",
        channel: "walk_in",
        discountPerUnit: 0,
        notes: "",
        isActive: true,
        createdVia: "wa_form",
      });
      customerId = newCustRef.id;
    }

    let orderNumber = "";
    const orderRef = adminDb.collection("orders").doc();
    let hasRainbow = false;

    const processedItems: Record<string, unknown>[] = [];

    for (const item of items) {
      const productSnap = await adminDb.doc(`products/${item.productId}`).get();
      const product = productSnap.data();
      const variantSnap = await adminDb.doc(`variants/${item.variantId}`).get();
      const variant = variantSnap.data();

      const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";
      if (isRainbow) hasRainbow = true;

      const basePrice = await getApplicableTier(item.productId, item.qty);
      const totalPrice = (basePrice - discountPerUnit) * item.qty;

      processedItems.push({
        productId: item.productId,
        productName: product?.name ?? item.productId,
        variantId: item.variantId,
        variantName: variant?.name ?? item.variantId,
        qty: item.qty,
        basePrice,
        appliedTier: `${item.qty} pcs`,
        discountPerUnit,
        totalPrice,
        hppPerUnit: 0,
        totalHpp: 0,
        margin: totalPrice,
        assemblyStatus: isRainbow ? "pending_approval" : null,
        rainbowSourceBreakdown: null,
      });
    }

    await adminDb.runTransaction(async (tx) => {
      // 1. Generate Order Number inside transaction to avoid race conditions
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const prefix = `ORD-${dateStr}-`;

      const snap = await tx.get(
        adminDb.collection("orders")
          .where("orderNumber", ">=", prefix)
          .where("orderNumber", "<=", prefix + "\uffff")
          .orderBy("orderNumber", "desc")
          .limit(1)
      );

      if (snap.empty) {
        orderNumber = `${prefix}0001`;
      } else {
        const last = snap.docs[0].data().orderNumber as string;
        const seq = parseInt(last.split("-").pop()!) + 1;
        orderNumber = `${prefix}${String(seq).padStart(4, "0")}`;
      }

      tx.set(orderRef, {
        orderNumber,
        source: "wa_form",
        customerId,
        customerName: name,
        customerPhone: phoneNumber,
        channel: "walk_in",
        status: "pending",
        paymentStatus: "belum_bayar",
        paymentMethod: null,
        needsProduction: false,
        createdBy: null,
        createdAt: FieldValue.serverTimestamp(),
        completedAt: null,
        shippingAddress: address ?? null,
        requestedDeliveryDate: requestedDeliveryDate ?? null,
        orderNotes: orderNotes ?? null,
        proofOfTransferUrl: null,
        shippingCost: null,
        shippingCostConfirmed: false,
        invoiceNumber: null,
        invoiceGeneratedAt: null,
        invoiceUrl: null,
      });

      for (const itemData of processedItems) {
        tx.set(orderRef.collection("items").doc(), itemData);
      }

      const alertRef = adminDb.collection("alerts").doc();
      tx.set(alertRef, {
        type: "stock_warning_production",
        severity: "info",
        title: `Order baru dari ${name} via Form WA`,
        message: `${orderNumber} — ${processedItems.length} item`,
        sourceCollection: "orders",
        sourceId: orderRef.id,
        isRead: false,
        readBy: null,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      orderNumber,
      hasRainbow,
    });
  } catch (err) {
    console.error("POST /api/orders/public error:", err);
    return NextResponse.json({ error: "Gagal mengirim pesanan" }, { status: 500 });
  }
}
