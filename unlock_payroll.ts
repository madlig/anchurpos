import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { adminDb } from "./lib/firebase-admin";

async function unlockAllPayroll() {
  const snap = await adminDb.collection("payroll").where("isLocked", "==", true).get();
  
  if (snap.empty) {
    console.log("No locked payroll found.");
    return;
  }

  const batch = adminDb.batch();
  let count = 0;

  snap.docs.forEach(doc => {
    batch.update(doc.ref, {
      isLocked: false,
      paidAt: null
    });
    count++;
  });

  await batch.commit();
  console.log(`Successfully unlocked ${count} payroll records.`);
}

unlockAllPayroll().catch(console.error);
