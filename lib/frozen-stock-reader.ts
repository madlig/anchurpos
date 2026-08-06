import { adminDb } from "./firebase-admin";

export async function getFrozenStocks(): Promise<{ [variantId: string]: number }> {
  try {
    const snap = await adminDb.collection("frozenStocks").get();
    const stocks: { [variantId: string]: number } = {};
    snap.forEach(doc => {
      stocks[doc.id] = doc.data().qty || 0;
    });
    return stocks;
  } catch (err) {
    console.error("Error reading frozenStocks:", err);
    return {};
  }
}

export async function getTotalFrozenTrays(): Promise<number> {
  const stocks = await getFrozenStocks();
  return Object.values(stocks).reduce((sum, qty) => sum + qty, 0);
}
