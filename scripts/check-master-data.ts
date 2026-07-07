import { config } from "dotenv";
config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = getApps().length > 0 ? getApps()[0] : initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);

async function run() {
  // Products
  const productsSnap = await db.collection("products").get();
  console.log("=== PRODUCTS ===");
  for (const doc of productsSnap.docs) {
    const d = doc.data();
    const tiersSnap = await db.collection(`products/${doc.id}/priceTiers`).orderBy("minQty").get();
    const tiers = tiersSnap.docs.map(t => `min${t.data().minQty}-max${t.data().maxQty ?? "inf"}: Rp${t.data().price}`);
    console.log(`  [${d.isActive ? "AKTIF" : "nonaktif"}] ${doc.id} | ${d.name}`);
    console.log(`    Tiers: ${tiers.join(" | ") || "TIDAK ADA"}`);
  }

  // Variants
  const variantsSnap = await db.collection("variants").orderBy("sortOrder").get();
  console.log("\n=== VARIANTS ===");
  variantsSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  [sort:${d.sortOrder}] ${doc.id} | name: "${d.name}" | stok: ${d.currentStock} | min: ${d.minStock}`);
  });

  // AddOns (Saus)
  const addonsSnap = await db.collection("addOns").get();
  console.log("\n=== ADD-ONS / SAUS ===");
  addonsSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${doc.id} | name: "${d.name}" | stok: ${d.currentStock ?? "-"} | active: ${d.isActive ?? true}`);
  });

  // productStocks
  console.log("\n=== PRODUCT STOCKS ===");
  const stocksSnap = await db.collection("productStocks").get();
  stocksSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${doc.id} | ${d.productName ?? "?"} / ${d.variantName ?? "?"} | stok: ${d.currentStock}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
