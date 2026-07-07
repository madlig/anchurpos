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

    // Apply client-side limit after filtering
    orders = orders.slice(0, 50);

    return NextResponse.json(orders);
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ error: "Gagal mengambil data order" }, { status: 500 });
  }
}


async function generateOrderNumber(customDate?: Date): Promise<string> {
  const today = customDate || new Date();
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

    const dateToUse = customDate ? new Date(customDate) : new Date();
    // Maintain correct timezone date prefix
    const orderNumber = await generateOrderNumber(dateToUse);
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

    await adminDb.runTransaction(async (tx) => {
      // Determine order channel
      const finalOrderChannel = orderChannel ?? "walkin";
      const isImmediate = ["walkin", "tiktok", "shopee"].includes(finalOrderChannel);

      // --- ALL READS MUST HAPPEN BEFORE ANY WRITES ---
      
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
      const finalFeePercent = inputFeePercent ?? 0;
      const finalFeeAmount = inputFeeAmount ?? (totalOrderValue * finalFeePercent / 100);
      // Net revenue includes shipping if borne by customer
      const netRevenue = (totalOrderValue - finalFeeAmount) + (shippingBorneBy === "customer" ? (shippingCost ?? 0) : 0);

      tx.set(orderRef, {
        orderNumber,
        source: source ?? "walk_in",
        orderChannel: finalOrderChannel,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        customerType: resolvedCustomerType,
        customerPhone: resolvedCustomerPhone,
        channel: resolvedChannel,
        status: isImmediate ? "selesai" : "belum_selesai",
        paymentStatus: inputPaymentStatus ?? "sudah_bayar",
        paymentMethod: paymentMethod ?? null,
        platformFeePercent: finalFeePercent,
        platformFee: finalFeeAmount,
        netRevenue,
        needsProduction,
        createdBy: (user as AuthUser | null)?.uid ?? null,
        createdAt: dateToUse,
        completedAt: isImmediate ? dateToUse : null,
        shippingAddress: shippingAddress ?? null,
        requestedDeliveryDate: requestedDeliveryDate ?? null,
        orderNotes: orderNotes ?? null,
        proofOfTransferUrl: null,
        shippingCost: shippingCost ?? null,
        shippingBorneBy: shippingBorneBy ?? null,
        deliveryMethod: deliveryMethod ?? null,
        shippingCostConfirmed: true,
        invoiceNumber: null,
        invoiceGeneratedAt: null,
        invoiceUrl: null,
        sauceDistribution: sauceDistribution ?? null,
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
