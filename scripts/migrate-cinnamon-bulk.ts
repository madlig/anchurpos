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

const NEW_INGREDIENT = {
  id: "gula-cinnamon-bulk",
  name: "Gula Cinnamon Curah (Toples)",
  category: "bahan_baku",
  baseUnit: "gram",
  currentStock: 0,
  minStock: 0,
  unitAlternatives: [],
  opnameMethod: "direct",
  packagedConfig: null,
};

async function run() {
  console.log("Menjalankan migrasi bahan curah gula cinnamon...");
  const { id, ...data } = NEW_INGREDIENT;
  const ref = db.doc(`ingredients/${id}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      ...data,
      createdAt: new Date(),
    });
    console.log(`  [Baru] Berhasil membuat bahan baku curah: ${NEW_INGREDIENT.name}`);
  } else {
    console.log(`  [Lewati] Bahan baku curah ${NEW_INGREDIENT.name} sudah ada.`);
  }
  console.log("Migrasi selesai!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migrasi gagal:", err);
  process.exit(1);
});
