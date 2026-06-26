import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole, verifyAuth } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("paymentStatus");

  try {
    let query: FirebaseFirestore.Query = adminDb
      .collection("orders")
      .orderBy("createdAt", "desc")
      .limit(50);

    if (status) query = query.where("status", "==", status);
    if (paymentStatus) query = query.where("paymentStatus", "==", paymentStatus);

    const snap = await query.get();
    const orders = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        orderNumber: d.orderNumber,
        source: d.source,
        customerId: d.customerId,
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        channel: d.channel,
        status: d.status,
        paymentStatus: d.paymentStatus,
        paymentMethod: d.paymentMethod,
        needsProduction: d.needsProduction ?? false,
        shippingCost: d.shippingCost,
        shippingCostConfirmed: d.shippingCostConfirmed ?? false,
        invoiceNumber: d.invoiceNumber,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt,
        completedAt: d.completedAt?.toDate?.().toISOString() ?? d.completedAt,
      };
    });

    return NextResponse.json(orders);
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ error: "Gagal mengambil data order" }, { status: 500 });
  }
}

async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
  const prefix = `ORD-${dateStr}-`;

  const snap = await adminDb
    .collection("orders")
    .where("orderNumber", ">=", prefix)
    .where("orderNumber", "<=", prefix + "")
    .orderBy("orderNumber", "desc")
    .limit(1)
    .get();

  if (snap.empty) return `${prefix}0001`;
  const last = snap.docs[0].data().orderNumber as string;
  const seq = parseInt(last.split("-").pop()!) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

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
  const user = await verifyAuth(req);
  const isPublic = !user;

  if (!isPublic) {
    const roleCheck = await requireRole(req, ["owner", "manager"]);
    if (roleCheck instanceof NextResponse) return roleCheck;
  }

  const body = await req.json();
  const {
    customerId,
    customerName: directCustomerName,
    source,
    items,
    paymentMethod,
    paymentStatus: inputPaymentStatus,
    shippingAddress,
    requestedDeliveryDate,
    orderNotes,
  } = body as {
    customerId?: string;
    customerName?: string;
    source: string;
    items: { productId: string; variantId: string; qty: number }[];
    paymentMethod?: string;
    paymentStatus?: string;
    shippingAddress?: string;
    requestedDeliveryDate?: string;
    orderNotes?: string;
  };

  if (!items?.length) {
    return NextResponse.json({ error: "Pilih minimal 1 item" }, { status: 400 });
  }

  try {
    // Resolve customer — either from Firestore or use direct name (walk-in)
    let resolvedCustomerName = directCustomerName?.trim() || "Walk-in";
    let resolvedCustomerPhone: string | null = null;
    let resolvedChannel = "walk_in";
    let resolvedCustomerId = customerId ?? null;
    let discountPerUnit = 0;

    if (customerId) {
      const customerSnap = await adminDb.doc(`customers/${customerId}`).get();
      const customer = customerSnap.data();
      if (customer) {
        resolvedCustomerName = customer.name ?? resolvedCustomerName;
        resolvedCustomerPhone = customer.phoneNumber ?? null;
        resolvedChannel = customer.channel ?? "walk_in";
        discountPerUnit = customer.discountPerUnit ?? 0;
      }
    }

    const orderNumber = await generateOrderNumber();
    const orderRef = adminDb.collection("orders").doc();
    let needsProduction = false;
    let hasRainbow = false;

    const processedItems: Record<string, unknown>[] = [];

    for (const item of items) {
      const productSnap = await adminDb.doc(`products/${item.productId}`).get();
      const product = productSnap.data();

      const variantSnap = await adminDb.doc(`variants/${item.variantId}`).get();
      const variant = variantSnap.data();

      const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";

      const basePrice = await getApplicableTier(item.productId, item.qty);
      const totalPrice = (basePrice - discountPerUnit) * item.qty;
      const hppPerUnit = 0;
      const totalHpp = 0;
      const margin = totalPrice - totalHpp;

      const itemData: Record<string, unknown> = {
        productId: item.productId,
        productName: product?.name ?? item.productId,
        variantId: item.variantId,
        variantName: variant?.name ?? item.variantId,
        qty: item.qty,
        basePrice,
        appliedTier: `${item.qty} pcs`,
        discountPerUnit,
        totalPrice,
        hppPerUnit,
        totalHpp,
        margin,
        assemblyStatus: isRainbow ? "pending_approval" : null,
        rainbowSourceBreakdown: null,
      };

      if (isRainbow) hasRainbow = true;

      processedItems.push(itemData);
    }

    await adminDb.runTransaction(async (tx) => {
      tx.set(orderRef, {
        orderNumber,
        source: source ?? "walk_in",
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        channel: resolvedChannel,
        status: "belum_selesai",
        paymentStatus: inputPaymentStatus ?? "belum_bayar",
        paymentMethod: paymentMethod ?? null,
        needsProduction,
        createdBy: (user as AuthUser | null)?.uid ?? null,
        createdAt: FieldValue.serverTimestamp(),
        completedAt: null,
        shippingAddress: shippingAddress ?? null,
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
        const itemRef = orderRef.collection("items").doc();
        tx.set(itemRef, itemData);
      }

      // Kurangi stok produk jadi per varian
      for (const item of items) {
        const variantRef = adminDb.doc(`variants/${item.variantId}`);
        tx.update(variantRef, {
          currentStock: FieldValue.increment(-item.qty),
        });
      }

      if (hasRainbow) {
        const alertRef = adminDb.collection("alerts").doc();
        tx.set(alertRef, {
          type: "stock_warning_production",
          severity: "warning",
          title: "Rainbow order butuh assembly",
          message: `Order ${orderNumber} berisi item Rainbow yang perlu di-assembly`,
          sourceCollection: "orders",
          sourceId: orderRef.id,
          isRead: false,
          readBy: null,
          readAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      orderNumber,
      needsProduction,
      hasRainbow,
    });
  } catch (err) {
    console.error("POST /api/orders error:", err);
    return NextResponse.json({ error: "Gagal membuat order" }, { status: 500 });
  }
}
