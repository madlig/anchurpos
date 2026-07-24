import { adminDb } from "../lib/firebase-admin";

async function run() {
  const products = await adminDb.collection("products").get();
  const batch = adminDb.batch();
  let count = 0;
  
  for (const doc of products.docs) {
    const data = doc.data();
    if (data.name.toLowerCase().includes("churros")) {
      batch.update(doc.ref, { freeSauceAllowance: 2 });
      count++;
    }
  }

  const variants = await adminDb.collection("variants").get();
  for (const doc of variants.docs) {
    const data = doc.data();
    if (data.name.toLowerCase().includes("full")) {
      batch.update(doc.ref, { freeSauceAllowance: 0 });
      count++;
    }
  }
  
  await batch.commit();
  console.log(`Updated ${count} records with freeSauceAllowance`);
}

run().catch(console.error);
