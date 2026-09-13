# Project Overview & Design System — Anchurpos

File dokumentasi ini berfungsi sebagai memori persisten untuk Antigravity (dan AI agent lainnya) mengenai status riwayat fitur yang telah selesai dibangun serta panduan lengkap Sistem Desain (UI/UX) di repositori Anchurpos.

---

## 1. Ringkasan Eksekutif & Karakter Proyek

- **Nama Platform**: Anchurpos (Anchovy Processing POS & Operation System)
- **Domain**: Operasional bisnis pengolahan makanan (ikan teri / olahan churros & camilan berbasis hasil laut) skala UKM/B2B/Retail di Indonesia.
- **Tiga Peran Pengguna (RBAC)**:
  - `owner`: Pemilik bisnis (akses penuh: omzet, laporan, persetujuan, payroll, audit).
  - `manager`: Pengelola operasional (kasir/POS, manajemen pesanan, master data, BOM, inventori, review absensi, payroll).
  - `crew`: Staf lapangan/produksi (terminal SFM mobile-first, absensi selfie GPS, stock opname).

---

## 2. Tech Stack & Arsitektur Inti

| Lapisan | Teknologi | Catatan Implementasi |
|---|---|---|
| **Framework** | Next.js 15 (App Router), React 18 | Struktur berbasis peran: `/owner`, `/manager`, `/crew` |
| **Language** | TypeScript (Strict Mode) | Kontrak tipe bersama di `types/index.ts` |
| **Styling** | Tailwind CSS + `tailwindcss-animate` | CSS variables + utility classes khusus di `app/globals.css` |
| **Database** | Google Cloud Firestore | Akses server-side melalui Firebase Admin SDK (tidak ada direct client write) |
| **Auth** | Firebase Auth (Client) + Admin SDK | ID Token ditranspor via Bearer token, peran di custom claim `role` |
| **Validasi** | Zod (`lib/validations.ts`) | Single source of truth untuk skema payload server |
| **Data Fetching** | Native `fetch` + `fetchWithAuth` | Wajib menyertakan header `Authorization: Bearer <token>` |

---

## 3. Sistem Desain & Panduan UI/UX (Design System)

Gaya desain Anchurpos mengawinkan kenyamanan aplikasi konsumen modern (**Super-App Mobile PWA ala Gojek/Grab**) dengan ketegasan dan efisiensi sistem **Enterprise ERP (ala SAP/Odoo)**.

### A. Palet Warna (Brand Pink Palette)
- **Latar Belakang Canvas Body**: `#FCABB4` (`app/globals.css`).
- **Brand Palette (`tailwind.config.ts`)**:
  - `brand-50`: `#FEF1F5` (Soft tinted background / badge chip)
  - `brand-100`: `#FCDCE8`
  - `brand-200`: `#FCABB4`
  - `brand-300`: `#F2A0B7`
  - `brand-400`: `#EE7BA0`
  - `brand-500`: `#E85D8C` (Warna aksen utama, tombol primer, icon aktif)
  - `brand-600`: `#D44D7A`
  - `brand-700`: `#C94A73` (Header tegas, border aksen, teks tebal)
  - `brand-800`: `#A83860`
  - `brand-900`: `#8B2A4D`
- **Gradients**:
  - `.brand-gradient`: `linear-gradient(135deg, #E85D8C 0%, #C94A73 100%)` (Hero banner, tombol aksi utama, header kartu).
  - `.brand-gradient-light`: `linear-gradient(135deg, #E85D8C 0%, #F2A0B7 100%)`.

### B. Tipografi
- **Teks Umum / UI Antarmuka**: `'Plus Jakarta Sans'`, sans-serif — font modern berkarakter ramah dan mudah dibaca di mobile/desktop.
- **Data Angka / Finansial / Teknis**: `'JetBrains Mono'`, monospace (`.font-mono`) — digunakan konsisten pada:
  - Nominal mata uang (Rp via `fmt()`)
  - Kode batch produksi & tanggal MFD
  - Nomor resi / nomor PO / ID pesanan
  - Angka kuantitas stok, HPP per unit, dan timer SFM

### C. Komponen & Ergonomi Mobile (PWA Feel)
- **Feedback Sentuhan**: `.tap-target` (`active:scale-[0.97] transition-transform duration-100`) pada semua kartu dan tombol yang dapat ditekan.
- **PWA & Touch Optimizations**:
  - `overscroll-behavior-y: contain` diatur pada `html, body` untuk mencegah pull-to-refresh browser yang tidak disengaja.
  - `-webkit-user-select: none` & `-webkit-touch-callout: none` pada elemen interaktif untuk mencegah callout menu browser saat tombol ditekan lama.
  - Padding area aman iOS: `.pb-safe` (`env(safe-area-inset-bottom)`).
- **Animasi Transisi Halaman**:
  - `.page-enter` (`fade-slide-up 0.28s ease-out both`)
  - Stagger delay classes (`.stagger-1` s/d `.stagger-5`) untuk render daftar item bertahap.
- **Skeleton Loading Shimmer**:
  - Seluruh halaman menggunakan layout shimmer (`components/ui/Skeleton.tsx`), **tidak menggunakan spinner bulat** agar tidak ada layout shifting.
- **Modal & Panel Responsif**:
  - `components/shared/BottomSheet.tsx`: Slide-up sheet untuk alur kerja mobile (crew & POS).
  - `components/shared/AdaptivePanel.tsx`: Panel adaptif desktop/tablet.
  - Desain sudut membulat lebar (`rounded-2xl`, `rounded-3xl`, default `--radius: 1rem`).

### D. Konvensi Teks & Lokalisasi
- Seluruh antarmuka menggunakan **Bahasa Indonesia** bernada kasual-profesional (contoh: *"Catat Pesanan"*, *"Tandai semua dibaca"*, *"Gagal menyimpan pesanan"*).
- Format mata uang IDR wajib menggunakan helper `fmt()` berbasis `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })`.

---

## 4. Riwayat Modul & Fitur yang Sudah Dikerjakan

### 1. Shop Floor Management (SFM) — Pusat Produksi Pabrik
- **Smart Grid Manager UI** (`app/manager/sfm/`): Tampilan grid Work Order (WO) terpadu dengan filter tanggal target, status batch, dan peran crew.
- **Terminal Crew Mobile-First** (`app/crew/sfm/`): Alur kerja tanpa hambatan dengan progressive disclosure, auto-chained step timer, dan mode jeda freezer.
- **Prepack Execution (3 Mode)**: Mendukung mode *regular*, *full*, dan *mixed* untuk kapasitas pengemasan.
- **Pemotongan Stok Otomatis**: Integrasi otomatis potongan stok bahan baku dan packaging langsung ke inventori saat Work Order selesai.
- **Churros Limiter**: Pembatas kuantitas cetak & potong churros untuk mencegah anomali kuantitas.
- **Daily Audit Ledger**: Laporan audit harian dengan filter rentang tanggal dan pencatatan tanggal manufaktur (MFD).
- **Integrasi Stock Opname**: Akses Stock Opname crew dipindahkan langsung ke dalam menu SFM agar mudah dijangkau dari lantai produksi.

### 2. Presensi (Attendance) & HR
- **Presensi Mobile Crew** (`app/crew/attendance/`): Clock-in dan clock-out dengan selfie kamera dan verifikasi geolokasi GPS (background acquisition).
- **Kompresi Foto Native Canvas**: Menggantikan modul kompresi WebWorker pihak ketiga dengan native HTML5 Canvas untuk mengatasi masalah *infinite loading/freeze* pada perangkat seluler.
- **Server-side Photo Upload Fallback**: Mengatasi masalah storage upload timeout dengan mekanisme fallback langsung di endpoint server.
- **Deteksi Anomali Absensi**: Penanganan anomali otomatis mengarahkan absensi auto-checkout ke antrean review manajer.
- **Input Absensi Manual Manager** (`app/manager/employees/attendance/`): Modal input kehadiran manual untuk koreksi data kehadiran yang tersinkronisasi otomatis ke payroll.

### 3. Penggajian (Payroll)
- **Harmonisasi Siklus Cutoff (29 - 28)**: Penyelarasan siklus kehadiran dan perhitungan upah karyawan.
- **Master Wage Terintegrasi**: Upah master karyawan terhubung langsung dengan gate penugasan SFM.
- **Dashboard Review Payroll Modern** (`app/manager/employees/payroll/`): Dilengkapi kartu ringkasan estimasi total gaji, metrik kehadiran, dan filter shift.
- **Aksi Massal 'Bayar & Kunci Semua'**: Fasilitas batch action untuk mengunci dan membayar seluruh gaji yang telah direview.
- **Modal Slip Gaji Siap Cetak**: Modal detail slip gaji dengan tombol print langsung (print-friendly layout).

### 4. Master Data & Bill of Materials (BOM)
- **4 Pilar Master Data Enterprise** (`app/manager/master-data/`):
  1. *Produk & Varian Rasa*: Manajemen SKU, harga bertingkat (tiers), dan soft-delete.
  2. *Bahan, Packaging & Add-On*: Satuan (gram, pcs, loyang), stok minimum, dan harga per unit.
  3. *Pelanggan (CRM)*: Segmen tipe pelanggan (Reguler, Reseller, B2B), limit kredit, dan nomor kontak.
  4. *Pemasok / Vendor*: Manajemen vendor bahan baku dan operasional.
- **Dual View Switcher**: Pilihan tampilan *Enterprise ERP Data Table (List View)* dan *Grid Card View* di semua pilar master data.
- **BOM Multi-Level Assembly (Tab 4)**: Struktur pohon perakitan multi-level tanpa hardcoding.
- **Kalkulasi Otomatis HPP & Yield**: Perhitungan HPP per unit dasar berdasarkan *output yield quantity* resep prepack secara otomatis saat disimpan.
- **Z-Index Stacking Context**: Penyelesaian masalah dropdown collision / clipping pada kartu seleksi BOM.

### 5. POS (Kasir) & Pesanan (Orders)
- **Multi-Saluran Penjualan**: Walk-in, WhatsApp, TikTok Shop, Shopee.
- **Perhitungan Biaya Platform**: Integrasi potongan biaya fee marketplace secara otomatis.
- **Deteksi Tipe Pelanggan & PO**: Input nomor PO / referensi khusus untuk pelanggan B2B dan Reseller.
- **Smart Auto-Select Packaging**: Deteksi otomatis kebutuhan kantong pengiriman sekunder.
- **Dukungan Back-dated Order**: Fasilitas pencatatan transaksi tanggal lampau untuk owner dan manager.
- **Manajemen Pembatalan (Void)**: Pembatalan pesanan tersimpan rapi dengan alasan pembatalan (soft-delete).

---

## 5. Golden Rules & Anti-Pattern Guardianship

Setiap pengembangan fitur baru di repositori ini WAJIB mematuhi panduan berikut:
1. **Dilarang Menggunakan Bare `fetch()` di Client Component**:
   Gunakan selalu helper `fetchWithAuth(url, options)` yang menginjeksi token `Authorization: Bearer ${token}`. Menggunakan `fetch` langsung ke `/api/*` adalah penyebab nomor satu error 401 Unauthorized.
2. **Validasi Wajib Bersumber dari `parseResult.data`**:
   Di setiap API route handler, baca data dari `parseResult.data` (hasil `zod.safeParse`), bukan dari `req.body` mentah, agar data benar-benar tervalidasi.
3. **Kebijakan Penghapusan Data**:
   - *Soft-Delete* (`isActive: false`): Produk, Varian, Pelanggan.
   - *Hard-Delete* (`ref.delete()`): Pemasok dan Bahan Baku (dengan guard referensi resep).
4. **Gerakan Kontrak Serentak (Lockstep)**:
   Perubahan skema (zod), API handler, TypeScript interface (`types/index.ts`), dan UI form harus selalu diperbarui bersamaan.
5. **Verifikasi Wajib Sebelum Klaim Selesai**:
   Setiap perubahan kode harus lolos verifikasi:
   - `npx tsc --noEmit` (bebas type error)
   - `npm run build`
