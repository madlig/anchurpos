import { z } from "zod";

// Base schemas
export const orderItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  variantId: z.string().min(1),
  variantName: z.string().min(1),
  qty: z.number().int().positive(),
  basePrice: z.number().min(0),
  appliedTier: z.string(),
  discountPerUnit: z.number().min(0),
  totalPrice: z.number().min(0),
  sauceId: z.string().nullable().optional(),
  sauceName: z.string().nullable().optional(),
});

export const orderSchema = z.object({
  source: z.enum(["marketplace_manual", "wa_form", "walk_in"]),
  orderChannel: z.enum(["walkin", "whatsapp", "tiktok", "shopee"]),
  customerId: z.string().nullable().optional(),
  customerName: z.string().min(1, "Nama customer wajib diisi"),
  customerPhone: z.string().nullable().optional(),
  customerType: z.enum(["reguler", "b2b", "reseller"]).nullable().optional(),
  platformFeePercent: z.number().min(0).max(100).default(0),
  platformFee: z.number().min(0).default(0),
  shippingAddress: z.string().nullable().optional(),
  requestedDeliveryDate: z.string().nullable().optional(),
  orderNotes: z.string().nullable().optional(),
  shippingCost: z.number().min(0).nullable().optional(),
  items: z.array(orderItemSchema).min(1, "Minimal 1 item pesanan"),
  paymentStatus: z.enum(["belum_bayar", "sudah_bayar"]).default("sudah_bayar"),
  paymentMethod: z.enum(["cash", "transfer", "qris"]).nullable().optional(),
  shippingBorneBy: z.enum(["seller", "customer"]).nullable().optional(),
  deliveryMethod: z.enum(["pickup", "self_delivery", "courier"]).nullable().optional(),
  sauceDistribution: z.record(z.number()).nullable().optional(),
  poNumber: z.string().nullable().optional(),
  customDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD").optional(),
});

export const publicOrderSchema = z.object({
  phoneNumber: z.string().min(5, "Nomor HP wajib diisi"),
  name: z.string().min(1, "Nama wajib diisi"),
  address: z.string().optional().default(""),
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().min(1),
    qty: z.number().int().positive()
  })).min(1, "Minimal 1 item pesanan"),
  requestedDeliveryDate: z.string().optional(),
  orderNotes: z.string().optional(),
});

export const expenseCreateSchema = z.object({
  category: z.enum(["operasional", "lain_lain"]),
  itemName: z.string().min(1, "Nama pengeluaran wajib diisi"),
  totalPrice: z.number().min(0, "Total tidak boleh negatif"),
  paymentMethod: z.enum(["cash", "transfer", "qris"]),
  notes: z.string().optional().default(""),
  supplier: z.string().nullable().optional(),
  customDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD").optional(),
});

export const purchaseCreateSchema = z.object({
  category: z.enum(["bahan_baku", "packaging"]),
  ingredientId: z.string().min(1, "Bahan baku wajib dipilih"),
  qtyPurchased: z.number().positive("Kuantitas harus lebih dari 0"),
  purchaseUnit: z.string().min(1, "Satuan beli wajib dipilih"),
  totalPrice: z.number().min(0, "Total harga tidak boleh negatif"),
  paymentMethod: z.enum(["cash", "transfer", "qris"]),
  supplier: z.string().nullable().optional(),
  notes: z.string().optional().default(""),
  customDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD").optional(),
});

export const productionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
  variantId: z.string().min(1, "Varian wajib diisi"),
  batches: z.number().int().positive("Jumlah batch harus > 0"),
  loyangCount: z.number().int().min(0, "Loyang tidak boleh negatif"),
  pcsCount: z.number().int().min(0, "Pcs tidak boleh negatif"),
  notes: z.string().optional().default(""),
});

export const productionBatchSchema = z.object({
  type: z.enum(["standard", "tiktok"]).optional().default("standard"),
  notes: z.string().optional().default(""),
  crewId: z.string().optional(),
  customDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD").optional(),
  entries: z.array(z.object({
    variantId: z.string().min(1),
    batches: z.number().int().positive(),
    loyangCount: z.number().int().min(0),
    pcsCount: z.number().int().min(0),
  })).min(1, "Minimal 1 varian harus diisi")
});

export const employeeSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.enum(["owner", "manager", "crew"]).default("crew"),
  phone: z.string().nullable().optional(),
  joinDate: z.string().nullable().optional(),
});

export const employeeUpdateSchema = employeeSchema.partial().omit({ username: true, password: true }).extend({
  isActive: z.boolean().optional(),
});

export const priceTierSchema = z.object({
  minQty: z.number().int().min(1),
  maxQty: z.number().int().nullable().optional(),
  price: z.number().min(0),
});

export const productSchema = z.object({
  code: z.string().min(1, "Kode produk wajib diisi"),
  name: z.string().min(1, "Nama produk wajib diisi"),
  description: z.string().optional().default(""),
  packPerBatch: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
  channels: z.array(z.string()).default([]),
  priceTiers: z.array(priceTierSchema).optional(),
});

export const ingredientSchema = z.object({
  name: z.string().min(1, "Nama bahan wajib diisi"),
  baseUnit: z.string().min(1, "Satuan wajib diisi"),
  minStock: z.number().min(0).default(0),
  category: z.string().default("bahan_baku"),
  channels: z.array(z.string()).default([]),
  unitAlternatives: z.array(z.object({
    unit: z.string(),
    conversionToBase: z.number()
  })).default([]),
});
