import { config } from "dotenv";
config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });

const db = getFirestore(app);

async function run() {
  console.log("=== Migrasi: Backfill deliveryMethod pada order WhatsApp ===");
  console.log("Target: semua order dengan orderChannel='whatsapp' yang belum memiliki field deliveryMethod.\n");

  let processed = 0;
  let skipped = 0;
  let updated = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  // Paginate through all WhatsApp orders
  while (true) {
    let query = db
      .collection("orders")
      .where("orderChannel", "==", "whatsapp")
      .limit(100) as FirebaseFirestore.Query;


    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      processed++;
      const data = doc.data();

      // Skip if deliveryMethod already set
      if (data.deliveryMethod !== undefined && data.deliveryMethod !== null) {
        skipped++;
        continue;
      }

      // Default to "courier" — the old system only ever used courier for WhatsApp
      batch.update(doc.ref, { deliveryMethod: "courier" });
      batchCount++;
      updated++;
      console.log(`  [Update] ${doc.id} — ${data.orderNumber ?? "??"} (ongkir: ${data.shippingCost ?? 0})`);
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];

    if (snap.docs.length < 100) break;
  }

  console.log("\n=== Hasil Migrasi ===");
  console.log(`Total diproses : ${processed}`);
  console.log(`Diperbarui     : ${updated}`);
  console.log(`Dilewati       : ${skipped} (sudah ada deliveryMethod)`);
  console.log("\nMigrasi selesai!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migrasi gagal:", err);
  process.exit(1);
});
