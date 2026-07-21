import { adminDb } from "@/lib/firebase-admin";

export async function getLatestIngredientCosts(ingredientIds: string[]): Promise<Record<string, number>> {
  if (ingredientIds.length === 0) return {};

  const costs: Record<string, number> = {};
  
  // To avoid N+1 query and since Firestore doesn't have a simple way to do 
  // "latest per group" in one query, we can either query expenses for each ID
  // or fetch the last X expenses and map them. Doing it per ID is safest for accuracy,
  // but we run them in parallel to avoid sequential blocking.
  await Promise.all(
    ingredientIds.map(async (id) => {
      const snap = await adminDb
        .collection("expenses")
        .where("ingredientId", "==", id)
        .orderBy("date", "desc")
        .limit(1)
        .get();
        
      if (!snap.empty) {
        costs[id] = snap.docs[0].data().pricePerBaseUnit ?? 0;
      } else {
        costs[id] = 0; // fallback if no expense history
      }
    })
  );

  return costs;
}

export async function calculateProductHPP(
  productId: string,
  variantId: string,
  packPerBatch: number,
  ingredientCosts?: Record<string, number>
): Promise<number> {
  if (!packPerBatch || packPerBatch <= 0) packPerBatch = 1;

  const recipesSnap = await adminDb
    .collection("recipes")
    .where("productId", "==", productId)
    .where("variantId", "in", ["all", variantId])
    .get();

  const neededIngredientIds = [...new Set(recipesSnap.docs.map(d => d.data().ingredientId))];
  const costs = ingredientCosts ?? await getLatestIngredientCosts(neededIngredientIds);

  let totalBatchCost = 0;
  for (const doc of recipesSnap.docs) {
    const data = doc.data();
    const qty = data.qtyPerBatch || 0;
    const costPerUnit = costs[data.ingredientId] || 0;
    totalBatchCost += qty * costPerUnit;
  }
  
  return totalBatchCost / packPerBatch;
}
