export const BUSINESS = {
  // --- Attendance & Payroll ---
  REGULAR_HOURS_PER_SHIFT: 8,
  OVERTIME_BONUS_PER_BLOCK: 10000,
  
  // --- Production & Packing ---
  // Cinnamon Blending (1 batch)
  CINNAMON_BATCH_SUGAR_GRAMS: 1500,
  CINNAMON_BATCH_POWDER_GRAMS: 40, 
  
  // Glaze Repacking
  GLAZE_CUP_GRAMS: 13,
  GLAZE_TIKTOK_GRAMS: 15,
  
  // Cinnamon Clip Repacking
  CINNAMON_CLIP_GRAMS: 5,
} as const;

export const CUSTOMER_TYPES = ["reguler", "b2b", "reseller", "grosir", "mitra"] as const;
export type CustomerType = typeof CUSTOMER_TYPES[number];

export const ORDER_CHANNELS = ["walkin", "gojek", "grab", "shopee", "tiktok", "whatsapp"] as const;
export type OrderChannel = typeof ORDER_CHANNELS[number];

export const ORDER_STATUSES = ["pending", "proses", "selesai", "void"] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const PAYMENT_STATUSES = ["belum_bayar", "sudah_bayar"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
