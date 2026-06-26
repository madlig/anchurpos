import { config } from "dotenv";
config({ path: ".env.local" });

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);
const auth = getAuth(app);

// ============================================================
// 1. USERS
// ============================================================
const USERS = [
  { username: "owner", name: "Owner Anchur", role: "owner", password: "anchur123" },
  { username: "manager", name: "Manager Anchur", role: "manager", password: "anchur123" },
  { username: "crew1", name: "Budi (Crew)", role: "crew", password: "anchur123" },
];

async function seedUsers() {
  console.log("\n=== Seeding Users ===");
  for (const u of USERS) {
    const email = `${u.username}@anchur.internal`;
    try {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
        console.log(`  [skip] ${email} sudah ada (uid: ${userRecord.uid})`);
      } catch {
        userRecord = await auth.createUser({
          email,
          password: u.password,
          displayName: u.name,
        });
        console.log(`  [created] ${email} (uid: ${userRecord.uid})`);
      }

      await auth.setCustomUserClaims(userRecord.uid, { role: u.role });

      await db.doc(`users/${userRecord.uid}`).set({
        name: u.name,
        email,
        role: u.role,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      console.log(`  [claims] ${u.role} set for ${u.username}`);
    } catch (err) {
      console.error(`  [error] ${email}:`, err);
    }
  }
}

// ============================================================
// 2. PRODUCTS + PRICE TIERS
// ============================================================
const PRODUCTS = [
  {
    id: "churros-frozen-regular",
    code: "CFR",
    name: "Churros Frozen Regular",
    description: "Pack isi 12 pcs churros frozen",
    packPerBatch: 16,
    priceTiers: [
      { id: "tier-1", minQty: 1, maxQty: 10, price: 15000 },
      { id: "tier-2", minQty: 11, maxQty: 24, price: 14000 },
      { id: "tier-3", minQty: 25, maxQty: null, price: 13000 },
    ],
  },
  {
    id: "churros-frozen-full",
    code: "CFF",
    name: "Churros Frozen Full",
    description: "Pack isi 16 pcs churros frozen",
    packPerBatch: 12,
    priceTiers: [
      { id: "tier-1", minQty: 1, maxQty: 10, price: 20000 },
      { id: "tier-2", minQty: 11, maxQty: 24, price: 18500 },
      { id: "tier-3", minQty: 25, maxQty: null, price: 17000 },
    ],
  },
  {
    id: "churros-frozen-tiktok",
    code: "CFT",
    name: "Churros Frozen TikTok",
    description: "Pack kecil isi 6 pcs untuk TikTok Shop",
    packPerBatch: 32,
    priceTiers: [
      { id: "tier-1", minQty: 1, maxQty: 20, price: 8500 },
      { id: "tier-2", minQty: 21, maxQty: null, price: 7500 },
    ],
  },
  {
    id: "churros-matang",
    code: "CM",
    name: "Churros Matang",
    description: "Churros siap makan (goreng)",
    packPerBatch: 16,
    priceTiers: [
      { id: "tier-1", minQty: 1, maxQty: 10, price: 25000 },
      { id: "tier-2", minQty: 11, maxQty: null, price: 23000 },
    ],
  },
  {
    id: "churros-rainbow",
    code: "CRB",
    name: "Churros Rainbow",
    description: "Paket campuran 6 varian (assembly manual)",
    packPerBatch: 1,
    priceTiers: [
      { id: "tier-1", minQty: 1, maxQty: 5, price: 95000 },
      { id: "tier-2", minQty: 6, maxQty: null, price: 88000 },
    ],
  },
];

async function seedProducts() {
  console.log("\n=== Seeding Products ===");
  for (const p of PRODUCTS) {
    const { id, priceTiers, ...productData } = p;
    await db.doc(`products/${id}`).set({
      ...productData,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`  [product] ${p.name}`);

    for (const tier of priceTiers) {
      await db.doc(`products/${id}/priceTiers/${tier.id}`).set({
        minQty: tier.minQty,
        maxQty: tier.maxQty,
        price: tier.price,
      }, { merge: true });
    }
    console.log(`    ${priceTiers.length} price tiers`);
  }
}

// ============================================================
// 3. VARIANTS
// ============================================================
const VARIANTS = [
  { id: "original", name: "Original", isProductionVariant: true, sortOrder: 1 },
  { id: "charcoal", name: "Charcoal", isProductionVariant: true, sortOrder: 2 },
  { id: "red-velvet", name: "Red Velvet", isProductionVariant: true, sortOrder: 3 },
  { id: "taro", name: "Taro", isProductionVariant: true, sortOrder: 4 },
  { id: "coklat", name: "Coklat", isProductionVariant: true, sortOrder: 5 },
  { id: "greentea", name: "Green Tea", isProductionVariant: true, sortOrder: 6 },
  { id: "rainbow", name: "Rainbow", isProductionVariant: false, sortOrder: 7 },
];

async function seedVariants() {
  console.log("\n=== Seeding Variants ===");
  for (const v of VARIANTS) {
    const { id, ...data } = v;
    await db.doc(`variants/${id}`).set(data, { merge: true });
    console.log(`  [variant] ${v.name}`);
  }
}

// ============================================================
// 4. INGREDIENTS
// ============================================================
const INGREDIENTS = [
  {
    id: "tepung-terigu",
    name: "Tepung Terigu",
    category: "bahan_baku",
    baseUnit: "gram",
    currentStock: 5000,
    minStock: 2000,
    unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "mentega",
    name: "Mentega",
    category: "bahan_baku",
    baseUnit: "gram",
    currentStock: 3000,
    minStock: 1000,
    unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "telur",
    name: "Telur",
    category: "bahan_baku",
    baseUnit: "butir",
    currentStock: 60,
    minStock: 30,
    unitAlternatives: [{ unit: "tray", conversionToBase: 30 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "gula-pasir",
    name: "Gula Pasir",
    category: "bahan_baku",
    baseUnit: "gram",
    currentStock: 2000,
    minStock: 500,
    unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "garam",
    name: "Garam",
    category: "bahan_baku",
    baseUnit: "gram",
    currentStock: 1000,
    minStock: 200,
    unitAlternatives: [{ unit: "kg", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "air",
    name: "Air",
    category: "bahan_baku",
    baseUnit: "ml",
    currentStock: 10000,
    minStock: 2000,
    unitAlternatives: [{ unit: "liter", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "minyak-goreng",
    name: "Minyak Goreng",
    category: "bahan_baku",
    baseUnit: "ml",
    currentStock: 5000,
    minStock: 2000,
    unitAlternatives: [{ unit: "liter", conversionToBase: 1000 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "perasa-original",
    name: "Perasa Original",
    category: "bahan_baku",
    baseUnit: "ml",
    currentStock: 600,
    minStock: 150,
    unitAlternatives: [{ unit: "liter", conversionToBase: 1000 }],
    opnameMethod: "packaged",
    packagedConfig: {
      unitPerPackage: 300,
      packageLabel: "botol",
      fullnessOptions: [
        { label: "Penuh", ratio: 1.0 },
        { label: "Setengah", ratio: 0.5 },
        { label: "Hampir Habis", ratio: 0.15 },
        { label: "Kosong", ratio: 0 },
      ],
    },
  },
  {
    id: "perasa-charcoal",
    name: "Perasa Charcoal",
    category: "bahan_baku",
    baseUnit: "ml",
    currentStock: 450,
    minStock: 150,
    unitAlternatives: [{ unit: "liter", conversionToBase: 1000 }],
    opnameMethod: "packaged",
    packagedConfig: {
      unitPerPackage: 300,
      packageLabel: "botol",
      fullnessOptions: [
        { label: "Penuh", ratio: 1.0 },
        { label: "Setengah", ratio: 0.5 },
        { label: "Hampir Habis", ratio: 0.15 },
        { label: "Kosong", ratio: 0 },
      ],
    },
  },
  {
    id: "perasa-red-velvet",
    name: "Perasa Red Velvet",
    category: "bahan_baku",
    baseUnit: "ml",
    currentStock: 300,
    minStock: 150,
    unitAlternatives: [{ unit: "liter", conversionToBase: 1000 }],
    opnameMethod: "packaged",
    packagedConfig: {
      unitPerPackage: 300,
      packageLabel: "botol",
      fullnessOptions: [
        { label: "Penuh", ratio: 1.0 },
        { label: "Setengah", ratio: 0.5 },
        { label: "Hampir Habis", ratio: 0.15 },
        { label: "Kosong", ratio: 0 },
      ],
    },
  },
  {
    id: "perasa-taro",
    name: "Perasa Taro",
    category: "bahan_baku",
    baseUnit: "ml",
    currentStock: 500,
    minStock: 150,
    unitAlternatives: [{ unit: "liter", conversionToBase: 1000 }],
    opnameMethod: "packaged",
    packagedConfig: {
      unitPerPackage: 300,
      packageLabel: "botol",
      fullnessOptions: [
        { label: "Penuh", ratio: 1.0 },
        { label: "Setengah", ratio: 0.5 },
        { label: "Hampir Habis", ratio: 0.15 },
        { label: "Kosong", ratio: 0 },
      ],
    },
  },
  {
    id: "perasa-coklat",
    name: "Perasa Coklat",
    category: "bahan_baku",
    baseUnit: "ml",
    currentStock: 400,
    minStock: 150,
    unitAlternatives: [{ unit: "liter", conversionToBase: 1000 }],
    opnameMethod: "packaged",
    packagedConfig: {
      unitPerPackage: 300,
      packageLabel: "botol",
      fullnessOptions: [
        { label: "Penuh", ratio: 1.0 },
        { label: "Setengah", ratio: 0.5 },
        { label: "Hampir Habis", ratio: 0.15 },
        { label: "Kosong", ratio: 0 },
      ],
    },
  },
  {
    id: "perasa-greentea",
    name: "Perasa Green Tea",
    category: "bahan_baku",
    baseUnit: "ml",
    currentStock: 350,
    minStock: 150,
    unitAlternatives: [{ unit: "liter", conversionToBase: 1000 }],
    opnameMethod: "packaged",
    packagedConfig: {
      unitPerPackage: 300,
      packageLabel: "botol",
      fullnessOptions: [
        { label: "Penuh", ratio: 1.0 },
        { label: "Setengah", ratio: 0.5 },
        { label: "Hampir Habis", ratio: 0.15 },
        { label: "Kosong", ratio: 0 },
      ],
    },
  },
  {
    id: "plastik-regular",
    name: "Plastik Packaging Regular",
    category: "packaging",
    baseUnit: "pcs",
    currentStock: 200,
    minStock: 50,
    unitAlternatives: [{ unit: "pak (50)", conversionToBase: 50 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "plastik-full",
    name: "Plastik Packaging Full",
    category: "packaging",
    baseUnit: "pcs",
    currentStock: 150,
    minStock: 50,
    unitAlternatives: [{ unit: "pak (50)", conversionToBase: 50 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "stiker-label",
    name: "Stiker Label",
    category: "packaging",
    baseUnit: "lembar",
    currentStock: 500,
    minStock: 100,
    unitAlternatives: [{ unit: "roll (100)", conversionToBase: 100 }],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "gula-halus-cinnamon",
    name: "Gula Halus Cinnamon",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 100,
    minStock: 20,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
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
  {
    id: "saus-coklat",
    name: "Saus Glaze Coklat",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 50,
    minStock: 10,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "saus-greentea",
    name: "Saus Glaze Green Tea",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 50,
    minStock: 10,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "saus-keju",
    name: "Saus Glaze Keju",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 50,
    minStock: 10,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "saus-vanilla",
    name: "Saus Glaze Vanilla",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 50,
    minStock: 10,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "saus-tiramisu",
    name: "Saus Glaze Tiramisu",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 50,
    minStock: 10,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "saus-coklat-tiktok",
    name: "Saus Glaze Coklat (TikTok)",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 50,
    minStock: 10,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "saus-greentea-tiktok",
    name: "Saus Glaze Green Tea (TikTok)",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 50,
    minStock: 10,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "saus-keju-tiktok",
    name: "Saus Glaze Keju (TikTok)",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 50,
    minStock: 10,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "saus-vanilla-tiktok",
    name: "Saus Glaze Vanilla (TikTok)",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 50,
    minStock: 10,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
  {
    id: "saus-tiramisu-tiktok",
    name: "Saus Glaze Tiramisu (TikTok)",
    category: "add_on",
    baseUnit: "pcs",
    currentStock: 50,
    minStock: 10,
    unitAlternatives: [],
    opnameMethod: "direct",
    packagedConfig: null,
  },
];

async function seedIngredients() {
  console.log("\n=== Seeding Ingredients ===");
  for (const ing of INGREDIENTS) {
    const { id, ...data } = ing;
    await db.doc(`ingredients/${id}`).set(data, { merge: true });
    console.log(`  [ingredient] ${ing.name} (${ing.currentStock} ${ing.baseUnit})`);
  }
}

// ============================================================
// 5. RECIPES (per batch base + variant-specific)
// ============================================================
const RECIPES = [
  { id: "base-tepung", productId: "churros-frozen-regular", variantId: "all", ingredientId: "tepung-terigu", qtyPerBatch: 500, unit: "gram" },
  { id: "base-mentega", productId: "churros-frozen-regular", variantId: "all", ingredientId: "mentega", qtyPerBatch: 250, unit: "gram" },
  { id: "base-telur", productId: "churros-frozen-regular", variantId: "all", ingredientId: "telur", qtyPerBatch: 6, unit: "butir" },
  { id: "base-gula", productId: "churros-frozen-regular", variantId: "all", ingredientId: "gula-pasir", qtyPerBatch: 50, unit: "gram" },
  { id: "base-garam", productId: "churros-frozen-regular", variantId: "all", ingredientId: "garam", qtyPerBatch: 5, unit: "gram" },
  { id: "base-air", productId: "churros-frozen-regular", variantId: "all", ingredientId: "air", qtyPerBatch: 500, unit: "ml" },
  { id: "var-original", productId: "churros-frozen-regular", variantId: "original", ingredientId: "perasa-original", qtyPerBatch: 30, unit: "ml" },
  { id: "var-charcoal", productId: "churros-frozen-regular", variantId: "charcoal", ingredientId: "perasa-charcoal", qtyPerBatch: 30, unit: "ml" },
  { id: "var-red-velvet", productId: "churros-frozen-regular", variantId: "red-velvet", ingredientId: "perasa-red-velvet", qtyPerBatch: 30, unit: "ml" },
  { id: "var-taro", productId: "churros-frozen-regular", variantId: "taro", ingredientId: "perasa-taro", qtyPerBatch: 30, unit: "ml" },
  { id: "var-coklat", productId: "churros-frozen-regular", variantId: "coklat", ingredientId: "perasa-coklat", qtyPerBatch: 30, unit: "ml" },
  { id: "var-greentea", productId: "churros-frozen-regular", variantId: "greentea", ingredientId: "perasa-greentea", qtyPerBatch: 30, unit: "ml" },
  { id: "pkg-plastik-reg", productId: "churros-frozen-regular", variantId: "all", ingredientId: "plastik-regular", qtyPerBatch: 16, unit: "pcs" },
  { id: "pkg-stiker-reg", productId: "churros-frozen-regular", variantId: "all", ingredientId: "stiker-label", qtyPerBatch: 16, unit: "lembar" },
];

async function seedRecipes() {
  console.log("\n=== Seeding Recipes ===");
  for (const r of RECIPES) {
    const { id, ...data } = r;
    await db.doc(`recipes/${id}`).set(data, { merge: true });
  }
  console.log(`  [recipes] ${RECIPES.length} entries`);
}

// ============================================================
// 6. CUSTOMERS (sample)
// ============================================================
const CUSTOMERS = [
  {
    id: "cust-deu-coffee",
    name: "Deu Coffee - Dago",
    channel: "b2b",
    phoneNumber: "08123456789",
    address: "Jl. Ir. H. Juanda No. 123, Dago, Bandung",
    discountPerUnit: 1000,
    notes: "Langganan mingguan",
    isActive: true,
    createdVia: "manual",
  },
  {
    id: "cust-kopi-kenangan",
    name: "Kopi Kenangan - Braga",
    channel: "b2b",
    phoneNumber: "08198765432",
    address: "Jl. Braga No. 45, Bandung",
    discountPerUnit: 500,
    notes: "",
    isActive: true,
    createdVia: "manual",
  },
  {
    id: "cust-walk-in",
    name: "Walk-in Umum",
    channel: "walk_in",
    phoneNumber: null,
    address: null,
    discountPerUnit: 0,
    notes: "Pelanggan umum tanpa diskon",
    isActive: true,
    createdVia: "manual",
  },
  {
    id: "cust-reseller-ani",
    name: "Ani (Reseller)",
    channel: "reseller",
    phoneNumber: "08567891234",
    address: "Jl. Cibaduyut No. 88, Bandung",
    discountPerUnit: 2000,
    notes: "Reseller area Cibaduyut",
    isActive: true,
    createdVia: "manual",
  },
];

async function seedCustomers() {
  console.log("\n=== Seeding Customers ===");
  for (const c of CUSTOMERS) {
    const { id, ...data } = c;
    await db.doc(`customers/${id}`).set(data, { merge: true });
    console.log(`  [customer] ${c.name}`);
  }
}

// ============================================================
// 7. SETTINGS
// ============================================================
async function seedSettings() {
  console.log("\n=== Seeding Settings ===");

  await db.doc("settings/attendanceConfig").set({
    whitelistedIps: ["127.0.0.1"],
    lastDetectedIp: null,
    lastDetectedAt: null,
    updatedBy: "seed",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log("  [settings] attendanceConfig");

  await db.doc("settings/businessInfo").set({
    businessName: "Anchur",
    logoUrl: "",
    bankAccounts: [
      { bankName: "BCA", accountNumber: "6395479567", accountHolder: "Anindya Azzahra" },
    ],
    invoiceFooterNote: "Jangan lupa kirimkan bukti transfer agar pesanan bisa langsung diproses",
    updatedBy: "seed",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log("  [settings] businessInfo");
}

// ============================================================
// 9. PRODUCT STOCKS
// ============================================================
const PRODUCT_STOCKS = [
  { id: "churros-frozen-regular_original", productId: "churros-frozen-regular", variantId: "original", currentStock: 76, minStock: 10 },
  { id: "churros-frozen-regular_charcoal", productId: "churros-frozen-regular", variantId: "charcoal", currentStock: 17, minStock: 10 },
  { id: "churros-frozen-regular_red-velvet", productId: "churros-frozen-regular", variantId: "red-velvet", currentStock: 5, minStock: 10 },
  { id: "churros-frozen-regular_taro", productId: "churros-frozen-regular", variantId: "taro", currentStock: 14, minStock: 10 },
  { id: "churros-frozen-regular_coklat", productId: "churros-frozen-regular", variantId: "coklat", currentStock: 42, minStock: 10 },
  { id: "churros-frozen-regular_greentea", productId: "churros-frozen-regular", variantId: "greentea", currentStock: 45, minStock: 10 },
  { id: "churros-frozen-full_original", productId: "churros-frozen-full", variantId: "original", currentStock: 0, minStock: 10 },
  { id: "churros-frozen-tiktok_original", productId: "churros-frozen-tiktok", variantId: "original", currentStock: 0, minStock: 10 },
];

async function seedProductStocks() {
  console.log("\n=== Seeding Product Stocks ===");
  for (const ps of PRODUCT_STOCKS) {
    const { id, ...data } = ps;
    await db.doc(`productStocks/${id}`).set(data, { merge: true });
    console.log(`  [productStock] ${ps.productId} / ${ps.variantId}`);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("AnchurPOS Seed Script");
  console.log(`Project: ${process.env.FIREBASE_PROJECT_ID}`);

  await seedUsers();
  await seedProducts();
  await seedVariants();
  await seedProductStocks();
  await seedIngredients();
  await seedRecipes();
  await seedCustomers();
  await seedSettings();

  console.log("\nSeed selesai!");
  console.log("\nLogin credentials:");
  console.log("  Owner:   username=owner   password=anchur123");
  console.log("  Manager: username=manager password=anchur123");
  console.log("  Crew:    username=crew1   password=anchur123");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed gagal:", err);
  process.exit(1);
});
