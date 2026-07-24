export interface PriceTier { id: string; minQty: number; maxQty: number | null; price: number; }
export interface ProductItem {
  id: string; code: string; name: string; description: string;
  packPerBatch: number; isActive: boolean; priceTiers: PriceTier[]; channels?: string[];
  freeSauceAllowance?: number;
}
export interface Variant {
  id: string; name: string; currentStock: number; minStock: number; sortOrder: number; freeSauceAllowance?: number;
}
export interface CustomerItem {
  id: string; name: string; channel: string; customerType: string; phoneNumber: string | null;
}
export interface CartItem {
  productId: string; productName: string;
  variantId: string; variantName: string;
  qty: number; price: number;
  basePrice: number; appliedTier: string; discountPerUnit: number; totalPrice: number;
  sauceId?: string;
  sauceName?: string;
  freeSauceAllowance?: number;
}
export interface AddonItem { id: string; name: string; price: number; currentStock: number; minStock: number; channels?: string[]; }
