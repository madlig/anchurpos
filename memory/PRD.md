# AnchurPOS — PRD

## Original Problem Statement
Bangun sistem POS (Point of Sale) bernama AnchurPOS untuk usaha kuliner/bakery skala UMKM.
- Mobile-first, tapi punya layout desktop yang tidak kosong
- Pixel-perfect sesuai mockup (AnchurPOS Mockup.dc.html + CLAUDE.md)
- Desain: background #FCABB4 (pink), header putih sticky, card putih borderRadius 14px, accent #E85D8C
- RBAC: Owner > Manager > Crew
- **Fokus saat ini: Manager role** (Kasir/POS dan Inventori)
- Backend: Firebase Auth + Firestore (pure Next.js 14 App Router, tanpa Python backend)

## Architecture
```
/app/                          ← Root (sumber kebenaran, yang dijalankan user lokal)
├── app/                       ← Next.js App Router pages & API routes
│   ├── api/                   ← API Route Handlers (Firebase Admin SDK)
│   │   ├── auth/              ← login, verify
│   │   ├── products/          ← GET list, POST buat baru
│   │   ├── variants/          ← GET list, POST buat baru, PATCH stok [id]
│   │   ├── ingredients/       ← GET list, POST buat baru
│   │   ├── orders/            ← GET list, POST checkout, PATCH status, void
│   │   ├── customers/         ← GET list
│   │   └── seed/              ← POST isi data awal
│   ├── login/
│   ├── manager/
│   │   ├── pos/               ← Kasir / POS
│   │   ├── inventory/         ← Inventori (Produk Jadi, Bahan Baku, Pengeluaran)
│   │   ├── orders/            ← Daftar pesanan + [id] detail
│   │   └── master-data/       ← CRUD Produk, Varian, Bahan Baku
│   ├── crew/
│   └── owner/
├── lib/                       ← Auth context, Firebase admin/client, utils
├── types/                     ← TypeScript definitions
├── components/ui/             ← Shadcn components
├── backend/server.py          ← Proxy FastAPI port 8001 → 3000 (Emergent routing fix)
└── frontend/                  ← Cloud runner (package.json start = cd /app && next dev)
```

## Firestore Collections
- `users`: {uid, email, role, name}
- `products`: {name, code, description, packPerBatch, isActive}
  - subcollection `priceTiers`: {minQty, maxQty, price}
- `variants`: {name, sortOrder, isProductionVariant, currentStock, minStock}
- `ingredients`: {name, category, baseUnit, currentStock, minStock, unitAlternatives}
- `orders`: {orderNumber, source, customerId, customerName, items[], total, status, paymentStatus, ...}
- `customers`: {name, channel, phoneNumber, discountPerUnit, isActive}

## What's Implemented

### ✅ Infrastructure
- Firebase Auth + Firestore (pure Next.js, no Python backend)
- Role-based middleware (`requireRole`)
- Proxy server `/app/backend/server.py` agar API bisa diakses dari cloud preview URL
- Root folder = sumber kebenaran; `frontend/` hanya launcher dengan `start: cd /app && next dev`

### ✅ Authentication
- Login page (username-based, bukan email)
- Role redirect: manager → /manager/dashboard, crew → /crew, owner → /owner
- JWT via Firebase custom tokens

### ✅ Manager — POS / Kasir
- Katalog produk dengan category chips
- Bottom sheet pilih varian
- Cart sidebar/bar (gradient pink)
- Checkout sheet (pilih customer, metode bayar)
- Stok berkurang otomatis setelah checkout

### ✅ Manager — Inventori
- Tab: Produk Jadi, Bahan Baku, Pengeluaran
- Stock opname produk jadi (PATCH /api/variants/[id])
- Progress bar stok bahan baku
- Warning stok rendah

### ✅ Manager — Order Detail `/manager/orders/[id]`
- Header sticky dengan back button + status badge
- Customer card, items card, payment card
- Tombol "Tandai Selesai" dan "Void Order"

### ✅ Manager — Master Data `/manager/master-data`
- 3 tab: Produk, Varian, Bahan Baku
- Form tambah produk (name, code, price tiers bertingkat)
- Form tambah varian (name, sortOrder, minStock)
- Form tambah bahan baku (name, satuan, category, minStock)

### ✅ Seed Data
- POST /api/seed untuk isi data awal Firebase

## Prioritized Backlog

### P1 — Manager (In Progress)
- [ ] Edit/delete produk, varian, bahan baku (hanya tambah yang sudah ada)
- [ ] Laporan harian/mingguan ke Owner

### P2 — Crew & Owner Redesign
- [ ] Crew: Absensi, production, checklist
- [ ] Owner: Dashboard, stock opname review, approval pengeluaran

### P3 — Advanced Features
- [ ] Export laporan ke Excel/PDF
- [ ] Push notification low-stock alert
- [ ] Multi-outlet support

## Known Issues / Notes
- Firestore composite index: Hindari `.where().orderBy()` pada field berbeda. Gunakan in-memory sort.
- Windows `.env.local`: FIREBASE_PRIVATE_KEY harus satu baris dengan `\n`, dibungkus `"..."`.
- Cloud routing: Kubernetes routes `/api/*` ke port 8001. Proxy di `/app/backend/server.py` forward ke port 3000.
