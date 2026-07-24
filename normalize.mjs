import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

async function run() {
  const snap = await db.collection("orders").get();
  const updates = [];
  
  for (const doc of snap.docs) {
    const data = doc.data();
    const updateData = {};
    let needsUpdate = false;
    
    if (!data.orderChannel) {
      updateData.orderChannel = "walkin";
      needsUpdate = true;
    }
    if (!data.paymentStatus) {
      updateData.paymentStatus = "belum_bayar";
      needsUpdate = true;
    }
    if (!data.status || data.status === "belum_selesai") {
      updateData.status = "pending";
      needsUpdate = true;
    }
    if (!data.createdAt) {
      updateData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      needsUpdate = true;
    }
    if (typeof data.createdAt === "string") {
      updateData.createdAt = new Date(data.createdAt);
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      updates.push({ ref: doc.ref, data: updateData });
    }
  }
  
  const batch = db.batch();
  let count = 0;
  for (const u of updates) {
    batch.update(u.ref, u.data);
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      console.log(`Committed ${count} updates`);
    }
  }
  if (count % 400 !== 0) {
    await batch.commit();
    console.log(`Committed remaining ${count % 400} updates`);
  }
  
  console.log(`Checked ${snap.size} orders, updated ${updates.length}`);
}

run().catch(console.error);
