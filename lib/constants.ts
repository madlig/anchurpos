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
