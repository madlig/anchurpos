# AnchurPOS — PRD

## Problem Statement
Sistem manajemen produksi dan penjualan churros "Anchur Bandung". App ini mengatur seluruh proses dari kasir, produksi, absensi crew, hingga laporan keuangan owner.

## User Personas
- **Owner**: Lihat laporan P&L, approval, akses semua fitur manager & crew
- **Manager**: Kasir/POS, inventori, kelola karyawan, pesanan, produksi
- **Crew**: Absensi, produksi, pre-packing, stock opname

## Hierarchical Role Access
- Owner > Manager > Crew (owner bisa akses semua halaman)
- Manager bisa akses crew pages
- Crew hanya bisa akses crew pages

## Tech Stack
- Next.js 14 (App Router), TypeScript, TailwindCSS
- Firebase Authentication (username@anchurpos.id pattern)
- Firebase Firestore (database)
- Running: `yarn start` dari `/app/frontend/` (port 3000)

## Color Theme
- Primary: `#E85D8C` (pink deep)
- Accent: `#FCABB4` (pink light)
- Background: `#F0EDE8` (warm cream)

## Architecture
```
/app/frontend/
├── app/               # Next.js App Router
│   ├── api/           # Firebase/Firestore API routes
│   ├── login/         # Login page
│   ├── manager/       # Manager pages (layout + dashboard, pos, orders, inventory, more, master-data, employees)
│   ├── crew/          # Crew pages (layout + attendance, production, pre-packing, stock-opname)
│   ├── owner/         # Owner pages (layout + dashboard, reports, approval, more)
│   └── order/         # Public order form
├── components/
│   ├── shared/        # RoleGuard, etc.
│   └── layout/        # BottomNav, Sidebar (legacy)
├── lib/               # auth-context, firebase-admin, utils
└── types/             # TypeScript types
```

## Key Routes
- `/login` — Login page
- `/manager/dashboard` — Manager dashboard (omzet, produksi, low stock, alerts)
- `/manager/pos` — POS/Kasir
- `/manager/orders` — Riwayat order
- `/manager/inventory` — Inventori bahan baku + pengeluaran
- `/manager/more` — Menu lainnya (master data, karyawan, dll)
- `/crew/attendance` — Absensi crew
- `/crew/production` — Input produksi
- `/crew/pre-packing` — Pre-packing
- `/crew/stock-opname` — Stock opname
- `/owner/dashboard` — Dashboard owner
- `/owner/reports` — Laporan P&L
- `/owner/approval` — Approval opname & absensi
- `/owner/more` — Menu owner
- `/order` — Public order form (tanpa auth)

---

## What's Been Implemented

### Phase 1 (Session 1)
- ✅ Firebase Auth + Admin SDK setup
- ✅ Seeding data (seed.ts script)
- ✅ RoleGuard hierarchical access (Owner > Manager > Crew)
- ✅ Login page dengan pink theme
- ✅ Manager Dashboard (hero card, stat cards, produksi, low stock, alerts)
- ✅ Manager Inventory (bahan baku + pengeluaran tabs)
- ✅ Manager Orders (riwayat + filter)
- ✅ Crew Attendance (check-in/out + history)
- ✅ Crew Production (input batch)
- ✅ Crew Pre-packing
- ✅ Crew Stock Opname
- ✅ Owner Approval
- ✅ Owner Reports (P&L)

### Phase 2 (Session 2 — Feb 2026)
- ✅ Desktop Sidebar untuk Manager, Crew, Owner (240px, hidden md:flex)
- ✅ Tab "Pesanan" ditambah ke Manager nav (mobile bottom + desktop sidebar)
- ✅ Semua warna emerald/hijau diubah ke pink (#E85D8C)
- ✅ Layout desktop responsive (md:grid, max-w-5xl, md:px-8)
- ✅ Manager Dashboard: HPP+Profit di hero card on desktop, 2-col content
- ✅ Manager POS: 2-col layout desktop (cart kiri, checkout kanan)
- ✅ Manager Inventory: 2-col grid on desktop
- ✅ Manager Orders: 2-col grid on desktop
- ✅ Crew Attendance: 2-col (status+button kiri, history kanan) on desktop
- ✅ Owner Dashboard: full pink theme + 2-col desktop layout
- ✅ Owner More: 2-col menu grid on desktop
- ✅ Public Order form: full pink hero, 2-col on desktop
- ✅ Fix Firestore composite index issue pada /api/products dan /api/customers
- ✅ Manager POS: defensive Array.isArray check untuk prevent crash

---

## Prioritized Backlog

### P0 (Critical)
- None currently

### P1 (High Priority)
- Verify Firestore indexes untuk semua query bermasalah (lihat Firebase console)
- Manager POS: test dengan data customer yang sebenarnya
- Rainbow Assembly feature
- Karyawan & Payroll feature

### P2 (Medium)
- Laporan per-karyawan
- Export laporan ke CSV/Excel
- Notifikasi real-time (Firebase Cloud Messaging)
- Stock Opname Review untuk Manager
- Rainbow Assembly feature completion

### P3 (Future/Backlog)
- Owner: perbandingan bulan ke bulan di laporan
- Multi-outlet support
- Print struk/invoice
- Dashboard analytics dengan grafik
