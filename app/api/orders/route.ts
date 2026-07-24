import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireRole, verifyAuth } from "@/lib/auth-middleware";
import type { AuthUser } from "@/lib/auth-middleware";
import { orderSchema } from "@/lib/validations";
import { calculateProductHPP, getLatestIngredientCosts } from "@/lib/business-logic";

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
      .limit(200);

    // When explicitly requesting void tab, filter for void only
    // Otherwise always filter IN by status (non-void)
    if (status === "void") {
      query = query.where("status", "==", "void");
    } else if (status) {
      query = query.where("status", "==", status);
    }

    if (paymentStatus) query = query.where("paymentStatus", "==", paymentStatus);

    const snap = await query.get();
    let orders = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
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
        orderNotes: d.orderNotes ?? null,
        shippingCost: d.shippingCost,
        shippingCostConfirmed: d.shippingCostConfirmed ?? false,
        shippingBorneBy: d.shippingBorneBy ?? null,
        deliveryMethod: d.deliveryMethod ?? null,
        invoiceNumber: d.invoiceNumber,

        voidReason: d.voidReason ?? null,
        voidedAt: d.voidedAt?.toDate?.().toISOString() ?? null,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? d.createdAt,
        completedAt: d.completedAt?.toDate?.().toISOString() ?? d.completedAt,
      };
    });

    // When not explicitly requesting void tab, exclude void orders
    if (status !== "void") {
      orders = orders.filter((o) => o.status !== "void");
    }

    // Removed slice to allow full client-side filtering of up to 200 recent orders
    return NextResponse.json(orders);
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ error: "Gagal mengambil data order" }, { status: 500 });
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

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  const isPublic = !user;

  if (!isPublic) {
    const roleCheck = await requireRole(req, ["owner", "manager"]);
    if (roleCheck instanceof NextResponse) return roleCheck;
  }

  const body = await req.json();

  const parseResult = orderSchema.safeParse(body);
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
    paymentStatus: inputPaymentStatus,
    shippingAddress,
    requestedDeliveryDate,
    orderNotes,
    platformFeePercent: inputFeePercent,
    platformFee: inputFeeAmount,
    shippingCost: inputShippingCost,
  } = parseResult.data;
  
  // customDate isn't in schema since it's a server override, extract from body manually
  const customDate = body.customDate;
  
  // Extra fields not in zod validation (we need to add them to Zod or extract them)
  const shippingBorneBy = body.shippingBorneBy;
  const deliveryMethod = body.deliveryMethod;
  const sauceDistribution = body.sauceDistribution;
  const poNumber = body.poNumber;

  if (!items?.length) {
    return NextResponse.json({ error: "Pilih minimal 1 item" }, { status: 400 });
  }

  // Security: Only owner/manager can set custom date
  if (customDate) {
    if (isPublic) {
      return NextResponse.json({ error: "Akses ditolak: Hanya Manager/Owner yang dapat mencatat tanggal mundur" }, { status: 403 });
    }
  }

  try {
    // Resolve customer — either from Firestore or use direct name (walk-in)
    let resolvedCustomerName = directCustomerName?.trim() || "Walk-in";
    let resolvedCustomerPhone: string | null = null;
    let resolvedChannel = "walk_in";
    let resolvedCustomerId = customerId ?? null;
    let resolvedCustomerType = inputCustomerType ?? null;
    let resolvedCustomerAddress = shippingAddress ?? null;
    let discountPerUnit = 0;

    if (customerId) {
      const customerSnap = await adminDb.doc(`customers/${customerId}`).get();
      const customer = customerSnap.data();
      if (customer) {
        resolvedCustomerName = customer.name ?? resolvedCustomerName;
        resolvedCustomerPhone = customer.phoneNumber ?? null;
        resolvedCustomerType = customer.customerType ?? resolvedCustomerType;
        discountPerUnit = customer.discountPerUnit ?? 0;
        if (!resolvedCustomerAddress && customer.address) {
          resolvedCustomerAddress = customer.address;
        }
      }
    }

    const dateToUse = customDate ? new Date(customDate) : new Date();
    // Maintain correct timezone date prefix
    const orderRef = adminDb.collection("orders").doc();
    let needsProduction = false;
    let hasRainbow = false;

    // Accumulate quantity per product to apply cumulative price tiers
    const productQtyMap = new Map<string, number>();
    for (const item of items) {
      const current = productQtyMap.get(item.productId) ?? 0;
      productQtyMap.set(item.productId, current + item.qty);
    }

    const processedItems: Record<string, unknown>[] = [];

    for (const item of items) {
      const productSnap = await adminDb.doc(`products/${item.productId}`).get();
      const product = productSnap.data();

      const variantSnap = await adminDb.doc(`variants/${item.variantId}`).get();
      const variant = variantSnap.data();

      const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";

      const totalProductQty = productQtyMap.get(item.productId) ?? item.qty;
      const basePrice = await getApplicableTier(item.productId, totalProductQty);
      const totalPrice = (basePrice - discountPerUnit) * item.qty;
      
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

    let orderNumber = "";

    await adminDb.runTransaction(async (tx) => {
      // Determine order channel
      const finalOrderChannel = orderChannel ?? "walkin";
      const isImmediate = ["walkin", "tiktok", "shopee"].includes(finalOrderChannel);

      // --- ALL READS MUST HAPPEN BEFORE ANY WRITES ---
      
      // 0. Generate Order Number
      const dateStr = dateToUse.toISOString().split("T")[0].replace(/-/g, "");
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
      
      // 1. Read Add-ons for sauce distribution
      const addOnSnaps: Record<string, FirebaseFirestore.DocumentSnapshot> = {};
      if (sauceDistribution && typeof sauceDistribution === "object") {
        for (const [sauceId, cupCount] of Object.entries(sauceDistribution)) {
          if (typeof cupCount === "number" && cupCount > 0) {
            addOnSnaps[sauceId] = await tx.get(adminDb.collection("addOns").doc(sauceId));
          }
        }
      }

      // 2. Read Product Stocks
      const stockSnaps: Record<string, FirebaseFirestore.DocumentSnapshot> = {};
      if (isImmediate) {
        for (const item of items) {
          const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";
          if (!isRainbow) {
            const stockId = `${item.productId}_${item.variantId}`;
            if (!stockSnaps[stockId]) {
              stockSnaps[stockId] = await tx.get(adminDb.collection("productStocks").doc(stockId));
            }
          }
        }
      }

      // --- WRITES ---

      // Calculate platform fee & net revenue
      const totalOrderValue = processedItems.reduce((sum, item) => sum + ((item.totalPrice as number) ?? 0), 0);
      const totalOrderHpp = processedItems.reduce((sum, item) => sum + ((item.totalHpp as number) ?? 0), 0);
      const finalFeePercent = inputFeePercent ?? 0;
      const finalFeeAmount = inputFeeAmount ?? (totalOrderValue * finalFeePercent / 100);
      // Net revenue includes shipping if borne by customer
      const netRevenue = (totalOrderValue - finalFeeAmount) + (shippingBorneBy === "customer" ? (inputShippingCost ?? 0) : 0);

      tx.set(orderRef, {
        orderNumber,
        source: orderChannel === "walkin" ? "walk_in" : (orderChannel === "whatsapp" ? "wa_form" : "marketplace_manual"),
        orderChannel: orderChannel,
        channel: finalOrderChannel,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        customerType: resolvedCustomerType,
        customerPhone: resolvedCustomerPhone,
        status: isImmediate ? "selesai" : (inputPaymentStatus === "sudah_bayar" ? "proses" : "pending"),
        paymentStatus: inputPaymentStatus ?? "sudah_bayar",
        paymentMethod: paymentMethod ?? null,
        platformFeePercent: finalFeePercent,
        platformFee: finalFeeAmount,
        totalOrderValue,
        totalHpp: totalOrderHpp,
        netRevenue,
        needsProduction,
        createdBy: (user as AuthUser | null)?.uid ?? null,
        createdAt: dateToUse,
        completedAt: isImmediate ? dateToUse : null,
        shippingAddress: resolvedCustomerAddress,
        requestedDeliveryDate: requestedDeliveryDate ?? null,
        orderNotes: orderNotes ?? null,
        proofOfTransferUrl: null,
        shippingCost: inputShippingCost ?? null,
        shippingBorneBy: shippingBorneBy ?? null,
        deliveryMethod: deliveryMethod ?? null,
        shippingCostConfirmed: true,
        invoiceNumber: null,
        invoiceGeneratedAt: null,
        invoiceUrl: null,
        sauceDistribution: sauceDistribution ?? null,
        poNumber: poNumber ?? null,
        voidReason: null,
        voidedAt: null,
      });


      // Kurangi stok add-on saos/glaze secara dinamis jika terlampir
      if (sauceDistribution && typeof sauceDistribution === "object") {
        for (const [sauceId, cupCount] of Object.entries(sauceDistribution)) {
          if (typeof cupCount === "number" && cupCount > 0) {
            const addOnRef = adminDb.collection("addOns").doc(sauceId);
            const addOnSnap = addOnSnaps[sauceId];
            if (addOnSnap && addOnSnap.exists) {
              const currAddonStock = addOnSnap.data()?.currentStock ?? 0;
              const nextAddonStock = currAddonStock - cupCount;
              tx.update(addOnRef, { currentStock: nextAddonStock });

              // Log stock movement for addon
              const movementRef = adminDb.collection("stockMovements").doc();
              tx.set(movementRef, {
                ingredientId: `addon:${sauceId}`,
                changeAmount: -cupCount,
                newStockAfter: nextAddonStock,
                sourceType: "sale",
                notes: `Penjualan saos untuk order #${orderNumber}`,
                createdAt: dateToUse,
              });
            }
          }
        }
      }

      // Jika ongkir ditanggung penjual, otomatis catat sebagai pengeluaran (expense)
      if (finalOrderChannel === "whatsapp" && (inputShippingCost ?? 0) > 0 && shippingBorneBy === "seller") {
        const expenseRef = adminDb.collection("expenses").doc();
        tx.set(expenseRef, {
          date: dateToUse,
          category: "operasional",
          ingredientId: null,
          itemName: `Ongkir Order #${orderNumber}`,
          qtyPurchased: 1,
          purchaseUnit: "kali",
          qtyInBaseUnit: 1,
          totalPrice: inputShippingCost,
          pricePerBaseUnit: inputShippingCost,
          paymentMethod: "transfer",
          supplier: "Ekspedisi / Kurir",
          notes: `Ditanggung penjual untuk order #${orderNumber}`,
          createdBy: (user as AuthUser | null)?.uid ?? null,
          createdAt: dateToUse,
        });
      }

      for (const itemData of processedItems) {
        const itemRef = orderRef.collection("items").doc();
        tx.set(itemRef, itemData);
      }

      // Kurangi stok produk jadi jika orderChannel langsung (walkin, tiktok, shopee)
      if (isImmediate) {
        // Since we might have multiple items pointing to the same stockId, we need to accumulate changes
        const stockChanges: Record<string, number> = {};
        for (const item of items) {
          const isRainbow = item.productId === "churros-rainbow" || item.variantId === "rainbow";
          if (!isRainbow) {
            const stockId = `${item.productId}_${item.variantId}`;
            stockChanges[stockId] = (stockChanges[stockId] ?? 0) + item.qty;
          }
        }

        for (const [stockId, changeQty] of Object.entries(stockChanges)) {
          const stockRef = adminDb.collection("productStocks").doc(stockId);
          const stockSnap = stockSnaps[stockId];
          const currStock = stockSnap && stockSnap.exists ? (stockSnap.data()?.currentStock ?? 0) : 0;
          const nextStock = currStock - changeQty;

          if (nextStock < 0) {
            const [prodId, varId] = [stockId.split("_")[0], stockId.split("_").slice(1).join("_")];
            throw new Error(`Stok ${prodId} varian ${varId} tidak mencukupi (tersedia: ${currStock}, diminta: ${changeQty})`);
          }

          tx.set(stockRef, {
            productId: stockId.split("_")[0],
            variantId: stockId.split("_").slice(1).join("_"),
            currentStock: nextStock,
          }, { merge: true });

          // Log stock movement
          const movementRef = adminDb.collection("stockMovements").doc();
          tx.set(movementRef, {
            ingredientId: `product:${stockId}`,
            changeAmount: -changeQty,
            newStockAfter: nextStock,
            sourceType: "sale",
            sourceId: orderRef.id,
            note: `Penjualan ${finalOrderChannel} #${orderNumber}`,
            createdBy: (user as AuthUser | null)?.uid ?? null,
            createdAt: dateToUse,
          });
        }
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
  } catch (err: any) {
    console.error("POST /api/orders error:", err);
    return NextResponse.json({ error: "Gagal membuat order" }, { status: 500 });
  }
}
