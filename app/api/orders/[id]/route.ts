import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireRole, verifyAuth } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import { calculateProductHPP } from "@/lib/business-logic";
import { orderSchema } from "@/lib/validations";
import { BusinessError } from "@/lib/errors";

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
      poNumber: d.poNumber ?? null,
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
      sauceDistribution: d.sauceDistribution ?? null,
      secondaryPackagingIngId: d.secondaryPackagingIngId ?? null,
      cashReceived: d.cashReceived ?? null,
      changeAmount: d.changeAmount ?? null,
      paidAt: d.paidAt?.toDate?.().toISOString() ?? d.paidAt ?? null,
      paidBy: d.paidBy ?? null,
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

  const parseResult = orderSchema.partial().safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parseResult.error.format() }, { status: 400 });
  }

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
    poNumber,
    secondaryPackagingIngId,
    cashReceived,
    changeAmount,
  } = parseResult.data;
  // Proceed with update

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
    const effectiveOrderChannel = orderChannel ?? oldOrder.orderChannel ?? "walkin";
    const isWhatsApp = effectiveOrderChannel === "whatsapp";
    let discountPerUnit = 0;

    if (customerId) {
      const customerSnap = await adminDb.doc(`customers/${customerId}`).get();
      const customer = customerSnap.data();
      if (customer) {
        resolvedCustomerName = customer.name ?? resolvedCustomerName;
        resolvedCustomerPhone = customer.phoneNumber ?? null;
        resolvedChannel = customer.channel ?? "walk_in";
        resolvedCustomerType = customer.customerType ?? resolvedCustomerType;
        discountPerUnit = isWhatsApp ? (customer.discountPerUnit ?? 0) : 0;
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
      const effectiveDiscount = isWhatsApp ? (discountPerUnit > 0 ? discountPerUnit : (item.discountPerUnit ?? 0)) : 0;
      const unitPrice = Math.max(0, basePrice - effectiveDiscount);
      const totalPrice = unitPrice * item.qty;
      const packPerBatch = product?.packPerBatch || 1;
      const hppPerUnit = await calculateProductHPP(item.productId, item.variantId, packPerBatch);
      const totalHpp = hppPerUnit * item.qty;
      const margin = totalPrice - totalHpp;

      const itemData: Record<string, unknown> = {
        productId: item.productId,
        productName: product?.name ?? item.productId,
        variantId: item.variantId,
        variantName: variant?.name ?? item.variantId,
        qty: item.qty,
        basePrice,
        appliedTier: `${totalProductQty} pcs`,
        discountPerUnit: effectiveDiscount,
        price: unitPrice,
        unitPrice,
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

    const user = roleCheck as AuthUser;

    await adminDb.runTransaction(async (tx) => {
      // --- ALL READS MUST HAPPEN BEFORE ANY WRITES ---
      
      // 1. Sauces read
      const oldSauceDist = oldOrder.sauceDistribution;
      const addOnSnaps: Record<string, FirebaseFirestore.DocumentSnapshot> = {};

      const sauceIdsToFetch = new Set<string>();
      if (oldSauceDist && typeof oldSauceDist === "object") {
        Object.keys(oldSauceDist).forEach(id => sauceIdsToFetch.add(id));
      }
      if (sauceDistribution && typeof sauceDistribution === "object") {
        Object.keys(sauceDistribution).forEach(id => sauceIdsToFetch.add(id));
      }

      for (const sauceId of sauceIdsToFetch) {
        addOnSnaps[sauceId] = await tx.get(adminDb.collection("addOns").doc(sauceId));
      }

      const addonStocks: Record<string, number> = {};
      for (const sauceId of sauceIdsToFetch) {
        const snap = addOnSnaps[sauceId];
        addonStocks[sauceId] = snap && snap.exists ? (snap.data()?.currentStock ?? 0) : 0;
      }

      // 2. Physical Product Stocks read (Old & New)
      const oldPhysicalItems: { productId: string; variantId: string; qty: number }[] = [];
      for (const doc of oldItemsSnap.docs) {
        const data = doc.data();
        const isRainbow = data.productId === "churros-rainbow" || data.variantId === "rainbow";
        const isNoVariant = !data.variantId || data.variantId === "none" || data.variantName === "Jasa";
        if (!isRainbow && !isNoVariant) {
          oldPhysicalItems.push({
            productId: data.productId,
            variantId: data.variantId,
            qty: data.qty ?? 0,
          });
        }
      }

      const newPhysicalItems: { productId: string; variantId: string; qty: number }[] = [];
      for (const item of items) {
        const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";
        const isNoVariant = !item.variantId || item.variantId === "none";
        if (!isRainbow && !isNoVariant) {
          newPhysicalItems.push({
            productId: item.productId,
            variantId: item.variantId,
            qty: item.qty,
          });
        }
      }

      const allProductStockIds = new Set<string>();
      oldPhysicalItems.forEach(i => allProductStockIds.add(`${i.productId}_${i.variantId}`));
      newPhysicalItems.forEach(i => allProductStockIds.add(`${i.productId}_${i.variantId}`));

      const productStockSnaps: Record<string, FirebaseFirestore.DocumentSnapshot> = {};
      const productStocks: Record<string, number> = {};
      for (const sId of allProductStockIds) {
        const snap = await tx.get(adminDb.collection("productStocks").doc(sId));
        productStockSnaps[sId] = snap;
        productStocks[sId] = snap && snap.exists ? (snap.data()?.currentStock ?? 0) : 0;
      }

      // 3. Secondary Packaging read (Old & New)
      const oldSecPkgId = oldOrder.secondaryPackagingIngId as string | undefined;
      const newSecPkgId = secondaryPackagingIngId !== undefined ? secondaryPackagingIngId : oldSecPkgId;
      const secPkgIds = new Set<string>();
      if (oldSecPkgId && oldSecPkgId !== "none") secPkgIds.add(oldSecPkgId);
      if (newSecPkgId && newSecPkgId !== "none") secPkgIds.add(newSecPkgId);

      const secPkgSnaps: Record<string, FirebaseFirestore.DocumentSnapshot> = {};
      const secPkgStocks: Record<string, number> = {};
      for (const pkgId of secPkgIds) {
        const snap = await tx.get(adminDb.collection("ingredients").doc(pkgId));
        secPkgSnaps[pkgId] = snap;
        secPkgStocks[pkgId] = snap && snap.exists ? (snap.data()?.currentStock ?? 0) : 0;
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

      // 2. REVERT OLD PHYSICAL PRODUCT STOCKS
      for (const oldItem of oldPhysicalItems) {
        if (oldItem.qty <= 0) continue;
        const sId = `${oldItem.productId}_${oldItem.variantId}`;
        const nextStock = productStocks[sId] + oldItem.qty;
        productStocks[sId] = nextStock;

        const stockRef = adminDb.collection("productStocks").doc(sId);
        tx.set(stockRef, {
          productId: oldItem.productId,
          variantId: oldItem.variantId,
          currentStock: nextStock,
        }, { merge: true });

        const movementRef = adminDb.collection("stockMovements").doc();
        tx.set(movementRef, {
          ingredientId: `product:${sId}`,
          changeAmount: oldItem.qty,
          newStockAfter: nextStock,
          sourceType: "opname_adjustment",
          sourceId: orderRef.id,
          note: `Revert produk karena edit order #${orderNumber}`,
          createdBy: user.uid,
          createdAt: new Date(),
        });
      }

      // 3. REVERT OLD SECONDARY PACKAGING
      if (oldSecPkgId && oldSecPkgId !== "none" && oldSecPkgId !== newSecPkgId && secPkgSnaps[oldSecPkgId]?.exists) {
        const nextSec = secPkgStocks[oldSecPkgId] + 1;
        secPkgStocks[oldSecPkgId] = nextSec;
        tx.update(adminDb.collection("ingredients").doc(oldSecPkgId), { currentStock: nextSec });

        const mSec = adminDb.collection("stockMovements").doc();
        tx.set(mSec, {
          ingredientId: oldSecPkgId,
          changeAmount: 1,
          newStockAfter: nextSec,
          sourceType: "opname_adjustment",
          sourceId: orderRef.id,
          note: `Revert kemasan pengiriman karena edit order #${orderNumber}`,
          createdAt: new Date(),
        });
      }

      // 4. DELETE OLD ITEMS SUBCOLLECTION DOCS
      for (const doc of oldItemsSnap.docs) {
        tx.delete(doc.ref);
      }

      // 5. DELETE OLD SHIPPING COST EXPENSES
      for (const doc of oldExpensesSnap.docs) {
        tx.delete(doc.ref);
      }

      // 6. CALCULATE NEW platform fee & net revenue
      const finalOrderChannel = orderChannel ?? "walkin";
      const totalOrderValue = processedItems.reduce((sum, item) => sum + ((item.totalPrice as number) ?? 0), 0);
      const finalFeePercent = inputFeePercent ?? 0;
      const finalFeeAmount = inputFeeAmount ?? (totalOrderValue * finalFeePercent / 100);
      const netRevenue = (totalOrderValue - finalFeeAmount) + (shippingBorneBy === "customer" ? (shippingCost ?? 0) : 0);

      // 7. UPDATE MAIN ORDER DOCUMENT
      const isNowPaid = paymentStatus === "sudah_bayar";
      const wasPaid = oldOrder.paymentStatus === "sudah_bayar";

      tx.update(orderRef, {
        source: source ?? "walk_in",
        orderChannel: finalOrderChannel,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        customerType: resolvedCustomerType,
        customerPhone: resolvedCustomerPhone,
        channel: finalOrderChannel,
        paymentStatus: paymentStatus ?? "sudah_bayar",
        paymentMethod: paymentMethod ?? null,
        ...(isNowPaid && oldOrder.status === "pending" ? { status: "proses" } : {}),
        ...(isNowPaid && !wasPaid ? { paidAt: new Date(), paidBy: user.uid } : {}),
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
        poNumber: poNumber !== undefined ? poNumber : (oldOrder.poNumber ?? null),
        sauceDistribution: sauceDistribution !== undefined ? sauceDistribution : (oldOrder.sauceDistribution ?? null),
        secondaryPackagingIngId: newSecPkgId ?? null,
        cashReceived: cashReceived !== undefined ? cashReceived : (oldOrder.cashReceived ?? null),
        changeAmount: changeAmount !== undefined ? changeAmount : (oldOrder.changeAmount ?? null),
        createdAt: dateToUse,
      });

      // 8. WRITE NEW ITEMS
      for (const itemData of processedItems) {
        const itemRef = orderRef.collection("items").doc();
        tx.set(itemRef, itemData);
      }

      // 9. DEDUCT NEW GLAZE/SAUS STOCK DEDUCTIONS
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

      // 10. DEDUCT NEW PHYSICAL PRODUCT STOCKS
      const newProductStockChanges: Record<string, number> = {};
      for (const item of newPhysicalItems) {
        const sId = `${item.productId}_${item.variantId}`;
        newProductStockChanges[sId] = (newProductStockChanges[sId] ?? 0) + item.qty;
      }

      for (const [sId, changeQty] of Object.entries(newProductStockChanges)) {
        const curr = productStocks[sId] ?? 0;
        const nextStock = curr - changeQty;
        if (nextStock < 0) {
          const [prodId, varId] = [sId.split("_")[0], sId.split("_").slice(1).join("_")];
          throw new BusinessError(`Stok ${prodId} varian ${varId} tidak mencukupi (tersedia: ${curr}, diminta: ${changeQty})`, 400);
        }
        productStocks[sId] = nextStock;

        const stockRef = adminDb.collection("productStocks").doc(sId);
        tx.set(stockRef, {
          productId: sId.split("_")[0],
          variantId: sId.split("_").slice(1).join("_"),
          currentStock: nextStock,
        }, { merge: true });

        const movementRef = adminDb.collection("stockMovements").doc();
        tx.set(movementRef, {
          ingredientId: `product:${sId}`,
          changeAmount: -changeQty,
          newStockAfter: nextStock,
          sourceType: "sale",
          sourceId: orderRef.id,
          note: `Penjualan ${finalOrderChannel} update #${orderNumber}`,
          createdBy: user.uid,
          createdAt: dateToUse,
        });
      }

      // 11. DEDUCT NEW SECONDARY PACKAGING
      if (newSecPkgId && newSecPkgId !== "none" && newSecPkgId !== oldSecPkgId && secPkgSnaps[newSecPkgId]?.exists) {
        const nextSec = secPkgStocks[newSecPkgId] - 1;
        secPkgStocks[newSecPkgId] = nextSec;
        tx.update(adminDb.collection("ingredients").doc(newSecPkgId), { currentStock: nextSec });

        const mSecNew = adminDb.collection("stockMovements").doc();
        tx.set(mSecNew, {
          ingredientId: newSecPkgId,
          changeAmount: -1,
          newStockAfter: nextSec,
          sourceType: "sale",
          sourceId: orderRef.id,
          note: `Pemakaian kemasan pengiriman untuk edit order #${orderNumber}`,
          createdAt: dateToUse,
        });
      }

      // 12. WRITE NEW SHIPPING EXPENSE IF BORNE BY SELLER
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
          createdBy: user.uid,
          createdAt: new Date(),
        });
      }
    });

    return NextResponse.json({
      success: true,
      orderId: id,
      orderNumber,
    });

  } catch (err: any) {
    console.error("PUT /api/orders/[id] error:", err);
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err?.message || "Gagal memperbarui order" }, { status: 500 });
  }
}
