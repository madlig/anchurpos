import { adminDb } from "@/lib/firebase-admin";
import type * as admin from "firebase-admin";

export async function getLatestIngredientCosts(ingredientIds: string[], transaction?: admin.firestore.Transaction): Promise<Record<string, number>> {
  if (ingredientIds.length === 0) return {};

  const costs: Record<string, number> = {};
  
  // To avoid N+1 query and since Firestore doesn't have a simple way to do 
  // "latest per group" in one query, we can either query expenses for each ID
  // or fetch the last X expenses and map them. Doing it per ID is safest for accuracy,
  // but we run them in parallel to avoid sequential blocking.
  await Promise.all(
    ingredientIds.map(async (id) => {
      const ref = adminDb.collection("ingredients").doc(id);
      const snap = transaction ? await transaction.get(ref) : await ref.get();
      if (snap.exists) {
        costs[id] = snap.data()?.defaultCostPerBaseUnit ?? 0;
      } else {
        costs[id] = 0;
      }
    })
  );

  return costs;
}

export async function calculateProductHPP(
  productId: string,
  variantId: string,
  packPerBatch: number,
  ingredientCosts?: Record<string, number>,
  transaction?: admin.firestore.Transaction
): Promise<number> {
  if (!packPerBatch || packPerBatch <= 0) packPerBatch = 1;

  const query = adminDb
    .collection("recipes")
    .where("productId", "==", productId)
    .where("variantId", "in", ["all", variantId]);

  const recipesSnap = transaction ? await transaction.get(query) : await query.get();

  const neededIngredientIds = [...new Set(recipesSnap.docs.map(d => d.data().ingredientId))];
  const costs = ingredientCosts ?? await getLatestIngredientCosts(neededIngredientIds, transaction);

  let totalBatchCost = 0;
  for (const doc of recipesSnap.docs) {
    const data = doc.data();
    const qty = data.qtyPerBatch || 0;
    const costPerUnit = costs[data.ingredientId] || 0;
    totalBatchCost += qty * costPerUnit;
  }
  
  return totalBatchCost / packPerBatch;
}
