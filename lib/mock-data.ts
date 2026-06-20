import type { Material, Product, Production, Transaction, Recipe } from "@/types";

export const materials: Material[] = [
  { id: "water",   name: "Air",           unit: "ml", stock: 10000, costPerUnit: 0.001, lowStockThreshold: 3000, isDefault: true },
  { id: "flour",   name: "Tepung Terigu", unit: "g",  stock: 5000,  costPerUnit: 20,    lowStockThreshold: 1000, isDefault: true },
  { id: "butter",  name: "Mentega",       unit: "g",  stock: 2000,  costPerUnit: 30,    lowStockThreshold: 500,  isDefault: true },
  { id: "sugar",   name: "Gula",          unit: "g",  stock: 2000,  costPerUnit: 10,    lowStockThreshold: 500,  isDefault: true },
  { id: "salt",    name: "Garam",         unit: "g",  stock: 500,   costPerUnit: 5,     lowStockThreshold: 100,  isDefault: true },
  { id: "vanilla", name: "Vanilla",       unit: "g",  stock: 200,   costPerUnit: 100,   lowStockThreshold: 50,   isDefault: true },
  { id: "eggs",    name: "Telur",         unit: "g",  stock: 2000,  costPerUnit: 25,    lowStockThreshold: 500,  isDefault: true },
  { id: "flavor",  name: "Perisa Cinnamon", unit: "g", stock: 80,   costPerUnit: 500,   lowStockThreshold: 100,  isDefault: true },
];

export const products: Product[] = [
  {
    id: "churros-pack",
    name: "Churros Pack",
    unit: "pack",
    packSize: 12,
    price: 25000,
    stock: 18,
    avgCost: 9420,
    isActive: true,
  },
];

export const recipe: Recipe = {
  id: "default-churros",
  productId: "churros-pack",
  ingredients: {
    water: 1800,
    flour: 1000,
    butter: 325,
    sugar: 325,
    salt: 10,
    vanilla: 5,
    eggs: 495,
    flavor: 20,
  },
  outputPack: 16,
};

const now = new Date();
const d = (daysAgo: number, hour = 10, min = 0) => {
  const dt = new Date(now);
  dt.setDate(dt.getDate() - daysAgo);
  dt.setHours(hour, min, 0, 0);
  return dt.toISOString();
};

export const productions: Production[] = [
  {
    id: "prod-001",
    date: d(0, 8, 0),
    ingredients: { water: 1800, flour: 1000, butter: 325, sugar: 325, salt: 10, vanilla: 5, eggs: 495, flavor: 20 },
    totalCost: 150720,
    outputQty: 192,
    packCount: 16,
    costPerPack: 9420,
  },
  {
    id: "prod-002",
    date: d(1, 8, 30),
    ingredients: { water: 1800, flour: 1000, butter: 325, sugar: 325, salt: 10, vanilla: 5, eggs: 495, flavor: 20 },
    totalCost: 150720,
    outputQty: 192,
    packCount: 16,
    costPerPack: 9420,
  },
  {
    id: "prod-003",
    date: d(2, 9, 0),
    ingredients: { water: 3600, flour: 2000, butter: 650, sugar: 650, salt: 20, vanilla: 10, eggs: 990, flavor: 40 },
    totalCost: 301440,
    outputQty: 384,
    packCount: 32,
    costPerPack: 9420,
  },
  {
    id: "prod-004",
    date: d(3, 8, 0),
    ingredients: { water: 1800, flour: 1000, butter: 325, sugar: 325, salt: 10, vanilla: 5, eggs: 495, flavor: 20 },
    totalCost: 150720,
    outputQty: 192,
    packCount: 16,
    costPerPack: 9420,
  },
  {
    id: "prod-005",
    date: d(4, 9, 30),
    ingredients: { water: 1800, flour: 1000, butter: 325, sugar: 325, salt: 10, vanilla: 5, eggs: 495, flavor: 20 },
    totalCost: 150720,
    outputQty: 192,
    packCount: 16,
    costPerPack: 9420,
  },
  {
    id: "prod-006",
    date: d(5, 8, 0),
    ingredients: { water: 3600, flour: 2000, butter: 650, sugar: 650, salt: 20, vanilla: 10, eggs: 990, flavor: 40 },
    totalCost: 301440,
    outputQty: 384,
    packCount: 32,
    costPerPack: 9420,
  },
  {
    id: "prod-007",
    date: d(6, 7, 30),
    ingredients: { water: 1800, flour: 1000, butter: 325, sugar: 325, salt: 10, vanilla: 5, eggs: 495, flavor: 20 },
    totalCost: 150720,
    outputQty: 192,
    packCount: 16,
    costPerPack: 9420,
  },
];

export const transactions: Transaction[] = [
  { id: "tx-001", date: d(0, 10, 15), productId: "churros-pack", qty: 3,  priceEach: 25000, totalPrice: 75000,  costEach: 9420, totalCost: 28260, profit: 46740, voided: false, voidedAt: null },
  { id: "tx-002", date: d(0, 11, 30), productId: "churros-pack", qty: 2,  priceEach: 25000, totalPrice: 50000,  costEach: 9420, totalCost: 18840, profit: 31160, voided: false, voidedAt: null },
  { id: "tx-003", date: d(0, 13, 0),  productId: "churros-pack", qty: 5,  priceEach: 25000, totalPrice: 125000, costEach: 9420, totalCost: 47100, profit: 77900, voided: false, voidedAt: null },
  { id: "tx-004", date: d(0, 15, 45), productId: "churros-pack", qty: 1,  priceEach: 25000, totalPrice: 25000,  costEach: 9420, totalCost: 9420,  profit: 15580, voided: true,  voidedAt: d(0, 15, 50) },
  { id: "tx-005", date: d(0, 17, 0),  productId: "churros-pack", qty: 4,  priceEach: 25000, totalPrice: 100000, costEach: 9420, totalCost: 37680, profit: 62320, voided: false, voidedAt: null },
  { id: "tx-006", date: d(1, 10, 0),  productId: "churros-pack", qty: 6,  priceEach: 25000, totalPrice: 150000, costEach: 9420, totalCost: 56520, profit: 93480, voided: false, voidedAt: null },
  { id: "tx-007", date: d(1, 14, 30), productId: "churros-pack", qty: 3,  priceEach: 25000, totalPrice: 75000,  costEach: 9420, totalCost: 28260, profit: 46740, voided: false, voidedAt: null },
  { id: "tx-008", date: d(2, 11, 0),  productId: "churros-pack", qty: 8,  priceEach: 25000, totalPrice: 200000, costEach: 9420, totalCost: 75360, profit: 124640, voided: false, voidedAt: null },
  { id: "tx-009", date: d(2, 16, 0),  productId: "churros-pack", qty: 2,  priceEach: 25000, totalPrice: 50000,  costEach: 9420, totalCost: 18840, profit: 31160, voided: false, voidedAt: null },
  { id: "tx-010", date: d(3, 12, 0),  productId: "churros-pack", qty: 5,  priceEach: 25000, totalPrice: 125000, costEach: 9420, totalCost: 47100, profit: 77900, voided: false, voidedAt: null },
  { id: "tx-011", date: d(3, 15, 0),  productId: "churros-pack", qty: 3,  priceEach: 25000, totalPrice: 75000,  costEach: 9420, totalCost: 28260, profit: 46740, voided: false, voidedAt: null },
  { id: "tx-012", date: d(4, 9, 30),  productId: "churros-pack", qty: 4,  priceEach: 25000, totalPrice: 100000, costEach: 9420, totalCost: 37680, profit: 62320, voided: false, voidedAt: null },
  { id: "tx-013", date: d(4, 13, 0),  productId: "churros-pack", qty: 7,  priceEach: 25000, totalPrice: 175000, costEach: 9420, totalCost: 65940, profit: 109060, voided: false, voidedAt: null },
  { id: "tx-014", date: d(5, 11, 0),  productId: "churros-pack", qty: 5,  priceEach: 25000, totalPrice: 125000, costEach: 9420, totalCost: 47100, profit: 77900, voided: false, voidedAt: null },
  { id: "tx-015", date: d(5, 16, 30), productId: "churros-pack", qty: 3,  priceEach: 25000, totalPrice: 75000,  costEach: 9420, totalCost: 28260, profit: 46740, voided: false, voidedAt: null },
  { id: "tx-016", date: d(6, 10, 0),  productId: "churros-pack", qty: 6,  priceEach: 25000, totalPrice: 150000, costEach: 9420, totalCost: 56520, profit: 93480, voided: false, voidedAt: null },
  { id: "tx-017", date: d(6, 14, 0),  productId: "churros-pack", qty: 4,  priceEach: 25000, totalPrice: 100000, costEach: 9420, totalCost: 37680, profit: 62320, voided: false, voidedAt: null },
];

export const TODAY_STATS = {
  revenue: transactions.filter(t => !t.voided && new Date(t.date).toDateString() === new Date().toDateString()).reduce((s, t) => s + t.totalPrice, 0),
  profit: transactions.filter(t => !t.voided && new Date(t.date).toDateString() === new Date().toDateString()).reduce((s, t) => s + t.profit, 0),
  hpp: transactions.filter(t => !t.voided && new Date(t.date).toDateString() === new Date().toDateString()).reduce((s, t) => s + t.totalCost, 0),
  txCount: transactions.filter(t => !t.voided && new Date(t.date).toDateString() === new Date().toDateString()).length,
};

const dayLabel = (daysAgo: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - daysAgo);
  return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

export const REVENUE_SERIES = [
  { label: dayLabel(6), revenue: 250000, profit: 155800 },
  { label: dayLabel(5), revenue: 200000, profit: 124640 },
  { label: dayLabel(4), revenue: 275000, profit: 171380 },
  { label: dayLabel(3), revenue: 200000, profit: 124640 },
  { label: dayLabel(2), revenue: 250000, profit: 155800 },
  { label: dayLabel(1), revenue: 225000, profit: 140220 },
  { label: dayLabel(0), revenue: 350000, profit: 218120 },
];
