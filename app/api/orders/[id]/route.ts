import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole, verifyAuth } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["owner", "manager", "crew"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const orderSnap = await adminDb.doc(`orders/${id}`).get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    const d = orderSnap.data()!;
    const itemsSnap = await adminDb.collection(`orders/${id}/items`).get();
    const items = itemsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      id: orderSnap.id,
      orderNumber: d.orderNumber,
      source: d.source,
      orderChannel: d.orderChannel ?? "walkin",
      customerId: d.customerId ?? null,
      customerName: d.customerName,
      customerType: d.customerType ?? null,
      customerPhone: d.customerPhone,
      channel: d.channel,
      status: d.status,
      paymentStatus: d.paymentStatus,
      paymentMethod: d.paymentMethod,
      platformFeePercent: d.platformFeePercent ?? 0,
      platformFee: d.platformFee ?? 0,
      netRevenue: d.netRevenue ?? null,
      needsProduction: d.needsProduction ?? false,
      shippingAddress: d.shippingAddress,
      requestedDeliveryDate: d.requestedDeliveryDate,
      orderNotes: d.orderNotes,
      proofOfTransferUrl: d.proofOfTransferUrl,
      shippingCost: d.shippingCost,
      shippingCostConfirmed: d.shippingCostConfirmed ?? false,
      shippingBorneBy: d.shippingBorneBy ?? null,
      deliveryMethod: d.deliveryMethod ?? null,

      invoiceNumber: d.invoiceNumber,
      invoiceUrl: d.invoiceUrl,
      createdBy: d.createdBy,
      voidReason: d.voidReason ?? null,
      voidedAt: d.voidedAt?.toDate?.().toISOString() ?? null,
      createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt,
      completedAt: d.completedAt?.toDate?.().toISOString() ?? d.completedAt,
      items,
    });


  } catch (err) {
    console.error("GET /api/orders/[id] error:", err);
    return NextResponse.json({ error: "Gagal mengambil detail order" }, { status: 500 });
  }
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roleCheck = await requireRole(req, ["owner", "manager"]);
  if (roleCheck instanceof NextResponse) return roleCheck;

  const { id } = await params;
  const body = await req.json();

  const {
    customerId,
    customerName: directCustomerName,
    customerType: inputCustomerType,
    source,
    orderChannel,
    items,
    paymentMethod,
    paymentStatus,
    shippingAddress,
    requestedDeliveryDate,
    orderNotes,
    platformFeePercent: inputFeePercent,
    platformFee: inputFeeAmount,
    customDate,
    shippingCost,
    shippingBorneBy,
    deliveryMethod,
    sauceDistribution,
  } = body as {
    customerId?: string;
    customerName?: string;
    customerType?: string;
    source: string;
    orderChannel?: string;
    items: { productId: string; variantId: string; qty: number; sauceId?: string; sauceName?: string }[];
    paymentMethod?: string;
    paymentStatus?: string;
    shippingAddress?: string;
    requestedDeliveryDate?: string;
    orderNotes?: string;
    platformFeePercent?: number;
    platformFee?: number;
    customDate?: string;
    shippingCost?: number;
    shippingBorneBy?: "seller" | "customer";
    deliveryMethod?: "pickup" | "self_delivery" | "courier";
    sauceDistribution?: Record<string, number>;
  };

  if (!items?.length) {
    return NextResponse.json({ error: "Pilih minimal 1 item" }, { status: 400 });
  }

  try {
    const orderRef = adminDb.collection("orders").doc(id);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    const oldOrder = orderSnap.data()!;
    if (oldOrder.status === "selesai") {
      return NextResponse.json({ error: "Pesanan yang sudah selesai tidak dapat diedit" }, { status: 400 });
    }

    const orderNumber = oldOrder.orderNumber;

    // Fetch existing subcollection items to delete them later
    const oldItemsSnap = await orderRef.collection("items").get();

    // Fetch old expenses for shipping to delete if necessary
    const oldExpensesSnap = await adminDb
      .collection("expenses")
      .where("itemName", "==", `Ongkir Order #${orderNumber}`)
      .get();

    // Resolve customer details
    let resolvedCustomerName = directCustomerName?.trim() || "Walk-in";
    let resolvedCustomerPhone: string | null = null;
    let resolvedChannel = "walk_in";
    let resolvedCustomerId = customerId ?? null;
    let resolvedCustomerType = inputCustomerType ?? null;
    let discountPerUnit = 0;

    if (customerId) {
      const customerSnap = await adminDb.doc(`customers/${customerId}`).get();
      const customer = customerSnap.data();
      if (customer) {
        resolvedCustomerName = customer.name ?? resolvedCustomerName;
        resolvedCustomerPhone = customer.phoneNumber ?? null;
        resolvedChannel = customer.channel ?? "walk_in";
        resolvedCustomerType = customer.customerType ?? resolvedCustomerType;
        discountPerUnit = customer.discountPerUnit ?? 0;
      }
    }

    // Accumulate quantities per product for price tiers
    const productQtyMap = new Map<string, number>();
    for (const item of items) {
      const current = productQtyMap.get(item.productId) ?? 0;
      productQtyMap.set(item.productId, current + item.qty);
    }

    const processedItems: Record<string, unknown>[] = [];
    let needsProduction = false;
    let hasRainbow = false;

    for (const item of items) {
      const productSnap = await adminDb.doc(`products/${item.productId}`).get();
      const product = productSnap.data();

      const variantSnap = await adminDb.doc(`variants/${item.variantId}`).get();
      const variant = variantSnap.data();

      const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";

      const totalProductQty = productQtyMap.get(item.productId) ?? item.qty;
      const basePrice = await getApplicableTier(item.productId, totalProductQty);
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
        appliedTier: `${totalProductQty} pcs`,
        discountPerUnit,
        totalPrice,
        hppPerUnit,
        totalHpp,
        margin,
        assemblyStatus: isRainbow ? "pending_approval" : null,
        rainbowSourceBreakdown: null,
        sauceId: item.sauceId ?? null,
        sauceName: item.sauceName ?? null,
      };

      if (isRainbow) hasRainbow = true;
      processedItems.push(itemData);
    }

    const dateToUse = customDate ? new Date(customDate) : (oldOrder.createdAt?.toDate?.() || new Date(oldOrder.createdAt));

    await adminDb.runTransaction(async (tx) => {
      // --- ALL READS MUST HAPPEN BEFORE ANY WRITES ---
      
      const oldSauceDist = oldOrder.sauceDistribution;
      const addOnSnaps: Record<string, FirebaseFirestore.DocumentSnapshot> = {};

      // Collect all sauce IDs to fetch
      const sauceIdsToFetch = new Set<string>();
      if (oldSauceDist && typeof oldSauceDist === "object") {
        Object.keys(oldSauceDist).forEach(id => sauceIdsToFetch.add(id));
      }
      if (sauceDistribution && typeof sauceDistribution === "object") {
        Object.keys(sauceDistribution).forEach(id => sauceIdsToFetch.add(id));
      }

      // Fetch all required addOns
      for (const sauceId of sauceIdsToFetch) {
        addOnSnaps[sauceId] = await tx.get(adminDb.collection("addOns").doc(sauceId));
      }

      // Track the running stock for each addon in memory to handle revert+deduct correctly
      const addonStocks: Record<string, number> = {};
      for (const sauceId of sauceIdsToFetch) {
        const snap = addOnSnaps[sauceId];
        addonStocks[sauceId] = snap && snap.exists ? (snap.data()?.currentStock ?? 0) : 0;
      }

      // --- WRITES ---

      // 1. REVERT OLD GLAZE/SAUS STOCK DEDUCTIONS
      if (oldSauceDist && typeof oldSauceDist === "object") {
        for (const [sauceId, cupCount] of Object.entries(oldSauceDist)) {
          if (typeof cupCount === "number" && cupCount > 0 && addOnSnaps[sauceId]?.exists) {
            const addOnRef = adminDb.collection("addOns").doc(sauceId);
            const nextAddonStock = addonStocks[sauceId] + cupCount;
            addonStocks[sauceId] = nextAddonStock; // update in memory for later deductions

            tx.update(addOnRef, { currentStock: nextAddonStock });

            // Log stock reversion
            const movementRef = adminDb.collection("stockMovements").doc();
            tx.set(movementRef, {
              ingredientId: `addon:${sauceId}`,
              changeAmount: cupCount,
              newStockAfter: nextAddonStock,
              sourceType: "opname_adjustment",
              notes: `Revert saos karena update order #${orderNumber}`,
              createdAt: new Date(),
            });
          }
        }
      }

      // 2. DELETE OLD ITEMS SUBCOLLECTION DOCS
      for (const doc of oldItemsSnap.docs) {
        tx.delete(doc.ref);
      }

      // 3. DELETE OLD SHIPPING COST EXPENSES
      for (const doc of oldExpensesSnap.docs) {
        tx.delete(doc.ref);
      }

      // 4. CALCULATE NEW platform fee & net revenue
      const finalOrderChannel = orderChannel ?? "walkin";
      const totalOrderValue = processedItems.reduce((sum, item) => sum + ((item.totalPrice as number) ?? 0), 0);
      const finalFeePercent = inputFeePercent ?? 0;
      const finalFeeAmount = inputFeeAmount ?? (totalOrderValue * finalFeePercent / 100);
      const netRevenue = (totalOrderValue - finalFeeAmount) + (shippingBorneBy === "customer" ? (shippingCost ?? 0) : 0);

      // 5. UPDATE MAIN ORDER DOCUMENT
      tx.update(orderRef, {
        source: source ?? "walk_in",
        orderChannel: finalOrderChannel,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        customerType: resolvedCustomerType,
        customerPhone: resolvedCustomerPhone,
        channel: resolvedChannel,
        paymentStatus: paymentStatus ?? "sudah_bayar",
        paymentMethod: paymentMethod ?? null,
        platformFeePercent: finalFeePercent,
        platformFee: finalFeeAmount,
        netRevenue,
        needsProduction,
        shippingAddress: shippingAddress ?? null,
        requestedDeliveryDate: requestedDeliveryDate ?? null,
        orderNotes: orderNotes ?? null,
        shippingCost: shippingCost ?? null,
        shippingBorneBy: shippingBorneBy ?? null,
        deliveryMethod: deliveryMethod ?? null,
        sauceDistribution: sauceDistribution ?? null,
        createdAt: dateToUse,
      });

      // 6. WRITE NEW ITEMS
      for (const itemData of processedItems) {
        const itemRef = orderRef.collection("items").doc();
        tx.set(itemRef, itemData);
      }

      // 7. DEDUCT NEW GLAZE/SAUS STOCK DEDUCTIONS
      if (sauceDistribution && typeof sauceDistribution === "object") {
        for (const [sauceId, cupCount] of Object.entries(sauceDistribution)) {
          if (typeof cupCount === "number" && cupCount > 0 && addOnSnaps[sauceId]?.exists) {
            const addOnRef = adminDb.collection("addOns").doc(sauceId);
            const nextAddonStock = addonStocks[sauceId] - cupCount;
            addonStocks[sauceId] = nextAddonStock; // update in memory

            tx.update(addOnRef, { currentStock: nextAddonStock });

            // Log new stock movement
            const movementRef = adminDb.collection("stockMovements").doc();
            tx.set(movementRef, {
              ingredientId: `addon:${sauceId}`,
              changeAmount: -cupCount,
              newStockAfter: nextAddonStock,
              sourceType: "sale",
              notes: `Penjualan saos untuk update order #${orderNumber}`,
              createdAt: dateToUse,
            });
          }
        }
      }

      // 8. WRITE NEW SHIPPING EXPENSE IF BORNE BY SELLER
      if (finalOrderChannel === "whatsapp" && (shippingCost ?? 0) > 0 && shippingBorneBy === "seller") {
        const expenseRef = adminDb.collection("expenses").doc();
        tx.set(expenseRef, {
          date: dateToUse,
          category: "operasional",
          ingredientId: null,
          itemName: `Ongkir Order #${orderNumber}`,
          qtyPurchased: 1,
          purchaseUnit: "kali",
          qtyInBaseUnit: 1,
          totalPrice: shippingCost,
          pricePerBaseUnit: shippingCost,
          paymentMethod: "transfer",
          supplier: "Ekspedisi / Kurir",
          notes: `Ditanggung penjual untuk update order #${orderNumber}`,
          createdBy: (user as AuthUser | null)?.uid ?? null,
          createdAt: new Date(),
        });
      }
    });

    return NextResponse.json({
      success: true,
      orderId: id,
      orderNumber,
    });

  } catch (err) {
    console.error("PUT /api/orders/[id] error:", err);
    return NextResponse.json({ error: "Gagal memperbarui order" }, { status: 500 });
  }
}
