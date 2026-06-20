export interface Material {
  id: string;
  name: string;
  unit: "g" | "ml" | "pcs";
  stock: number;
  costPerUnit: number;
  lowStockThreshold: number;
  isDefault: boolean;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  packSize: number;
  price: number;
  stock: number;
  avgCost: number;
  isActive: boolean;
}

export interface Production {
  id: string;
  date: string;
  ingredients: Record<string, number>;
  totalCost: number;
  outputQty: number;
  packCount: number;
  costPerPack: number;
}

export interface Transaction {
  id: string;
  date: string;
  productId: string;
  qty: number;
  priceEach: number;
  totalPrice: number;
  costEach: number;
  totalCost: number;
  profit: number;
  voided: boolean;
  voidedAt: string | null;
}

export interface Recipe {
  id: string;
  productId: string;
  ingredients: Record<string, number>;
  outputPack: number;
}
