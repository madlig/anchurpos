# AnchurPOS — Implementation Plan
> Dokumen ini dibaca PERTAMA oleh Claude Code sebelum mulai coding.
> Referensi detail ada di 3 dokumen pendamping: `Firestore_Data_Model.md`, `API_Routes_Breakdown.md`, `UI_Breakdown_Per_Role.md`

---

## 1. Konteks Singkat

AnchurPOS adalah sistem manajemen produksi & penjualan untuk Anchur, home industry churros frozen di Bandung. Menggantikan sistem Google Sheets yang sudah berjalan, dengan kebutuhan utama: multi-role access, real-time stock tracking, dan input form yang sangat sederhana untuk pekerja dapur (Crew) yang tidak familiar teknologi.

**4 Role:** Owner (supervisi), Manager (operasional penuh), Crew (input produksi/absen, akses sangat terbatas), Customer (form publik tanpa login).

---

## 2. Tech Stack (Final)

| Layer | Pilihan | Catatan |
|---|---|---|
| Framework | Next.js 15 (App Router) | Lanjutkan dari boilerplate yang sudah ada |
| Bahasa | TypeScript (strict mode) | |
| Database | Firestore | Real-time listener untuk stok & alerts |
| Auth | Firebase Auth | Custom claim untuk role; username diterjemahkan ke email internal (`username@anchur.internal`) |
| Backend Logic | Next.js API Routes (bukan Cloud Functions) | Pakai Firebase Admin SDK, bukan client SDK langsung |
| Storage | Firebase Storage | Untuk foto bukti transfer & PDF invoice |
| Hosting | Vercel | |
| Styling | Tailwind CSS (sudah ada di boilerplate) | Pertahankan struktur `components/ui` yang sudah ada |
| PDF Generation | Library bebas pilih Claude Code (misal `@react-pdf/renderer` atau `pdf-lib`) | Untuk invoice |

**Environment variables yang dibutuhkan** (buat `.env.local.example` di awal):
```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
```

---

## 3. Struktur Folder yang Diharapkan

Pertahankan pola yang sudah ada di boilerplate (`app/`, `components/ui/`, `components/layout/`, `components/shared/`, `lib/`), dengan tambahan:

```
app/
  api/                    -- SEMUA API routes (lihat API_Routes_Breakdown.md)
    auth/
    products/
    ingredients/
    ...
  (owner)/                -- route group, halaman khusus Owner
  (manager)/               -- route group, halaman khusus Manager
  (crew)/                  -- route group, halaman khusus Crew
  order/                   -- halaman publik, TANPA route group (no auth)
lib/
  firebase-admin.ts        -- inisialisasi Admin SDK (server-only)
  firebase-client.ts       -- inisialisasi client SDK (untuk realtime listener)
  auth-middleware.ts        -- requireRole() helper
  ip-helper.ts
  computed.ts               -- HPP, stok produk jadi, dst (lihat Computed Values di data model)
  unit-conversion.ts         -- helper convert satuan (kg<->gram, dst)
types/
  index.ts                  -- ganti total sesuai entities baru (Product, Ingredient, Order, dst -- BUKAN entities lama Material/Production yang ada di boilerplate)
```

**Routing per role:** gunakan **Next.js route groups** `(owner)`, `(manager)`, `(crew)` agar mudah taruh middleware/layout berbeda per grup, TANPA mengubah URL (route group tidak muncul di path).

---

## 4. Yang HARUS Dibuang dari Boilerplate

Boilerplate sekarang (`CuanPOS`) punya struktur data single-product yang TIDAK sesuai kebutuhan Anchur. Sebelum mulai, hapus/ganti total:

- `lib/mock-data.ts` — seluruh isi tidak relevan (single product "Churros Pack"), ganti dengan fetch dari Firestore
- `types/index.ts` — interface `Material`, `Product`, `Production`, `Transaction`, `Recipe` di boilerplate TIDAK sesuai skema baru (lihat `Firestore_Data_Model.md` untuk skema benar)
- Halaman `app/inventory/`, `app/pos/`, `app/production/`, `app/reports/` — strukturnya bisa dipertahankan SEBAGAI REFERENSI POLA UI (card style, layout, dst), tapi logic & data di dalamnya harus dirombak total
- Konsep "1 produk single avgCost" di seluruh boilerplate tidak berlaku lagi (sekarang multi-produk, multi-varian, dengan HPP per varian)

**Yang BOLEH dipertahankan:**
- `components/ui/*` (Button, Card, Badge, Input, dst) — reusable, tidak perlu diubah
- `components/layout/*` (Header, PageWrapper, BottomNav pattern) — strukturnya bagus, tinggal sesuaikan menu per role
- `lib/utils.ts` (formatRupiah, formatDate, dst) — reusable
- Desain visual/tema (warna emerald, font, dst) — kecuali ada arahan ganti branding

---

## 5. Urutan Implementasi (Fase per Fase)

**PENTING untuk Claude Code:** Kerjakan SATU FASE PENUH sampai bisa di-test sebelum lanjut fase berikutnya. Jangan loncat-loncat antar fase.

### Fase 0 — Setup Fondasi
- [ ] Install Firebase SDK (`firebase`, `firebase-admin`)
- [ ] Setup `lib/firebase-admin.ts` dan `lib/firebase-client.ts`
- [ ] Buat `.env.local.example` dengan semua variable yang dibutuhkan
- [ ] Hapus `lib/mock-data.ts` dan isi lama `types/index.ts`
- [ ] Buat `types/index.ts` baru sesuai entities di `Firestore_Data_Model.md` (Product, Variant, Ingredient, Recipe, Customer, Expense, Production, PrePacking, StockOpname, Attendance, Order, Payroll, dst)

### Fase 1 — Auth & Role
- [ ] Implementasi `/api/auth/login` (username → email internal, verifikasi Firebase Auth)
- [ ] Implementasi `lib/auth-middleware.ts` dengan `requireRole()`
- [ ] Halaman Login (sederhana, 2 field: Username, Password)
- [ ] Setup custom claim role saat create user (lewat script/halaman admin sederhana dulu, manual OK untuk MVP)
- [ ] Route groups `(owner)`, `(manager)`, `(crew)` dengan redirect logic sesuai role setelah login
- **Test:** Bisa login sebagai 3 role berbeda, masing-masing redirect ke halaman yang benar

### Fase 2 — Master Data (Read-Only Dulu)
- [ ] `/api/products`, `/api/variants`, `/api/ingredients` (GET dulu saja)
- [ ] `/api/recipes` (GET)
- [ ] `/api/customers` (GET)
- [ ] Seed data awal ke Firestore (3 produk, 6 varian, ingredients dari Master Bahan lama, resep dari Sheets lama) — TANYAKAN ke user data seed yang akurat, jangan asumsi
- **Test:** Data master bisa di-fetch dan ditampilkan di halaman sederhana

### Fase 3 — Expenses & Stock Tracking
- [ ] `/api/expenses` (POST dengan unit conversion, GET)
- [ ] `lib/unit-conversion.ts`
- [ ] Endpoint edit `currentStock` langsung + `stockMovements` log otomatis
- [ ] Halaman Manager: Inventori > Pengeluaran (form + list)
- **Test:** Catat pengeluaran dengan satuan beda (kg vs gram), `currentStock` ingredient harus update benar

### Fase 4 — Produksi & Pre-Packing
- [ ] `/api/productions/batch` (multi-varian sekaligus, sesuai Flow 4)
- [ ] `/api/productions/loyang-pool`
- [ ] `/api/pre-packing` (dengan FIFO allocation)
- [ ] Halaman Crew: Produksi (chip multi-select + 2 input per varian)
- [ ] Halaman Crew: Pre-Packing (simplified form sesuai Flow 5)
- **Test:** Input produksi → cek `currentStock` ingredient berkurang sesuai resep. Pre-packing → cek `loyangRemaining` berkurang FIFO, stok produk jadi bertambah

### Fase 5 — Attendance & Payroll
- [ ] `/api/attendance/check-in`, `/api/attendance/check-out` dengan validasi IP
- [ ] `/api/settings/attendance` (whitelist self-heal)
- [ ] Halaman Crew: Absen (1 tombol besar)
- [ ] `/api/payroll/generate`, dengan logic `isLocked`
- [ ] Halaman Manager: Karyawan > Payroll
- **Test:** Absen dari IP whitelist sukses, dari IP lain gagal + self-heal record. Lembur dihitung per blok 1 jam dengan benar

### Fase 6 — POS, Orders, Rainbow Assembly
- [ ] `/api/orders` (cart-based, tier harga, needsProduction logic)
- [ ] `/api/rainbow-assembly/*` (preview, override, confirm)
- [ ] `/api/orders/public` (form, dengan rate limiting + auto-match phoneNumber)
- [ ] `/api/orders/:id/shipping`, `/api/orders/:id/invoice` (PDF generation)
- [ ] Halaman Manager: Kasir/POS, Rainbow Assembly, Detail Order
- [ ] Halaman publik: Form Pemesanan WhatsApp
- **Test:** Order dengan tier harga benar, Rainbow tidak langsung kurangi stok sampai di-approve, invoice PDF bisa di-generate & download

### Fase 7 — Stock Opname & Reviews
- [ ] `/api/stock-opname` (POST dengan partial check + packaged unit)
- [ ] `/api/stock-opname/:id/review` (dengan opsi adjustment)
- [ ] `/api/attendance/:id/resolve`
- [ ] Halaman Crew: Stock Opname
- [ ] Halaman Owner/Manager: Approval (3 tab)
- **Test:** Opname dengan bahan packaged (botol) convert benar, review dengan adjustment update `currentStock`

### Fase 8 — Dashboard, Alerts, Reports
- [ ] `/api/dashboard/today`, `/api/reports/pnl`, `/api/reports/monthly-summary`
- [ ] Realtime listener untuk `alerts` di dashboard Owner/Manager
- [ ] Halaman Dashboard (Owner & Manager)
- [ ] Halaman Laporan
- **Test:** P&L menghitung benar termasuk Biaya Promosi dari `stockAdjustments`

### Fase 9 — Stock Adjustments, Void, Polish
- [ ] `/api/stock-adjustments`
- [ ] `/api/orders/:id/void` (dengan Rainbow handling)
- [ ] Halaman Manager: Pengeluaran Stok Non-Penjualan, Pack Terbuka
- [ ] Review keseluruhan UX mobile (touch target, loading states)

---

## 6. Aturan Kerja untuk Claude Code

1. **Selalu baca 3 dokumen pendamping** untuk detail field/logic sebelum implementasi tiap fase — jangan menebak struktur data.
2. **Jangan buat fitur di luar scope** yang ada di 3 dokumen (misal jangan tambah fitur loyalty points, multi-bahasa, dst) kecuali diminta eksplisit.
3. **Tanya dulu kalau ada ambiguitas** — terutama soal: urutan field di Firestore index, library pihak ketiga mana yang dipakai (PDF, dst), styling detail yang tidak disebutkan di dokumen.
4. **Pertahankan Bahasa Indonesia** di semua UI text — dokumen-dokumen ini ditulis dengan label UI dalam Bahasa Indonesia (misal "Absen Masuk", bukan "Check In") karena penggunanya adalah Crew yang familiar Bahasa Indonesia sehari-hari.
5. **Mobile-first untuk halaman Crew & Customer** — touch target minimum 48px, hindari input teks panjang, prioritaskan dropdown/stepper/chip.
6. **Setiap fase harus bisa di-test secara independen** sebelum lanjut fase berikutnya — jangan menumpuk banyak fase tanpa verifikasi.
7. **Untuk data seed/testing**, gunakan data dummy yang masuk akal TAPI tanyakan ke user kalau butuh data master yang akurat (harga produk asli, daftar bahan baku asli, dst) — jangan mengasumsikan angka.

---

## 7. Hal yang Sengaja Belum Diputuskan (Diputuskan Saat Coding)

Ini bukan kelalaian — ini keputusan teknis level rendah yang lebih make sense diputuskan saat implementasi:

- Library spesifik untuk PDF generation
- Strategi caching (kalau dibutuhkan untuk performance)
- Unit testing framework (boleh skip untuk MVP, tambahkan kalau diminta)
- Struktur Firestore Security Rules detail (garis besar sudah ada di data model, syntax rules ditulis saat implementasi)
- Error handling & logging strategy detail

---

*Setelah membaca dokumen ini, lanjutkan ke `Firestore_Data_Model.md` untuk skema lengkap, lalu `API_Routes_Breakdown.md` untuk detail endpoint, lalu `UI_Breakdown_Per_Role.md` untuk detail halaman. Mulai dari Fase 0.*
