# AnchurPOS — Firestore Data Model
> Versi 1.0 — Breakdown skema database

---

## Prinsip Desain

1. **Denormalized di tempat yang masuk akal** — data yang sering dibaca bareng (misal nama produk + harga) disimpan langsung di transaksi, bukan di-join saat baca. Firestore nggak punya JOIN, jadi snapshot data penting di titik waktu transaksi.
2. **Collection per "tabel" Sheets** — sebagian besar 1:1 mapping dari struktur Sheets yang sudah battle-tested.
3. **Subcollection untuk data yang explosively grow** — misal item dalam 1 transaksi (cart), biar nggak bikin 1 dokumen jadi raksasa.
4. **Read realtime untuk stok & order**, read sekali untuk laporan historis (P&L, ringkasan bulanan) karena data itu jarang berubah setelah periode lewat.

---

## Collections

### 1. `users`
Role & profil. Auth pakai Firebase Auth, custom claim untuk role.

```typescript
users/{uid}
{
  name: string,
  email: string,
  role: 'owner' | 'manager' | 'crew',
  active: boolean,
  createdAt: Timestamp
}
```
> Customer TIDAK ada di sini — mereka akses form publik tanpa login (sesuai keputusan awal).

---

### 2. `products`
Mapping dari Master Produk.

```typescript
products/{productId}  // contoh id: "churros-frozen-regular"
{
  code: string,            // "CFR"
  name: string,            // "Churros Frozen Regular"
  description: string,
  packPerBatch: number,    // 16
  isActive: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Subcollection: `products/{productId}/priceTiers`**
Mapping dari tier harga (1-10 pack, 11-24 pack, dst).

```typescript
products/{productId}/priceTiers/{tierId}
{
  minQty: number,     // 1
  maxQty: number,     // 10  (null = no upper limit)
  price: number       // 15000
}
```

---

### 3. `variants`
Daftar varian rasa (global, dipakai semua produk).

```typescript
variants/{variantId}  // "original", "charcoal", dst
{
  name: string,          // "Original"
  isProductionVariant: boolean,  // true untuk Original-Charcoal-RedVelvet-Taro-Coklat-Greentea, false untuk Rainbow
  sortOrder: number
}
```

---

### 4. `ingredients`
Mapping dari Master Bahan. **Direvisi** — di Sheets, stok itu cuma bisa diakali lewat formula berlapis (`stockAwal + expenses - productions`) karena nggak ada cara aman buat "mengedit angka" tanpa ngerusak rumus. Di app, ini batasan yang nggak perlu dipertahankan — stok current bisa diedit langsung oleh Manager, dan histori perubahan otomatis tercatat di background untuk audit, tanpa Manager harus mikir bikin "entry koreksi" terpisah.

```typescript
ingredients/{ingredientId}  // "tepung-terigu"
{
  name: string,
  category: 'bahan_baku' | 'packaging' | 'operasional',
  baseUnit: string,        // "gram", "ml", "butir", "pcs", "lembar" -- satuan dasar untuk resep & HPP (TIDAK pernah berubah setelah dibuat)
  currentStock: number,    // stok SAAT INI dalam baseUnit -- field yang LANGSUNG di-update oleh transaksi (expenses +, productions -, manual edit)
  minStock: number,

  // --- Konversi satuan: beli boleh pakai satuan apa saja, sistem convert otomatis ke baseUnit ---
  unitAlternatives: [
    { unit: string, conversionToBase: number }
    // contoh untuk Tepung (baseUnit='gram'): [{ unit: 'kg', conversionToBase: 1000 }]
    // contoh untuk Minyak (baseUnit='ml'): [{ unit: 'liter', conversionToBase: 1000 }]
  ],

  // --- Khusus bahan dengan kemasan tidak transparan (misal botol perasa) ---
  opnameMethod: 'direct' | 'packaged',
  packagedConfig: {                 // HANYA ADA kalau opnameMethod = 'packaged'
    unitPerPackage: number,         // contoh: 300 (ml per botol, dalam baseUnit)
    packageLabel: string,           // "botol"
    fullnessOptions: [
      { label: 'Penuh', ratio: 1.0 },
      { label: 'Setengah', ratio: 0.5 },
      { label: 'Hampir Habis', ratio: 0.15 },
      { label: 'Kosong', ratio: 0 }
    ]
  } | null
}
```

> **Cara kerja `currentStock`:** Ini BUKAN field computed dari formula panjang seperti di Sheets — ini angka yang langsung dimutasi (increment/decrement) setiap ada transaksi terkait (pembelian, produksi, koreksi manual), dalam satu Firestore transaction biar konsisten. Hasilnya: stok current selalu up-to-date secara langsung, tidak perlu dihitung ulang dari histori setiap kali dibaca.
>
> **Cara kerja `unitAlternatives`:** Saat Manager catat pembelian, dia bisa pilih satuan apapun yang ada di `unitAlternatives` (misal "kg" untuk Tepung yang baseUnit-nya "gram"). Sistem otomatis convert: `qtyInBaseUnit = qtyInput * conversionToBase`, baru ditambahkan ke `currentStock`. Manager tidak perlu mikir konversi manual.
>
> **Histori perubahan stok:** Disimpan otomatis di collection `stockMovements` (lihat di bawah) setiap kali `currentStock` berubah — termasuk dari pembelian, produksi, ATAU edit manual langsung. Manager tidak perlu membuat entry terpisah seperti `stockCorrections` di desain sebelumnya — cukup edit angka, sistem yang mencatat jejaknya.

---

### 4b. `stockMovements`
**Baru** — log otomatis SETIAP perubahan `currentStock`, untuk audit trail. Dibuat otomatis oleh sistem, tidak pernah diinput manual oleh user.

```typescript
stockMovements/{movementId}
{
  ingredientId: string,
  changeAmount: number,        // bisa positif (masuk) atau negatif (keluar), dalam baseUnit
  newStockAfter: number,        // currentStock setelah perubahan ini (snapshot)
  sourceType: 'expense' | 'production' | 'manual_edit' | 'stock_opname_adjustment',
  sourceId: string | null,      // id dokumen expenses/productions terkait, null kalau manual_edit
  note: string | null,          // catatan, misal "Hasil review opname tanggal X" atau alasan edit manual
  createdBy: string,            // uid yang memicu (sistem otomatis untuk expense/production, manager untuk manual_edit)
  createdAt: Timestamp
}
```

---

### 5. `recipes`
Mapping dari Resep Produk — BOM per batch.

```typescript
recipes/{recipeId}
{
  productId: string,       // reference ke products
  variantId: string,       // reference ke variants, atau "all" untuk base
  ingredientId: string,
  qtyPerBatch: number,
  unit: string
}
```
> Query: `where('productId', '==', x).where('variantId', 'in', ['all', selectedVariant])`

---

### 6. `customers`
Mapping dari Master Pelanggan.

```typescript
customers/{customerId}
{
  name: string,            // "Deu Coffee - Dago"
  channel: 'b2b' | 'shopee' | 'whatsapp' | 'reseller' | 'tiktok' | 'walk_in',
  phoneNumber: string | null,   // untuk auto-matching saat order masuk lewat Form Pemesanan WhatsApp
  address: string | null,       // alamat pengiriman terakhir, auto-update kalau customer ubah saat order
  discountPerUnit: number,
  notes: string,
  isActive: boolean,
  createdVia: 'manual' | 'wa_form'  // 'wa_form' = otomatis tercipta dari order publik pertama kali
}
```

> **Auto-matching:** Saat customer isi No HP di Form Pemesanan WhatsApp, sistem cek `customers WHERE phoneNumber = X`. Kalau cocok, pakai data lama (termasuk `discountPerUnit`). Kalau tidak ada yang cocok, sistem otomatis buat entry baru dengan `channel: 'walk_in'`, `createdVia: 'wa_form'` — Manager bisa reklasifikasi channel-nya nanti kalau perlu (misal jadi `'b2b'` resmi).

---

### 7. `expenses`
Mapping dari Pengeluaran. **Direvisi** — satuan pembelian sekarang bebas (kg, gram, liter, dst, sesuai cara Manager biasa beli), sistem yang convert otomatis ke `baseUnit` bahan tersebut.

```typescript
expenses/{expenseId}
{
  date: Timestamp,
  category: 'bahan_baku' | 'packaging' | 'operasional' | 'lain_lain',
  ingredientId: string | null,   // null kalau bukan bahan tracked (misal air galon)
  itemName: string,              // snapshot nama, untuk display tanpa join
  qtyPurchased: number,           // qty SESUAI satuan beli, misal 5 (untuk "5 kg")
  purchaseUnit: string,           // satuan yang dipakai SAAT BELI, misal "kg" -- bebas, tidak harus sama dengan baseUnit
  qtyInBaseUnit: number,          // computed: qtyPurchased * conversionToBase (dari ingredient.unitAlternatives) -- INI yang dipakai update currentStock
  totalPrice: number,
  pricePerBaseUnit: number,       // computed: totalPrice / qtyInBaseUnit -- untuk hitung HPP yang presisi
  paymentMethod: 'cash' | 'transfer' | 'qris',
  supplier: string,
  notes: string,
  createdBy: string,              // uid
  createdAt: Timestamp
}
```

---

### 8. `productions`
**Direvisi total** — produksi sekarang menghasilkan **loyang** (bukan langsung pack), dan loyang tersebut masuk ke "pool" stok mentah per varian yang dilacak per tanggal (untuk FIFO). Pre-packing ke pack (Regular/Full) jadi **tahap terpisah**, bisa dilakukan kapan saja, bisa gabungan dari beberapa hari produksi.

```typescript
productions/{productionId}
{
  date: Timestamp,              // tanggal produksi
  variantId: string,
  batches: number,              // 4.5 -- untuk hitung bahan baku saja
  loyangCount: number,          // jumlah loyang hasil cetak -- TIDAK dihitung otomatis dari batches,
                                 // diisi manual karena hasil cetak tidak konsisten (skill crew berbeda)
  loyangRemaining: number,      // sisa loyang dari batch ini yang belum di-prepack (computed, berkurang saat prepack)
  notes: string,
  shiftCrewId: string,          // uid crew yang input (1 sesi input akhir shift)
  createdAt: Timestamp          // timestamp input, untuk audit "kapan sebenarnya diinput"
}
```

> **Catatan penting:** `loyangCount` TIDAK dihitung dari `batches × konstanta` — ini input manual dari crew karena hasil cetak per loyang tidak konsisten (tergantung skill crew). `batches` dipakai HANYA untuk menghitung konsumsi bahan baku (lewat `recipes`). Dua angka ini independen satu sama lain.

**Input akhir shift (1 dokumen per varian yang dikerjakan hari itu):**
```
Crew pilih varian via multi-select chip → untuk tiap varian yang dipilih,
isi batches + loyangCount → submit semua sekaligus dalam 1 request.
```

---

### 8b. `prePacking`
**Baru** — tahap terpisah yang menarik dari pool loyang (collection `productions`, field `loyangRemaining`) dan menghasilkan stok produk jadi (Regular/Full). Bisa dilakukan kapan saja, oleh siapa saja, menggabungkan loyang dari beberapa tanggal produksi berbeda.

```typescript
prePacking/{prePackingId}
{
  date: Timestamp,                 // tanggal pre-packing dilakukan (BUKAN tanggal produksi)
  variantId: string,
  sourceProductions: [             // loyang dari produksi mana saja yang dipakai (FIFO)
    { productionId: string, productionDate: Timestamp, loyangUsed: number }
  ],
  totalLoyangUsed: number,         // computed: SUM(sourceProductions.loyangUsed)
  resultRegularPacks: number,      // jadi berapa pack Regular (isi 12)
  resultFullPacks: number,         // jadi berapa pack Full (isi 16)
  crewId: string,
  createdAt: Timestamp
}
```

**Alur kerja pre-packing:**
```
1. User (crew/manager) pilih varian, misal "Original"
2. Sistem tampilkan loyang yang tersedia untuk varian itu, diurut FIFO
   (dari productions WHERE variantId=X AND loyangRemaining > 0, ORDER BY date ASC)
   Contoh tampilan: "18 Jun: 5 loyang tersisa | 19 Jun: 9 loyang tersisa"
3. User input: total loyang yang dipakai sekarang, lalu hasil jadi
   berapa pack Regular dan berapa pack Full
4. Sistem otomatis "ambil" loyang dari yang PALING LAMA dulu (FIFO) untuk
   mengisi sourceProductions, sampai totalLoyangUsed terpenuhi
5. Sistem update loyangRemaining di setiap dokumen productions yang terpakai
6. Sistem tambah stok produk jadi: Regular += resultRegularPacks, Full += resultFullPacks
```

---

### 8c. `openPacks`
**Baru** — menampung sisa pack yang sudah "dibongkar sebagian" (misal untuk assembly Rainbow). Pack yang sudah disentuh TIDAK dihitung lagi sebagai stok pack utuh — perlu ditangani manual oleh Manager.

```typescript
openPacks/{openPackId}
{
  productId: string,            // 'churros-frozen-regular'
  variantId: string,
  originalPackSize: number,     // 12 atau 16
  remainingPcs: number,         // sisa pcs setelah sebagian diambil
  sourceOrderId: string,        // order (biasanya Rainbow) yang menyebabkan pembongkaran
  status: 'open' | 'resolved',  // resolved = sudah di-assign ulang/dipakai lagi
  resolvedAction: string | null,// catatan bagaimana ditangani, misal "digabung ke Rainbow order ORD-xxx"
  createdAt: Timestamp,
  resolvedAt: Timestamp | null
}
```

> **Penting:** Pack yang masuk ke `openPacks` otomatis DIKELUARKAN dari hitungan `stokTersedia` produk normal (Regular/Full). Manager harus aktif menyelesaikan (resolve) item ini — sistem tidak otomatis menggabungkan kembali.

---

### 9. `stockOpname`
Baru — fitur yang diminta khusus untuk crew di awal shift.

```typescript
stockOpname/{opnameId}
{
  date: Timestamp,
  shiftType: 'pagi' | 'siang' | 'malam',
  crewId: string,                // uid
  items: [                       // HANYA bahan yang sempat dicek -- boleh tidak lengkap/skip sebagian
    {
      ingredientId: string,
      inputMethod: 'direct' | 'packaged',   // disalin dari ingredient.opnameMethod saat input

      // --- kalau inputMethod = 'direct' ---
      physicalStock: number | null,         // hasil hitung langsung dalam satuan sistem (gram/ml/dst)

      // --- kalau inputMethod = 'packaged' ---
      fullPackages: number | null,          // jumlah botol/kemasan PENUH yang masih tersegel
      openPackageFullness: string | null,   // label dari fullnessOptions, misal "Setengah" -- HANYA untuk 1 botol yang sedang dibuka/dipakai
      physicalStockConverted: number | null,// computed di server: (fullPackages * unitPerPackage) + (fullnessRatio * unitPerPackage)

      systemStock: number,       // angka sistem saat opname dilakukan (selalu dalam satuan sistem/ml/gram)
      difference: number,        // computed: (physicalStock ATAU physicalStockConverted) - systemStock
    }
  ],
  totalIngredientsChecked: number,   // computed: items.length, untuk tau cakupan opname ini
  totalIngredientsAll: number,       // computed: total bahan aktif saat itu, untuk perbandingan ("8 dari 19")
  hasDiscrepancy: boolean,        // true kalau ADA item (dari yang dicek) dengan difference != 0
  reviewedBy: string | null,      // uid manager, null kalau belum direview
  reviewedAt: Timestamp | null,
  reviewAction: 'acknowledge' | 'adjusted' | null,  // ringkasan tindakan saat review
  createdAt: Timestamp
}
```
> Kalau `hasDiscrepancy = true`, sistem buat dokumen baru di collection `alerts` (type: `stock_opname_discrepancy`) — lihat detail di bagian 9d.
>
> **Penyesuaian stok dari review:** Kalau Manager pilih "Sesuaikan ke Angka Fisik" untuk suatu item, sistem langsung set `ingredient.currentStock = physicalStock` (atau `physicalStockConverted`), dan otomatis tercatat di `stockMovements` dengan `sourceType: 'stock_opname_adjustment'`, `sourceId: <id opname ini>`. Tidak ada collection terpisah yang dibutuhkan — `currentStock` memang dirancang untuk bisa diedit langsung (lihat bagian 4).

---

### 9b. `attendance`
Baru — absen masuk/pulang dengan validasi IP WiFi, dasar perhitungan payroll otomatis.

```typescript
attendance/{attendanceId}  // format id: "2026-06-20_aldhy"
{
  date: string,              // "2026-06-20"
  employeeId: string,        // uid
  employeeName: string,      // snapshot
  checkIn: {
    time: Timestamp,
    ipAddress: string,
    ipValid: boolean          // hasil cek terhadap whitelist IP rumah produksi
  },
  checkOut: {
    time: Timestamp | null,   // null = belum absen pulang
    ipAddress: string | null,
    ipValid: boolean | null
  } | null,
  totalHours: number | null,        // computed setelah checkOut ada: (checkOut - checkIn) dalam jam
  regularHours: number | null,      // min(totalHours, 8)
  overtimeHours: number | null,     // raw: max(0, totalHours - 8), disimpan untuk audit/referensi
  overtimeBlocks: number | null,    // floor(overtimeHours / 1) -- jumlah blok penuh 1 jam
  overtimeBonus: number | null,     // computed: overtimeBlocks * 10000 (BUKAN prorata per menit)
  status: 'belum_lengkap' | 'lengkap' | 'direview',
  // belum_lengkap = sudah check-in, belum check-out
  // lengkap = check-in + check-out valid, otomatis masuk payroll
  // direview = ada anomali (IP tidak valid saat checkout, dll), nunggu manager
  flaggedReason: string | null,    // contoh: "Check-out dari IP tidak dikenal"
  reviewedBy: string | null,        // uid manager kalau status='direview' lalu di-resolve
  reviewedAt: Timestamp | null,
  createdAt: Timestamp
}
```

**Validasi IP saat absen (di API route, bukan client):**
```typescript
async function validateAttendance(requestIp: string) {
  const config = await getDoc('settings/attendanceConfig');
  const isValid = config.whitelistedIps.includes(requestIp);

  if (!isValid) {
    // Self-heal: catat IP yang gagal, biar Manager bisa lihat & approve
    await updateDoc('settings/attendanceConfig', {
      lastDetectedIp: requestIp,
      lastDetectedAt: serverTimestamp()
    });
  }
  return isValid;
}
```
> IndiHome (provider rumah produksi) pakai IP dinamis tanpa fitur DDNS di modem bawaan. Solusi yang dipakai: **Opsi C "self-heal manual"** — lihat collection `settings` di bawah, bukan hardcode IP statis.

**Alur status:**
```
Check-in (IP valid) → status: belum_lengkap
Check-out (IP valid) → status: lengkap → totalHours, overtimeBonus dihitung → masuk payroll
Check-out (IP tidak valid) → status: direview → flaggedReason terisi → manager review manual
Tidak ada check-out sampai akhir hari → tetap belum_lengkap → TIDAK masuk payroll sampai direview
```

---

### 9c. `settings`
Baru — konfigurasi sistem, termasuk whitelist IP untuk absen (Opsi C: self-heal manual oleh Manager).

```typescript
settings/attendanceConfig  // single document, bukan collection besar
{
  whitelistedIps: string[],        // ["xxx.xxx.xxx.xxx"], bisa lebih dari 1 untuk transisi
  lastDetectedIp: string | null,   // IP terakhir yang request tapi gagal validasi
  lastDetectedAt: Timestamp | null,
  updatedBy: string,               // uid manager yang terakhir update
  updatedAt: Timestamp
}
```

**Alur self-heal:**
```
1. Crew coba absen dari rumah produksi → API route cek IP request
2. IP TIDAK ada di whitelistedIps → absen gagal, TAPI:
   - lastDetectedIp & lastDetectedAt diupdate ke IP yang barusan dicoba
   - Crew lihat pesan: "Absen gagal, hubungi Manager"
3. Manager buka halaman Admin → Pengaturan Absen
   → lihat banner: "IP baru terdeteksi: xxx.xxx.xxx.xxx, dicoba 2 menit lalu"
   → klik "Tambahkan ke Whitelist"
4. whitelistedIps bertambah → Crew coba absen lagi → berhasil
```
> Manager bisa juga manual hapus IP lama dari whitelist kalau mau strict (cuma 1 IP aktif), atau biarkan beberapa IP lama menumpuk untuk jaga-jaga IP balik lagi (ISP kadang reuse range IP yang sama).

---

### 9e. `settings/businessInfo`
**Baru** — data statis bisnis untuk keperluan invoice PDF (rekening, nama, dll), supaya tidak hardcode di kode dan bisa diubah Manager kalau ada perubahan (misal ganti rekening).

```typescript
settings/businessInfo  // single document
{
  businessName: string,        // "Anchur"
  logoUrl: string,              // link logo untuk header invoice/PDF
  bankAccounts: [
    { bankName: string, accountNumber: string, accountHolder: string }
    // contoh: { bankName: "BCA", accountNumber: "6395479567", accountHolder: "Anindya Azzahra" }
  ],
  invoiceFooterNote: string,    // "Jangan lupa kirimkan bukti transfer agar pesanan bisa langsung diproses"
  updatedBy: string,
  updatedAt: Timestamp
}
```

---

### 9d. `alerts`
Baru — pusat notifikasi realtime untuk Owner/Manager. Dipakai lintas fitur (produksi, stock opname, attendance).

```typescript
alerts/{alertId}
{
  type: 'stock_warning_production' | 'stock_opname_discrepancy' | 'attendance_review',
  severity: 'warning' | 'info',
  title: string,                 // "Stok Mentega menipis"
  message: string,                // "Setelah produksi Red Velvet oleh Aldhy, stok Mentega kemungkinan kurang"
  sourceCollection: string,       // "productions" | "stockOpname" | "attendance"
  sourceId: string,               // id dokumen terkait, untuk deep-link
  isRead: boolean,
  readBy: string | null,          // uid manager/owner yang sudah lihat
  readAt: Timestamp | null,
  createdAt: Timestamp
}
```

> **Realtime:** Owner & Manager subscribe ke `alerts WHERE isRead=false ORDER BY createdAt DESC` saat dashboard terbuka. Badge counter di nav menunjukkan jumlah alert belum dibaca.

---

### 10. `orders`
Gabungan dari Transaksi (Sheets) + order flow baru (status, marketplace vs WA vs form).

```typescript
orders/{orderId}
{
  orderNumber: string,           // auto-generated, format: ORD-20260620-0001
  source: 'marketplace_manual' | 'wa_form' | 'walk_in',  // cara masuknya
  customerId: string,
  customerName: string,          // snapshot
  customerPhone: string | null,  // snapshot, dari form atau input manual
  channel: string,                // snapshot dari customer
  status: 'belum_selesai' | 'selesai',
  paymentStatus: 'belum_bayar' | 'sudah_bayar',
  paymentMethod: 'cash' | 'transfer' | 'qris' | null,
  needsProduction: boolean,       // true kalau stok kurang saat order masuk
  createdBy: string | null,       // uid staff, null kalau dari form publik
  createdAt: Timestamp,
  completedAt: Timestamp | null,

  // --- Khusus order dengan pengiriman (umumnya dari Form Pemesanan WA) ---
  shippingAddress: string | null,
  requestedDeliveryDate: Timestamp | null,   // wajib diisi kalau source='wa_form'
  orderNotes: string | null,                 // "Keterangan Pesanan" dari customer
  proofOfTransferUrl: string | null,         // opsional, link foto bukti transfer kalau di-upload
  shippingCost: number | null,               // SELALU diisi manual belakangan oleh Manager/Owner,
                                              // TIDAK dihitung otomatis saat order dibuat
  shippingCostConfirmed: boolean,            // default false, jadi true setelah Manager set shippingCost

  // --- Invoice PDF ---
  invoiceNumber: string | null,    // auto-generated saat invoice pertama kali dibuat, format: INV-20260620-0001
  invoiceGeneratedAt: Timestamp | null,
  invoiceUrl: string | null        // link ke PDF tersimpan (Firebase Storage), untuk re-download tanpa generate ulang
}
```

**Catatan desain penting:** `shippingCost` SENGAJA tidak dihitung sistem — ongkir untuk Anchur sering perlu judgement manual (kadang nombok, tergantung kurir/jarak). Sistem cukup catat pesanan produknya akurat; ongkir jadi obrolan/keputusan manual yang di-update belakangan via halaman order detail.

**Subcollection: `orders/{orderId}/items`** (cart items — ini yang bikin POS jadi cart-based)
```typescript
orders/{orderId}/items/{itemId}
{
  productId: string,
  productName: string,        // snapshot
  variantId: string,
  variantName: string,        // snapshot
  qty: number,
  basePrice: number,          // harga dasar saat transaksi (snapshot, sebelum diskon)
  appliedTier: string,        // tier harga yang dipakai, untuk audit
  discountPerUnit: number,
  totalPrice: number,         // computed: qty * (basePrice - discountPerUnit)
  hppPerUnit: number,         // snapshot HPP saat transaksi
  totalHpp: number,           // computed: qty * hppPerUnit
  margin: number,              // computed: totalPrice - totalHpp

  // --- KHUSUS produk Rainbow ---
  assemblyStatus: 'pending_approval' | 'completed' | null,  // null untuk produk non-Rainbow
  rainbowSourceBreakdown: [     // detail asal tiap varian, diisi setelah Manager approve
    { variantId: string, source: 'pack_jadi' | 'pool_loyang' | 'shortage',
      amountTaken: number, needsProduction: boolean }
  ] | null
}
```

> **Rainbow order:** dicatat sebagai 1 item dengan `productId: "churros-rainbow"`, `variantId: "rainbow"`, plus field `assemblyStatus: 'pending_approval' | 'completed'`. Stok 6 varian individual **DIKURANGI** lewat proses approval terpisah (lihat Flow Rainbow Assembly) — bukan otomatis saat order dibuat, tapi juga bukan diabaikan seperti versi awal. Detail breakdown sumber tersimpan di `rainbowSourceBreakdown` (lihat di bawah).

---

### 10c. `stockAdjustments`
**Baru** — pengeluaran stok produk jadi yang BUKAN penjualan (sample affiliate, hadiah teman, bonus kerabat, dll). Tetap tercatat sebagai biaya (mengurangi laba di P&L), tapi terpisah dari `orders` karena tidak ada uang masuk.

```typescript
stockAdjustments/{adjustmentId}
{
  date: Timestamp,
  productId: string,          // 'churros-frozen-regular'
  variantId: string,
  qty: number,                 // pack yang dikeluarkan
  reasonCategory: 'sample_affiliate' | 'hadiah_bonus' | 'rusak_reject' | 'konsumsi_internal' | 'lainnya',
  reasonCustom: string | null,  // diisi kalau reasonCategory='lainnya', atau catatan tambahan
  recipientName: string | null, // opsional, misal nama affiliate/teman/kerabat
  hppPerUnit: number,          // snapshot HPP saat itu
  totalCost: number,           // computed: qty * hppPerUnit -- ini yang masuk P&L sebagai biaya promosi
  createdBy: string,           // uid (owner/manager yang input)
  createdAt: Timestamp
}
```

> **Dampak ke stok:** `stockAdjustments` MENGURANGI stok produk jadi (Regular/Full) sama seperti penjualan biasa, jadi harus diikutkan dalam formula `stokTersedia`. **Dampak ke P&L:** `totalCost` dari semua adjustment dalam 1 bulan masuk sebagai baris "Biaya Promosi/Sample" di Laba Rugi — mengurangi laba bersih, terpisah dari Biaya Operasional biasa.

---

### 11. `payroll`
Mapping dari Gaji Karyawan. Sekarang dihitung **otomatis dari attendance**, bukan input manual hari kerja.

```typescript
payroll/{payrollId}  // format id: "2026-06_aldhy"
{
  month: string,          // "2026-06"
  employeeId: string,     // uid
  employeeName: string,   // snapshot
  workDays: number,           // computed: COUNT(attendance WHERE status='lengkap', month=X)
  dailyWage: number,
  totalRegularPay: number,    // computed: workDays * dailyWage
  totalOvertimeBonus: number, // computed: SUM(attendance.overtimeBonus WHERE status='lengkap', month=X)
  performanceBonus: number,   // bonus manual dari manager (terpisah dari lembur), default 0
  totalPaid: number,          // computed: totalRegularPay + totalOvertimeBonus + performanceBonus
  pendingReview: number,      // COUNT(attendance WHERE status='direview', month=X) — info buat manager
  dataStatus: 'parsial' | 'final',  // 'parsial' kalau pendingReview > 0 saat generate, 'final' kalau bersih
  status: 'belum_dibayar' | 'sudah_dibayar',
  paidAt: Timestamp | null,
  isLocked: boolean            // true setelah status='sudah_dibayar' -- generate ulang akan SKIP dokumen ini
}
```

> **Catatan penting:** `workDays` dan bonus lembur sekarang ditarik dari collection `attendance`, bukan diinput manual. Manager cukup isi `performanceBonus` kalau ada bonus tambahan di luar lembur (misal bonus capai target produksi). Sebelum generate payroll bulanan, manager perlu cek `pendingReview` — kalau ada absen yang masih "direview", payroll belum final.
>
> **Aturan re-generate:** Generate ulang untuk bulan yang sama akan menimpa dokumen payroll yang `isLocked=false`. Dokumen dengan `isLocked=true` (sudah dibayar) dilewati/tidak disentuh — datanya permanen untuk keperluan audit.

---

## Computed Values vs Direct Mutation

Penting dibedakan dua pendekatan yang dipakai di sistem ini:

**Direct mutation (langsung dibaca, TIDAK perlu dihitung ulang):**
```typescript
// Stok bahan baku saat ini -- LANGSUNG dari field ingredient.currentStock
// Diupdate via Firestore transaction setiap ada expense/production/manual edit,
// BUKAN dihitung ulang dari histori setiap kali dibaca (beda dari pendekatan Sheets)
stokBahanSaatIni = ingredient.currentStock  // baca langsung, sudah pasti up-to-date
```

**Computed (dihitung saat dibutuhkan, di API route):**
```typescript
// HPP produk per pack
hppPerPack = SUM(recipes WHERE productId = X AND variantId = 'all', qtyPerBatch * ingredient.currentPricePerBaseUnit) / packPerBatch

// Harga bahan terbaru (rata-rata tertimbang dari semua pembelian)
currentPricePerBaseUnit = SUM(expenses.totalPrice WHERE ingredientId = X) / SUM(expenses.qtyInBaseUnit WHERE ingredientId = X)

// Stok loyang (pool mentah) per varian -- untuk ditampilkan saat mau pre-packing
loyangTersedia(variantId) = SUM(productions.loyangRemaining WHERE variantId = X)
// Detail FIFO untuk UI pre-packing:
loyangPerTanggal(variantId) = productions WHERE variantId=X AND loyangRemaining>0 ORDER BY date ASC

// Stok produk jadi per varian (Regular & Full terpisah, dari hasil prePacking)
producedRegularPacks = SUM(prePacking.resultRegularPacks WHERE variantId = X)
producedFullPacks = SUM(prePacking.resultFullPacks WHERE variantId = X)
soldRegularPacks = SUM(orders/items WHERE variantId = X, productId = 'churros-frozen-regular', order.status != 'void')
soldFullPacks = SUM(orders/items WHERE variantId = X, productId = 'churros-frozen-full', order.status != 'void')
adjustedRegularPacks = SUM(stockAdjustments.qty WHERE variantId = X, productId = 'churros-frozen-regular')
adjustedFullPacks = SUM(stockAdjustments.qty WHERE variantId = X, productId = 'churros-frozen-full')
stokRegularTersedia = producedRegularPacks - soldRegularPacks - adjustedRegularPacks
stokFullTersedia = producedFullPacks - soldFullPacks - adjustedFullPacks

// Attendance → Payroll (dihitung saat generate payroll bulanan)
totalHours = (checkOut.time - checkIn.time) dalam jam
regularHours = MIN(totalHours, 8)
overtimeHours = MAX(0, totalHours - 8)              // raw, untuk audit
overtimeBlocks = FLOOR(overtimeHours / 1)            // hanya blok 1 jam penuh yang dibayar
overtimeBonus = overtimeBlocks * 10000               // BUKAN prorata -- per blok genap
// Contoh: kerja 9j15m → overtimeHours=1.25 → overtimeBlocks=1 → bonus Rp10.000
//         kerja 10j00m → overtimeHours=2.0 → overtimeBlocks=2 → bonus Rp20.000
workDays = COUNT(attendance WHERE employeeId = X, month = Y, status = 'lengkap')
totalRegularPay = workDays * dailyWage
totalOvertimeBonus = SUM(attendance.overtimeBonus WHERE employeeId = X, month = Y, status = 'lengkap')
```

**Kenapa nggak disimpan sebagai field?** Karena kalau disimpan, butuh trigger update di banyak tempat tiap kali ada expense/production/order baru — rawan inconsistent. Dihitung on-demand lebih aman untuk skala Anchur sekarang. Kalau nanti datanya udah ribuan dokumen dan query jadi lambat, baru pertimbangkan denormalize pakai Cloud Functions trigger.

---

## Index yang Dibutuhkan (Firestore Composite Index)

```
recipes: productId ASC, variantId ASC
expenses: ingredientId ASC, date ASC
productions: variantId ASC, date ASC
orders/items: productId ASC, variantId ASC
orders: status ASC, createdAt DESC
payroll: month ASC, employeeId ASC
```

---

## Role-Based Access (Firestore Security Rules — garis besar)

```
owner:    read/write semua collection
manager:  read/write semua collection
crew:     read products, variants, ingredients (stok read-only)
          write productions, stockOpname (hanya milik sendiri)
          write attendance check-in/check-out (hanya milik sendiri, via API route dengan validasi IP)
          read attendance milik sendiri saja
          TIDAK BISA read: expenses (harga beli), orders (harga jual), payroll
customer: TIDAK ADA akses Firestore langsung — hanya lewat API route publik
          yang submit ke collection `orders` dengan validasi server-side
```

> **Penting:** Validasi IP untuk attendance HARUS dilakukan di API route (server-side), bukan client-side. Kalau divalidasi di browser, crew bisa lihat source code dan tahu IP yang di-whitelist, lalu pakai VPN/proxy untuk spoofing. API route baca `request.headers['x-forwarded-for']` dari Vercel (IP asli klien), cocokkan ke whitelist, baru izinkan write ke Firestore via Admin SDK.

---

## Yang Berubah dari Sheets ke Firestore

| Konsep di Sheets | Konsep di Firestore |
|---|---|
| Baris di 1 sheet besar | Dokumen di 1 collection |
| VLOOKUP / SUMIF antar sheet | Query + computed value di API route |
| Semua orang bisa lihat semua sheet | Security Rules per role |
| Formula auto-update | Realtime listener (client) atau on-demand calc (API route) |
| Dropdown dari Master | Reference field + lookup saat render |
| Marker "INPUT MANUAL" | Tidak perlu — setiap dokumen baru otomatis "input area" |

---

*Dokumen ini jadi acuan saat menulis API routes dan komponen React. Update kalau ada perubahan skema.*
