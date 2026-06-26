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

const NEW_INGREDIENTS = [
  {
    id: "glaze-coklat-bulk",
    name: "Glaze Coklat (Bulk)",
    category: "bahan_baku",
    baseUnit: "gram",
    currentStock: 5000,
    minStock: 1000,
    unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "glaze-greentea-bulk",
    name: "Glaze Green Tea (Bulk)",
    category: "bahan_baku",
    baseUnit: "gram",
    currentStock: 5000,
    minStock: 1000,
    unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "glaze-keju-bulk",
    name: "Glaze Keju (Bulk)",
    category: "bahan_baku",
    baseUnit: "gram",
    currentStock: 5000,
    minStock: 1000,
    unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "glaze-vanilla-bulk",
    name: "Glaze Vanilla (Bulk)",
    category: "bahan_baku",
    baseUnit: "gram",
    currentStock: 5000,
    minStock: 1000,
    unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "glaze-tiramisu-bulk",
    name: "Glaze Tiramisu (Bulk)",
    category: "bahan_baku",
    baseUnit: "gram",
    currentStock: 5000,
    minStock: 1000,
    unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "bubuk-kayu-manis",
    name: "Kayu Manis Bubuk",
    category: "bahan_baku",
    baseUnit: "gram",
    currentStock: 1000,
    minStock: 200,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
];

async function run() {
  console.log("Menjalankan migrasi bahan baku baru...");
  for (const ing of NEW_INGREDIENTS) {
    const { id, ...data } = ing;
    const ref = db.doc(`ingredients/${id}`);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        ...data,
        createdAt: new Date(),
      });
      console.log(`  [Baru] Berhasil membuat bahan baku: ${ing.name}`);
    } else {
      console.log(`  [Lewati] Bahan baku ${ing.name} sudah ada.`);
    }
  }
  console.log("Migrasi selesai!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migrasi gagal:", err);
  process.exit(1);
});
