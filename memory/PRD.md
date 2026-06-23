# AnchurPOS - PRD

## Original Problem Statement
Membangun sistem POS (Point of Sale) untuk bisnis churros frozen "Anchur" Bandung.
User upload repo existing (madlig/anchurpos) yang logic-nya sudah selesai (Fase 0-9),
tapi UI/UX belum dikerjakan. User ingin UI menggunakan warna pink #FCABB4.

## Stack
- Next.js 15 (App Router) + TypeScript
- Firebase Auth + Firestore
- Tailwind CSS + shadcn/ui
- Font: Plus Jakarta Sans

## User Personas
- **Owner (Aya/Adli)**: Pemilik bisnis, ingin melihat dashboard, laporan, approval
- **Manager (Adli)**: Operasional harian - kasir, inventori, payroll, manajemen order
- **Crew**: Karyawan produksi - absen, catat produksi, pre-packing, stok opname
- **Publik**: Customer yang ingin memesan via form online

## Color Palette
- Background: `#F0EDE8` (warm beige)
- Login BG: `#FCABB4` (light pink)
- Brand Primary: `#E85D8C` (pink)
- Brand Dark: `#C94A73`
- Font: Plus Jakarta Sans

## Core Requirements (Static)
1. Login multi-role (owner/manager/crew) via Firebase Auth
2. Role-based routing & guard
3. Dashboard per role dengan KPI cards
4. POS/Kasir untuk buat order
5. Manajemen inventori bahan baku
6. Pencatatan produksi harian (crew)
7. Absensi crew dengan validasi IP WiFi
8. Pre-packing, stock opname
9. Rainbow assembly
10. Laporan keuangan (owner)
11. Approval multi-tab (owner)
12. Form order publik (no auth)

## What's Been Implemented (Jan-Jun 2026)

### Phase 0-9 (Backend Logic - sebelum redesign)
- Semua API routes (Firebase Admin, auth middleware, semua CRUD endpoints)
- Tipe data TypeScript lengkap
- Seed script (produk, varian, bahan baku, customer, users)
- Firebase Firestore data model

### UI/UX Redesign (Jun 2026)
- Login page: pink glassmorphism background (#FCABB4)
- Font: Plus Jakarta Sans (seluruh app)
- Background: warm beige #F0EDE8 (konsisten semua halaman)
- Bottom Navigation (Manager/Crew/Owner): blur backdrop, pink active state
- Manager Dashboard: hero card gradient pink, stat cards, quick actions, alerts
- Owner Dashboard: hero card + stats sama dengan manager
- Crew Attendance: status card berwarna, tombol check-in/out besar (64px)
- Crew Production: variant chips pill (48px touch), stepper +/- dengan pink button
- POS/Kasir: cart interface, tier pricing display, success state
- Public Order Form: branded pink header gradient, clean card forms
- Alerts fix: simplify Firestore query (no composite index needed)

## Firebase Credentials
- Project: anchurpos
- Auth Domain: anchurpos.firebaseapp.com
- Storage: anchurpos.firebasestorage.app
- Service Account: firebase-adminsdk-fbsvc@anchurpos.iam.gserviceaccount.com

## Test Credentials
- Owner: owner / anchur123
- Manager: manager / anchur123
- Crew: crew1 / anchur123

## Prioritized Backlog (Next)

### P0 - Segera
- [ ] Inventory page: tampilkan daftar bahan baku + form tambah pengeluaran
- [ ] Orders list page: tabel order dengan status chip
- [ ] Order detail page: tampilan detail order

### P1 - Penting
- [ ] Pre-packing page: loyang pool + hasil packing input
- [ ] Stock opname page: checklist bahan baku
- [ ] Owner Approval: 3-tab (stok opname, absensi, payroll)
- [ ] Owner Reports: grafik P&L bulanan
- [ ] Rainbow Assembly page
- [ ] Manager "More" page: navigasi ke semua fitur

### P2 - Enhancement
- [ ] Employee management (CRUD pegawai)
- [ ] IP whitelist settings
- [ ] Real-time notifications
- [ ] Export laporan ke Excel/PDF

## Pages Status
| Page | Status |
|------|--------|
| /login | ✅ Redesigned |
| /manager/dashboard | ✅ Redesigned |
| /manager/pos | ✅ Redesigned |
| /manager/inventory | ⚠️ Functional, needs UI polish |
| /manager/orders | ⚠️ Functional, needs UI polish |
| /manager/orders/[id] | ⚠️ Functional, needs UI polish |
| /manager/more | ⚠️ Basic |
| /crew/attendance | ✅ Redesigned |
| /crew/production | ✅ Redesigned |
| /crew/pre-packing | ⚠️ Functional, needs UI polish |
| /crew/stock-opname | ⚠️ Functional, needs UI polish |
| /owner/dashboard | ✅ Redesigned |
| /owner/approval | ⚠️ Functional, needs UI polish |
| /owner/reports | ⚠️ Basic |
| /owner/more | ⚠️ Basic |
| /order (public) | ✅ Redesigned |
