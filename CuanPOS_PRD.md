# CuanPOS — Product Requirements Document
> Version 1.0 | Status: Draft | Platform: PWA

---

## 1. Overview

**CuanPOS** adalah Progressive Web App (PWA) POS ringan untuk bisnis churros skala kecil. Fokus utama: pencatatan produksi → stok → penjualan secara end-to-end dengan kalkulasi HPP (Harga Pokok Produksi) otomatis.

**Problem:** UMKM churros mencatat produksi dan penjualan secara manual, rawan human error, tidak real-time, dan tidak bisa menghitung profit aktual per transaksi.

**Target User:**
| User | Peran |
|------|-------|
| Owner | Input produksi, POS harian, lihat laporan |
| Partner/Admin | Monitoring dashboard, setup awal |

**Non-Goals (MVP):** Multi-outlet, manajemen kasir/role, payment gateway, loyalitas pelanggan, SaaS.

---

## 2. Requirements

### Functional
- Autentikasi email/password dengan session persist
- CRUD bahan baku (materials) dinamis
- CRUD produk (finished goods) dinamis
- Input batch produksi dengan kalkulasi HPP otomatis
- POS checkout minimal tap
- Dashboard ringkasan harian (revenue, HPP, profit)
- Laporan harian/weekly/monthly dengan grafik
- Export laporan ke Excel (.xlsx) dan PDF
- Void transaksi dengan audit trail
- Edit resep default untuk pre-fill form produksi

### Non-Functional
- PWA installable di HP (Add to Home Screen)
- Offline mode: data yang sudah dimuat tetap bisa dilihat
- Mobile-first UI: bottom nav, large buttons, minimal typing
- Transaksi kritikal menggunakan atomic Firestore batch write

---

## 3. Core Features

| ID | Feature | Prioritas |
|----|---------|-----------|
| F1 | Autentikasi (email/password) | P0 |
| F2 | Manajemen Bahan Baku | P0 |
| F3 | Manajemen Produk | P0 |
| F4 | Input Batch Produksi + Kalkulasi HPP | P0 |
| F5 | POS / Checkout | P0 |
| F6 | Dashboard harian | P0 |
| F7 | Laporan + Grafik | P1 |
| F8 | Export Excel & PDF | P1 |
| F9 | PWA + Offline Mode | P1 |

---

## 4. User Flow

### Navigation Structure
```
Bottom Nav: Dashboard | Produksi | POS (center) | Inventori | Laporan
```

### Screen Map
| ID | Screen | Route |
|----|--------|-------|
| S01 | Login | /login |
| S02 | Dashboard | / |
| S03 | Production List | /production |
| S04 | New Batch Form | /production/new |
| S05 | Batch Detail | /production/:id |
| S06 | POS / Checkout | /pos |
| S07 | Sale Confirmation | /pos/confirm |
| S08 | Materials List | /inventory |
| S09 | Material Form (New/Adjust) | /inventory/material/:id? |
| S10 | Products List | /inventory/product |
| S14 | Product Form (New/Edit) | /inventory/product/:id? |
| S15 | Edit Resep Default | /inventory/recipe |
| S12 | Reports | /reports |
| S16 | Transaction Detail + Void | /reports/:id |

### Key Flows

**Production Flow:**
```
S03 (List) → [+] → S04 (Form: pre-fill dari recipe)
→ live kalkulasi HPP → validasi stok → Save
→ atomic write: stok bahan berkurang, stok pack bertambah
→ kembali ke S03
```

**POS Flow:**
```
S06 (pilih qty, preview harga/HPP/profit)
→ [Charge] → S07 (konfirmasi summary)
→ atomic write: stok pack berkurang, transaksi tersimpan
→ kembali ke S06
```

**Inventory Flow:**
```
S08 (Materials List)
├── Tap item → S09 mode Adjust Stock
└── [+] → S09 mode New Material

S10 (Products List)
├── Tap item → S14 mode Edit
├── [+] → S14 mode New Product
└── [Edit Resep] → S15
```

**Void Flow:**
```
S12 (Reports) → tap transaksi → S16 (Detail)
→ [Void] → konfirmasi dialog
→ atomic write: voided=true, stok pack dikembalikan
```

---

## 5. Architecture

### Tech Stack
| Layer | Teknologi |
|-------|-----------|
| Framework | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand (UI/auth) + TanStack Query v5 (server state) |
| Form | React Hook Form + Zod |
| Database | Firestore (real-time + offline persistence) |
| Auth | Firebase Auth (email/password) |
| Hosting | Firebase Hosting |
| PWA | vite-plugin-pwa (Workbox) |
| Charts | Recharts |
| Export | SheetJS (xlsx) + jsPDF + jspdf-autotable |

### Folder Structure
```
src/
├── components/
│   ├── ui/           # shadcn/ui base components
│   ├── layout/       # BottomNav, PageWrapper, Header
│   └── shared/       # Card, Badge, ConfirmDialog
├── features/
│   ├── auth/         # LoginPage, useAuth
│   ├── dashboard/    # DashboardPage, useDashboard
│   ├── production/   # ProductionListPage, NewBatchPage, BatchDetailPage
│   ├── pos/          # POSPage, SaleConfirmPage, usePOS
│   ├── inventory/    # MaterialsListPage, MaterialFormPage,
│   │                 # ProductsListPage, ProductFormPage, EditRecipePage
│   └── reports/      # ReportsPage, TransactionDetailPage
├── lib/
│   ├── firebase.ts   # Firebase init
│   ├── firestore.ts  # CRUD helpers
│   └── utils.ts      # formatRupiah, formatDate
├── stores/
│   ├── authStore.ts  # Zustand: user session
│   └── appStore.ts   # Zustand: global UI state
├── types/
│   └── index.ts      # Semua TS interfaces
└── router.tsx        # React Router v6
```

### PWA Config
```
name: "CuanPOS" | short_name: "CuanPOS"
theme_color: "#16a34a"
display: "standalone"
Cache strategy:
  - App shell (HTML/JS/CSS) → Cache First
  - Firestore → Network First dengan offline fallback
```

---

## 6. Sequence Diagrams

### Save Production Batch
```
User → NewBatchForm: input ingredients + packCount
NewBatchForm → Firestore: read materials (stock, costPerUnit)
NewBatchForm: kalkulasi totalCost & costPerPack (BL-01)
NewBatchForm: validasi stok setiap ingredient (V-01–V-04)
User → NewBatchForm: tap "Simpan Batch"
NewBatchForm → Firestore [batch write]:
  ├── productions.add({ ingredients, totalCost, packCount, costPerPack })
  ├── materials[i].stock -= qty (setiap ingredient)
  └── products.stock += packCount
      products.avgCost = weighted average (BL-02)
Firestore → Dashboard: real-time update
```

### POS Checkout
```
User → POSPage: input qty
POSPage → Firestore: read product (price, avgCost, stock)
POSPage: kalkulasi totalPrice, totalCost, profit (BL-04)
User → POSPage: tap "Charge"
POSPage → SaleConfirmPage: tampil summary
User → SaleConfirmPage: tap "Konfirmasi"
SaleConfirmPage → Firestore [batch write]:
  ├── transactions.add({ qty, priceEach, totalPrice, costEach, totalCost, profit })
  └── products.stock -= qty (BL-05)
Firestore → Dashboard: real-time update
```

### Void Transaction
```
User → TransactionDetailPage: tap "Void Transaksi"
TransactionDetailPage: tampil konfirmasi dialog
User: konfirmasi
TransactionDetailPage → Firestore [batch write]:
  ├── transactions[id].voided = true
  ├── transactions[id].voidedAt = now()
  └── products.stock += transactions[id].qty (BL-11)
```

---

## 7. Database Schema

### `materials`
```typescript
{
  id: string,                    // slug: "flour", "water"
  name: string,                  // "Tepung Terigu"
  unit: 'g' | 'ml' | 'pcs',
  stock: number,
  costPerUnit: number,           // Rp per unit
  lowStockThreshold: number,
  isDefault: boolean             // true = bagian resep default
}
```

### `products`
```typescript
{
  id: string,                    // "churros-pack"
  name: string,
  unit: string,
  packSize: number,              // pcs per pack
  price: number,                 // harga jual (Rp)
  stock: number,
  avgCost: number,               // HPP rata-rata, update tiap batch
  isActive: boolean              // false = soft deleted
}
```

### `productions`
```typescript
{
  id: string,                    // auto-generated
  date: Timestamp,
  ingredients: Record<string, number>,  // materialId → qty
  totalCost: number,
  outputQty: number,             // packCount × packSize
  packCount: number,
  costPerPack: number            // totalCost / packCount
}
```

### `transactions`
```typescript
{
  id: string,
  date: Timestamp,
  productId: string,
  qty: number,
  priceEach: number,
  totalPrice: number,            // qty × priceEach
  costEach: number,              // snapshot avgCost saat transaksi
  totalCost: number,             // qty × costEach
  profit: number,                // totalPrice - totalCost
  voided: boolean,
  voidedAt: Timestamp | null
}
```

### `recipes`
```typescript
{
  id: string,                    // "default-churros"
  productId: string,
  ingredients: Record<string, number>,  // materialId → defaultQty
  outputPack: number             // default 16
}
```

### Business Logic Reference
| ID | Formula |
|----|---------|
| BL-01 | `totalCost = Σ (qty × costPerUnit)` |
| BL-02 | `avgCost_baru = (stock_lama × avgCost_lama + packCount × costPerPack) ÷ (stock_lama + packCount)` |
| BL-03 | `materials[i].stock -= qty; products.stock += packCount` |
| BL-04 | `profit = (qty × price) - (qty × avgCost)` |
| BL-05 | `products.stock -= qty` |
| BL-06 | `costPerUnit_baru = (stock_lama × costPerUnit_lama + qty_beli × hargaPerUnit) ÷ (stock_lama + qty_beli)` |
| BL-11 | `transactions[id].voided = true; products.stock += qty` |

### Validation Reference
| ID | Rule | Behavior |
|----|------|----------|
| V-01 | Ingredient qty ≤ 0 | Field error, Save disabled |
| V-02 | material.stock < ingredient qty | Field highlight merah, Save disabled |
| V-03 | packCount ≤ 0 | Field error, Save disabled |
| V-04 | packCount > 24 | Warning, perlu konfirmasi |
| V-05 | product.stock < qty jual | Charge disabled |
| V-06 | qty jual ≤ 0 | Charge disabled |

---

## 8. Seed Data (Initial State)

### Materials (isDefault: true)
| ID | Nama | Unit | Stock | Cost/Unit | Low Stock |
|----|------|------|-------|-----------|-----------|
| water | Air | ml | 10.000 | Rp 0,001 | 3.000 |
| flour | Tepung Terigu | g | 5.000 | Rp 20 | 1.000 |
| butter | Mentega | g | 2.000 | Rp 30 | 500 |
| sugar | Gula | g | 2.000 | Rp 10 | 500 |
| salt | Garam | g | 500 | Rp 5 | 100 |
| vanilla | Vanilla | g | 200 | Rp 100 | 50 |
| eggs | Telur | g | 2.000 | Rp 25 | 500 |
| flavor | Perisa | g | 300 | Rp 500 | 50 |

### Default Recipe (recipes/default-churros)
| Material | Qty |
|----------|-----|
| water | 1.800 ml |
| flour | 1.000 g |
| butter | 325 g |
| sugar | 325 g |
| salt | 10 g |
| vanilla | 5 g |
| eggs | 495 g |
| flavor | 20 g |
| **outputPack** | **16** |

### Product (products/churros-pack)
```json
{ "name": "Churros Pack", "unit": "pack", "packSize": 12,
  "price": 10000, "stock": 0, "avgCost": 0, "isActive": true }
```

---

## 9. Frontend Implementation Notes
> Bagian ini khusus untuk AI Agent yang akan membangun frontend.

### UI Conventions
- **Mobile-first:** viewport 390px, semua touch target minimum 44px
- **Bottom Navigation:** 5 tab (Dashboard, Produksi, POS, Inventori, Laporan)
- **Color palette:** primary green `#16a34a`, destructive red `#dc2626`, warning amber `#d97706`
- **Typography:** angka finansial menggunakan `font-mono` untuk alignment
- **Loading state:** skeleton loader, bukan spinner
- **Error state:** inline message merah di bawah field (bukan toast untuk form error)
- **Success action:** toast notification singkat (2 detik)

### Mock Data untuk Frontend
Gunakan data dari Seed Data section di atas. Untuk transaksi, buat 5–10 dummy transaction dengan tanggal hari ini dan beberapa hari ke belakang untuk keperluan tampilan dashboard dan laporan.

### Komponen Prioritas
1. `BottomNav` — navigasi utama
2. `StatCard` — card revenue/HPP/profit di dashboard
3. `IngredientRow` — row bahan baku di form produksi (input + unit label)
4. `StepperInput` — input +/- untuk qty di POS
5. `TransactionItem` — item list transaksi
6. `ExportModal` — pilihan format export

### Screen yang Paling Penting untuk Prototype
Urutan prioritas render untuk review tampilan:
1. S02 Dashboard
2. S06 POS
3. S04 New Batch Form
4. S08 Materials List
5. S12 Reports
