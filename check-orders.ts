import { adminDb } from "./lib/firebase-admin";

async function check() {
  const snap = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(5).get();
  snap.forEach(doc => {
    console.log("Order ID:", doc.id);
    console.log(doc.data());
  });
}
check();
