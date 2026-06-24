# AnchurPOS — PRD

## Original Problem Statement
Bangun sistem AnchurPOS (fases 0-9) dengan UI/UX pixel-perfect sesuai mockup yang diunggah (`AnchurPOS Mockup.dc.html` dan `CLAUDE.md`). Font, warna latar, posisi elemen, lokasi tombol harus persis sama dengan mockup. Aplikasi mobile-first dengan layout desktop yang tidak memiliki ruang kosong. Role-based access: Owner > Manager > Crew.

## Design System (dari CLAUDE.md)
- **Primary Pink**: `#E85D8C` (tombol, aksen, status aktif)
- **Base Background**: `#FCABB4` (background seluruh halaman)
- **Font**: `Plus Jakarta Sans` (sudah terkonfigurasi)
- **Card Style**: white, `border-radius: 14px`, `border: 1px solid #F1F5F9`, `padding: 14px`
- **Tab Active**: `border-bottom: 2px solid #E85D8C`, underline style
- **Progress Bar**: `height: 6px`, gradient `#E85D8C → #F2A0B7`

## Architecture
```
/app/frontend/
├── app/               # Next.js 15 App Router
│   ├── api/           # Firebase Admin API routes
│   ├── login/         # Login page
│   ├── manager/       # Manager pages (dashboard, pos, orders, inventory, more, employees, master-data)
│   ├── crew/          # Crew pages (attendance, production, more)
│   ├── owner/         # Owner pages (dashboard, reports, approval, more)
│   └── order/         # Order tracking
├── components/        # Shared components
│   └── layout/        # Sidebar, BottomNav
├── lib/               # Firebase, auth context
└── types/             # TypeScript definitions
```

## Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS
- **Backend**: Firebase Admin SDK via API routes
- **Auth**: Firebase Authentication (username-based login)
- **DB**: Firestore

## Role-Based Access
- Owner: Akses semua fitur + laporan + approval
- Manager: Dashboard, POS, Pesanan, Inventori, Pegawai, Master Data
- Crew: Absensi, Produksi

## Credentials Test
- Manager: `manager` / `anchur123`
- Crew: `crew1` / `anchur123`
- Owner: `owner` / `anchur123`

---

## CHANGELOG

### 2025-01 (Sebelum fork ini)
- Implementasi Next.js 14 App Router dengan Firebase
- Role-based route guards (Owner > Manager > Crew)
- Manager: Dashboard, POS, Pesanan, Inventori, Lainnya
- Crew: Absensi, Produksi
- Owner: Dashboard, Reports
- Desktop sidebar layout
- Fix Firestore composite index errors di /api/customers dan /api/products

### Feb 2026 — UI/UX Overhaul (fork ini)
**SELESAI: Pixel-Perfect UI/UX Overhaul berdasarkan Mockup**
- Ubah background seluruh halaman dari `#F0EDE8` → `#FCABB4`
- Manager Dashboard, Pesanan, Lainnya, Attendance, Owner Dashboard: white header + white cards on pink bg

### Feb 2026 — Manager Core Features
**SELESAI: POS & Inventori Manager**
- **Kasir/POS** rebuilt: katalog produk (search + category chips + 2-col grid) → variant selector bottom sheet → cart bottom bar (gradient pink pill) → checkout sheet (customer opsional, metode bayar, konfirmasi)
- **Orders POST** diupdate: customerId opsional, customerName langsung, stok varian otomatis dikurangi
- **Inventori** ditambah tab Produk Jadi: 3 tabs (Produk Jadi, Bahan Baku, Pengeluaran), stock opname, progress bars
- `/api/variants/[id]` endpoint baru: PATCH untuk stock opname
- `/api/seed` endpoint: seed data awal (variants, products, ingredients) via `POST /api/seed -H "Authorization: Bearer anchurpos-seed-2025"`
- **Firebase Admin fix**: robust key parsing untuk Windows (strip quotes + handle escaped newlines)

---

## ROADMAP

### P0 (Kritis)
- [x] Pixel-perfect UI/UX sesuai mockup
- [x] Background #FCABB4, white header sections, underline tabs
- [x] Circular clock-in button crew attendance

### P1 (Prioritas Tinggi)
- [ ] Verify Firestore Schema sesuai Firestore_Data_Model.md
- [ ] Owner vs Manager dashboard feature differences
- [ ] Multi-outlet support di Owner Dashboard

### P2 (Prioritas Menengah)
- [ ] Owner-only: laporan keuangan detail, approval pengeluaran
- [ ] Manager: stock opname feature
- [ ] Crew: riwayat produksi lengkap

### P3 (Backlog)
- [ ] Push notifications untuk low-stock alerts
- [ ] Export data ke Google Sheets
- [ ] Dark mode support
- [ ] Animations/transitions between screens
