# AnchurPOS — API Routes Breakdown
> Versi 1.0 — Next.js App Router API Routes (app/api/...)
> Semua route pakai Firebase Admin SDK di server, bukan client SDK langsung ke Firestore.

---

## Prinsip Umum

1. **Setiap route cek role dulu** sebelum proses — middleware `requireRole(['owner','manager'])` dsb.
2. **Customer-facing routes** (Form Pemesanan WhatsApp) tidak butuh auth, tapi tetap divalidasi ketat di server (rate limiting, sanitasi input).
3. **Computed values** (HPP, stok, dll) dihitung di route, tidak di-trust dari client.
4. **Atomic writes** pakai Firestore transaction/batch untuk operasi yang ubah banyak dokumen sekaligus (misal: order masuk → stok berkurang).

---

## 1. Auth & Session

| Method | Route | Role | Fungsi |
|---|---|---|---|
| POST | `/api/auth/login` | public | Login via Firebase Auth, return custom token dengan role claim |
| POST | `/api/auth/logout` | semua | Invalidate session |
| GET | `/api/auth/me` | semua | Return profil + role user yang login |

---

## 2. Products & Variants

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/products` | semua (termasuk public, untuk Form Pemesanan WhatsApp) | List semua produk aktif + tier harga |
| GET | `/api/products/:id` | semua | Detail 1 produk + HPP computed |
| POST | `/api/products` | owner, manager | Tambah produk baru |
| PATCH | `/api/products/:id` | owner, manager | Edit produk (nama, harga dasar, dll) |
| DELETE | `/api/products/:id` | owner | Soft-delete (set isActive=false) |
| GET | `/api/variants` | semua | List varian (Original, Charcoal, dst) |

---

## 3. Ingredients & Stock

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/ingredients` | owner, manager, crew (read-only) | List bahan + `currentStock` (baca langsung, tidak perlu hitung ulang) |
| GET | `/api/ingredients/:id` | owner, manager, crew | Detail 1 bahan + histori `stockMovements` |
| POST | `/api/ingredients` | owner, manager | Tambah bahan baru, termasuk `unitAlternatives` untuk konversi satuan |
| PATCH | `/api/ingredients/:id` | owner, manager | Edit metadata (nama, minStock, unitAlternatives, dll) |
| PATCH | `/api/ingredients/:id/stock` | owner, manager | **Edit langsung `currentStock`** -- untuk koreksi cepat tanpa lewat opname formal |
| GET | `/api/ingredients/low-stock` | owner, manager | List bahan yang stoknya di bawah minStock (untuk alert dashboard) |

**Detail logic PATCH `/api/ingredients/:id/stock`:**
```
1. Terima: { newStock, note }
2. Ambil currentStock lama
3. changeAmount = newStock - currentStock lama
4. Firestore transaction:
   - Update ingredient.currentStock = newStock
   - Tulis dokumen baru ke stockMovements:
     { ingredientId, changeAmount, newStockAfter: newStock,
       sourceType: 'manual_edit', sourceId: null, note, createdBy }
5. Return: { success, changeAmount }
```
> Ini endpoint sederhana untuk Manager yang mau koreksi cepat tanpa proses Stock Opname formal -- misal sadar ada selisih kecil pas lihat dapur, tinggal edit angka, histori otomatis tercatat.

---

## 4. Recipes (BOM)

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/recipes?productId=X` | owner, manager | List resep untuk 1 produk (semua varian) |
| POST | `/api/recipes` | owner, manager | Tambah baris resep baru |
| PATCH | `/api/recipes/:id` | owner, manager | Edit qty per batch |
| DELETE | `/api/recipes/:id` | owner, manager | Hapus baris resep |

---

## 5. Expenses (Pengeluaran)

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/expenses?month=2026-06` | owner, manager | List pengeluaran per bulan |
| POST | `/api/expenses` | owner, manager | Catat pengeluaran baru -- input satuan beli BEBAS, sistem convert otomatis & update `currentStock` |
| PATCH | `/api/expenses/:id` | owner, manager | Edit pengeluaran (akan menyesuaikan `currentStock` selisihnya) |
| DELETE | `/api/expenses/:id` | owner | Hapus (akan mengurangi balik `currentStock` yang sudah ditambahkan) |

**Detail logic POST `/api/expenses`:**
```
1. Terima: { ingredientId, qtyPurchased, purchaseUnit, totalPrice, paymentMethod, supplier }
2. Ambil ingredient.unitAlternatives, cari yang unit=purchaseUnit
   -- kalau purchaseUnit SAMA dengan baseUnit, conversionToBase = 1 (tidak perlu convert)
   -- kalau tidak ditemukan di unitAlternatives DAN bukan baseUnit -> return error,
      minta Manager tambahkan dulu konversinya di pengaturan bahan
3. qtyInBaseUnit = qtyPurchased * conversionToBase
4. pricePerBaseUnit = totalPrice / qtyInBaseUnit
5. Firestore transaction:
   - Tulis dokumen expenses baru (simpan qtyPurchased, purchaseUnit, qtyInBaseUnit, pricePerBaseUnit)
   - Update ingredient.currentStock += qtyInBaseUnit
   - Tulis stockMovements: { changeAmount: +qtyInBaseUnit, sourceType: 'expense', sourceId: <expenseId> }
6. Return: { success, qtyInBaseUnit, newStock }
```

> **Contoh:** Manager beli "5 kg Tepung" (baseUnit Tepung = gram). Input: qtyPurchased=5, purchaseUnit="kg". Sistem cari conversionToBase untuk "kg" di unitAlternatives Tepung = 1000. qtyInBaseUnit = 5 * 1000 = 5000 gram. `currentStock` Tepung otomatis +5000.

> **Catatan keamanan:** Crew TIDAK punya akses ke endpoint ini sama sekali (bukan cuma read-only) — harga beli bahan dianggap data sensitif.

---

## 6. Production (Produksi) & Pre-Packing

**Catatan desain:** Produksi dan Pre-Packing adalah 2 tahap TERPISAH WAKTU. Crew input Produksi (batch + loyang) di akhir shift, dalam 1 request berisi semua varian yang dikerjakan hari itu. Pre-Packing (loyang → pack Regular/Full) bisa dilakukan kapan saja, oleh siapa saja, menggabungkan loyang dari beberapa tanggal produksi (FIFO).

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/productions?date=2026-06-20` | owner, manager, crew | List produksi per tanggal |
| POST | `/api/productions/batch` | owner, manager, crew | Input produksi akhir shift -- **1 request, multi-varian sekaligus** |
| GET | `/api/productions/loyang-pool?variantId=X` | owner, manager, crew | List loyang tersedia per varian, urut FIFO (tanggal lama dulu) -- untuk UI pre-packing |
| POST | `/api/pre-packing` | owner, manager, crew | Submit pre-packing: pilih varian, total loyang dipakai, hasil pack Regular & Full |
| GET | `/api/productions/summary?month=X` | owner, manager | Total produksi per varian per bulan (untuk dashboard) |

**Detail logic POST `/api/productions/batch`:**
```
1. Terima: { entries: [ { variantId, batches, loyangCount }, ... ], notes, crewId }
   -- array karena 1 sesi input bisa berisi beberapa varian sekaligus
2. Untuk SETIAP entry di array:
   a. Ambil semua recipes WHERE productId=<produk_default> AND variantId IN ['all', entry.variantId]
   b. Hitung qtyUsed per ingredient (dalam baseUnit) = entry.batches * recipe.qtyPerBatch
   c. Cek ingredient.currentStock -- kalau kurang dari qtyUsed, siapkan alert (lihat step 5)
      TAPI tetap lanjut proses (tidak block, produksi fisik sudah terjadi)
   d. Siapkan dokumen productions baru:
      { date: today, variantId: entry.variantId, batches: entry.batches,
        loyangCount: entry.loyangCount, loyangRemaining: entry.loyangCount,
        shiftCrewId: crewId, createdAt: now }
3. Firestore transaction:
   - Tulis semua dokumen productions
   - Untuk SETIAP ingredient yang terpakai (gabungan dari semua entry):
     ingredient.currentStock -= totalQtyUsed
     Tulis stockMovements: { changeAmount: -totalQtyUsed, sourceType: 'production', sourceId: <productionId> }
4. Untuk setiap ingredient yang currentStock akhirnya negatif, buat dokumen alert
   (type: 'stock_warning_production')
5. Return: { success, entriesSaved: N, warnings: [...] }
```

> **Perbedaan penting dari versi Sheets:** Stok bahan TIDAK dihitung ulang dari histori setiap kali production baru masuk -- `currentStock` langsung dikurangi saat itu juga, dalam transaction yang sama dengan penulisan dokumen production. Ini mencegah race condition kalau 2 crew input produksi bersamaan, dan stok selalu reflect kondisi terkini tanpa delay komputasi.

**Detail logic GET `/api/productions/loyang-pool`:**
```
1. Terima query: variantId
2. Query productions WHERE variantId=X AND loyangRemaining > 0 ORDER BY date ASC
3. Return: [{ productionId, date, loyangRemaining }, ...], totalAvailable: SUM(loyangRemaining)
```

**Detail logic POST `/api/pre-packing`:**
```
1. Terima: { variantId, totalLoyangUsed, resultRegularPacks, resultFullPacks, crewId }
2. Ambil loyang pool (sama seperti GET loyang-pool) -- urut FIFO
3. Alokasikan totalLoyangUsed dari pool, mulai dari yang TANGGAL PALING LAMA:
   - Ambil dari production[0] sampai habis atau totalLoyangUsed terpenuhi
   - Kalau production[0] tidak cukup, lanjut ke production[1], dst
   - Catat setiap alokasi ke array sourceProductions
4. VALIDASI: kalau totalLoyangUsed > totalAvailable di pool -> tolak request,
   return error "Loyang tidak cukup, tersedia hanya N loyang"
5. Firestore transaction:
   - Update loyangRemaining di setiap dokumen productions yang terpakai (kurangi)
   - Tulis dokumen baru ke prePacking dengan sourceProductions, resultRegularPacks, resultFullPacks
6. Return: { success, prePackingId, sourceBreakdown: [...] }
```

---

## 7. Stock Opname

| Method | Route | Role | Fungsi |
|---|---|---|---|
| POST | `/api/stock-opname` | crew | Submit hasil hitung fisik awal shift → hitung discrepancy otomatis |
| GET | `/api/stock-opname?date=X` | owner, manager | List opname + discrepancy untuk direview |
| PATCH | `/api/stock-opname/:id/review` | owner, manager | Tandai sudah direview -- bisa sekaligus buat koreksi stok per item |

**Detail logic PATCH `/api/stock-opname/:id/review`:**
```
1. Terima: { reviewNote, adjustments: [{ ingredientId, applyAdjustment: boolean }] }
   -- adjustments cuma untuk item yang Manager pilih "Sesuaikan ke Angka Fisik"
2. Firestore transaction, untuk setiap item di adjustments WHERE applyAdjustment=true:
   a. Ambil physicalStock (atau physicalStockConverted) dari item opname
   b. changeAmount = physicalStock - ingredient.currentStock (saat ini)
   c. ingredient.currentStock = physicalStock  -- LANGSUNG di-set ke angka fisik
   d. Tulis stockMovements: { ingredientId, changeAmount, newStockAfter: physicalStock,
        sourceType: 'stock_opname_adjustment', sourceId: <id opname ini>, createdBy }
3. Update stockOpname: reviewedBy, reviewedAt,
   reviewAction = (ada adjustment diterapkan) ? 'adjusted' : 'acknowledge'
4. Return: { success, adjustmentsApplied: N }
```

**Detail logic POST:**
```
1. Terima: { crewId, shiftType, items: [{ ingredientId, physicalStock }] }
   -- items HANYA berisi bahan yang sempat dicek, boleh sebagian dari total bahan aktif
2. Untuk setiap item DI ARRAY (yang dicek saja), ambil systemStock = ingredient.currentStock (baca langsung, bukan dihitung dari formula)
3. difference = physicalStock - systemStock
4. hasDiscrepancy = true kalau ADA item (dari yang dicek) dengan difference != 0
5. totalIngredientsChecked = items.length
6. totalIngredientsAll = COUNT(ingredients WHERE isActive=true) -- untuk info cakupan
7. Simpan dokumen
8. Kalau hasDiscrepancy -> buat dokumen baru di collection `alerts`
   { type: 'stock_opname_discrepancy', severity: 'warning',
     title: "Selisih stok ditemukan",
     message: "Stock opname shift [X] oleh [crew] menemukan N item selisih (dari M bahan dicek)",
     sourceCollection: 'stockOpname', sourceId: <id opname> }
```

---

## 8. Attendance (Absen)

| Method | Route | Role | Fungsi |
|---|---|---|---|
| POST | `/api/attendance/check-in` | crew | Absen masuk, validasi IP |
| POST | `/api/attendance/check-out` | crew | Absen pulang, validasi IP, hitung jam kerja |
| GET | `/api/attendance?month=X` | owner, manager | List absen untuk review/payroll |
| GET | `/api/attendance/my-status` | crew | Cek status absen hari ini (sudah check-in belum, dst) |
| PATCH | `/api/attendance/:id/resolve` | owner, manager | Resolve status 'direview' -- approve jadi lengkap, atau tolak jadi tidak hadir |

**Detail logic PATCH `/api/attendance/:id/resolve`:**
```
1. Terima: { decision: 'approve' | 'reject' }
2. Kalau decision='approve':
   - status = 'lengkap'
   - Hitung overtimeHours, overtimeBlocks, overtimeBonus (kalau belum terhitung)
   - Record ini akan ikut terhitung di payroll bulan tersebut
3. Kalau decision='reject':
   - status = 'belum_lengkap' (permanen, tidak akan otomatis lengkap lagi)
   - Tidak ikut terhitung workDays di payroll
4. Set reviewedBy, reviewedAt
5. Return: { success, newStatus }
```

**Detail logic POST `/api/attendance/check-in`:**
```
1. Ambil IP dari request header (x-forwarded-for, dari Vercel)
2. Cek IP terhadap settings/attendanceConfig.whitelistedIps
3. Kalau TIDAK valid:
   - Update settings.lastDetectedIp & lastDetectedAt
   - Return 403 "IP tidak dikenali, hubungi Manager"
4. Kalau valid:
   - Cek apakah sudah ada attendance hari ini untuk employeeId ini
     (kalau sudah ada dan belum checkout -> return error "sudah absen masuk")
   - Buat dokumen attendance baru, status='belum_lengkap'
   - Return success
```

**Detail logic POST `/api/attendance/check-out`:**
```
1. Ambil IP, validasi sama seperti check-in
2. Cari dokumen attendance hari ini milik employeeId yang checkOut=null
3. Kalau IP valid:
   - totalHours = (now - checkIn.time) / 3600
   - regularHours = min(totalHours, 8)
   - overtimeHours = max(0, totalHours - 8)
   - overtimeBonus = overtimeHours * 10000
   - status = 'lengkap'
4. Kalau IP TIDAK valid:
   - status = 'direview', flaggedReason = "Check-out dari IP tidak dikenal"
   - (totalHours dkk tetap dihitung untuk referensi manager, tapi tidak otomatis masuk payroll)
5. Update dokumen attendance
```

> Endpoint khusus untuk Opsi C self-heal IP ada di bagian 9 (Settings).

---

## 9. Settings (Admin)

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/settings/attendance` | owner, manager | Lihat whitelist IP saat ini + lastDetectedIp |
| POST | `/api/settings/attendance/whitelist` | owner, manager | Tambah IP baru ke whitelist (one-click dari banner "IP terdeteksi") |
| DELETE | `/api/settings/attendance/whitelist` | owner, manager | Hapus IP lama dari whitelist |

---

## 9b. Alerts (Notifikasi)

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/alerts?unread=true` | owner, manager | List alert belum dibaca (untuk badge counter + dashboard) |
| PATCH | `/api/alerts/:id/read` | owner, manager | Tandai sudah dibaca |
| PATCH | `/api/alerts/read-all` | owner, manager | Tandai semua sudah dibaca |

> Client (Owner/Manager dashboard) sebaiknya subscribe langsung ke Firestore collection `alerts` via client SDK dengan security rules yang membatasi read ke role owner/manager saja — ini lebih efisien untuk realtime daripada polling lewat API route biasa.

---

## 10. Orders (Transaksi/POS)

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/orders?status=X` | owner, manager | List order (filter status/payment) |
| GET | `/api/orders/:id` | owner, manager | Detail order + items |
| POST | `/api/orders` | owner, manager | Buat order baru (manual input marketplace/walk-in) -- transaction: cek stok, kurangi stok produk jadi |
| POST | `/api/orders/public` | public, tanpa login | Form Pemesanan WA submit -- validasi ketat, masuk dengan status default |
| PATCH | `/api/orders/:id/status` | owner, manager | Update status (belum_selesai -> selesai) |
| PATCH | `/api/orders/:id/payment` | owner, manager | Update status pembayaran |
| PATCH | `/api/orders/:id/shipping` | owner, manager | Set/update `shippingCost` manual setelah dikonfirmasi ke kurir |
| POST | `/api/orders/:id/invoice` | owner, manager | Generate PDF invoice (perlu `shippingCostConfirmed=true` dulu) |
| GET | `/api/orders/:id/invoice` | owner, manager | Download ulang invoice yang sudah pernah dibuat |
| POST | `/api/orders/:id/void` | owner | Void order -- kembalikan stok |

**Detail logic POST `/api/orders/:id/void`:**
```
1. Ambil order + semua items
2. Firestore transaction, untuk setiap item:
   a. Item NON-RAINBOW -> stok produk jadi (Regular/Full) dikembalikan
      sejumlah qty yang ada di item tersebut
   b. Item RAINBOW dengan assemblyStatus='completed' ->
      kembalikan stok ke sumber asal SESUAI rainbowSourceBreakdown:
      - source='pack_jadi' -> kembalikan pack jadi yang dibongkar (atau resolve openPacks terkait)
      - source='pool_loyang' -> tambahkan kembali loyangRemaining di productions terkait
   c. Item RAINBOW dengan assemblyStatus='pending_approval' ->
      TIDAK ADA stok yang dikembalikan (memang belum pernah dikurangi)
3. Set order.status = 'void'
4. Return: { success, stockReturned: [...] }
```

**Detail logic POST `/api/orders` (kasir/manual input):**
```
1. Terima: { customerId, source, items: [{ productId, variantId, qty }] }
2. Untuk setiap item NON-RAINBOW:
   a. Tentukan tier harga berdasarkan qty (cek products/{id}/priceTiers)
   b. Hitung discountPerUnit dari customer.discountPerUnit
   c. Snapshot hppPerUnit dari computed HPP saat ini
   d. Hitung totalPrice, totalHpp, margin
   e. Cek stok tersedia (producedPacks - soldPacks) cukup atau tidak
      - Kalau TIDAK cukup -> set needsProduction=true di item ini (tidak block)
3. Untuk item RAINBOW (productId='churros-rainbow'):
   a. Hitung tier harga berdasarkan jumlah PAKET (bukan pack biasa)
   b. Set assemblyStatus = 'pending_approval' -- STOK BELUM DIKURANGI sama sekali
   c. Hitung draft rekomendasi sumber per 6 varian (lihat /api/rainbow-assembly/preview)
   d. Simpan draft sebagai rainbowSourceBreakdown (belum final, masih bisa diubah Manager)
   e. Buat dokumen alert: "Rainbow order butuh assembly"
4. Firestore transaction:
   - Tulis dokumen order
   - Tulis subcollection items
5. Return: { orderId, orderNumber, needsProduction, summary }
```

> **PENTING:** Stok untuk item Rainbow TIDAK dikurangi di endpoint ini. Pengurangan stok terjadi terpisah lewat `/api/rainbow-assembly/:orderId/confirm` setelah Manager approve (lihat bagian 10b).
```

**Detail logic POST `/api/orders/public` (Form Pemesanan WhatsApp):**
```
1. Rate limiting per IP (cegah spam) -- misal max 5 submit/jam per IP
2. Validasi input ketat: qty > 0, productId & variantId valid,
   requestedDeliveryDate WAJIB ada dan tidak boleh tanggal lampau
3. Sanitize semua string input (cegah injection)
4. Cek customers WHERE phoneNumber = <input phone>:
   a. Kalau COCOK -> pakai customerId existing, ambil discountPerUnit dari situ,
      update address di customer kalau beda dari yang tersimpan
   b. Kalau TIDAK COCOK -> buat dokumen customer baru:
      { name, phoneNumber, address, channel: 'walk_in', createdVia: 'wa_form' }
5. Proses items sama seperti POST /api/orders (hitung tier harga, dst)
6. Set: source='wa_form', createdBy=null, paymentStatus='belum_bayar',
   shippingAddress, requestedDeliveryDate, orderNotes, proofOfTransferUrl (kalau ada upload)
   shippingCost=null, shippingCostConfirmed=false (SELALU -- diisi manual nanti)
7. Buat alert ke Manager: "Order baru dari [nama] via Form Pemesanan WA"
8. Return: { orderId, orderNumber, summary }
```

> **Penting:** `shippingCost` TIDAK dihitung di endpoint ini sama sekali. Manager mengisi manual lewat endpoint terpisah (lihat `PATCH /api/orders/:id/shipping` di bawah) setelah order masuk dan ongkir dikonfirmasi ke ekspedisi/kurir.

**Detail logic POST `/api/orders/:id/invoice`:**
```
1. Cek order.shippingCostConfirmed -- HARUS true, kalau belum return error
   "Konfirmasi ongkir dulu sebelum membuat invoice"
2. Generate invoiceNumber kalau belum ada (format: INV-YYYYMMDD-NNNN)
3. Render PDF dengan template formal, data diambil dari settings/businessInfo:
   - Header: Logo (logoUrl) + businessName
   - No Invoice, Tanggal
   - Data pembeli: Nama, No HP, Alamat
   - Tabel item: Produk, Varian, Qty, Harga/unit, Subtotal
   - Ongkos Kirim
   - TOTAL AKHIR (produk + ongkir)
   - Info rekening pembayaran (dari bankAccounts)
   - Footer: invoiceFooterNote
4. Upload PDF ke Firebase Storage, dapatkan invoiceUrl
5. Update order: { invoiceNumber, invoiceGeneratedAt: now, invoiceUrl }
6. Return: { invoiceUrl } -- Manager download dari sini, kirim manual ke WA pembeli
```

> Generate invoice bersifat idempotent untuk nomor invoice (sekali dibuat, nomor tidak berubah), tapi PDF bisa di-regenerate (misal kalau ongkir direvisi) -- `invoiceGeneratedAt` akan terupdate ke waktu regenerate terakhir.

---

## 10b. Rainbow Assembly

**Konteks:** Rainbow butuh 2 pcs dari 6 varian (12 pcs/paket). Sistem cek stok pack jadi dulu (bongkar sebagian kalau perlu), fallback ke pool loyang. Manager HARUS approve sebelum stok benar-benar dikurangi -- tidak ada pengurangan otomatis untuk kasus ini.

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/rainbow-assembly/pending` | owner, manager | List order Rainbow yang masih `pending_approval` |
| GET | `/api/rainbow-assembly/:orderId/preview` | owner, manager | Lihat rekomendasi sumber per varian (read-only, belum eksekusi) |
| PATCH | `/api/rainbow-assembly/:orderId/override` | owner, manager | Manager ubah manual sumber 1 varian (misal pilih pool_loyang walau pack_jadi tersedia) |
| POST | `/api/rainbow-assembly/:orderId/confirm` | owner, manager | **Eksekusi final** -- kurangi stok sesuai breakdown yang sudah di-review |

**Detail logic GET `/api/rainbow-assembly/:orderId/preview`:**
```
1. Ambil order, hitung totalPcsNeeded per varian = qty (paket) * 2
2. Untuk SETIAP 6 varian:
   a. Cek stok pack jadi (Regular dulu, lalu Full) -- cukup untuk totalPcsNeeded?
      - Kalau cukup -> source='pack_jadi', amountTaken=totalPcsNeeded (dalam pcs)
   b. Kalau pack jadi tidak cukup -> cek pool loyang (productions.loyangRemaining)
      - Kalau cukup -> source='pool_loyang', amountTaken=totalPcsNeeded
   c. Kalau keduanya tidak cukup -> source='shortage', needsProduction=true
3. Return: rainbowSourceBreakdown DRAFT (belum disimpan permanen, belum eksekusi)
```

**Detail logic POST `/api/rainbow-assembly/:orderId/confirm`:**
```
1. Ambil rainbowSourceBreakdown FINAL (hasil preview + override Manager kalau ada)
2. Firestore transaction, untuk SETIAP varian di breakdown:
   a. Kalau source='pack_jadi':
      - Kurangi stok pack (hitung sebagai pcs diambil dari 1 pack utuh)
      - Tulis dokumen baru ke `openPacks` untuk SISA pcs dari pack yang dibongkar
      - Pack yang dibongkar dikeluarkan dari hitungan stokTersedia normal
   b. Kalau source='pool_loyang':
      - Kurangi productions.loyangRemaining (FIFO, sama seperti Pre-Packing)
   c. Kalau source='shortage':
      - Set needsProduction=true untuk varian ini, tidak ada pengurangan stok
3. Update order.items[rainbow].assemblyStatus = 'completed'
4. Return: { success, openPacksCreated: [...], warnings: [...] }
```

---

## 10c. Stock Adjustments (Pengeluaran Non-Penjualan)

**Konteks:** Untuk pengeluaran stok yang BUKAN penjualan -- sample affiliate, hadiah teman, bonus kerabat, rusak/reject, konsumsi internal. Mengurangi stok seperti penjualan biasa, tapi nilainya masuk P&L sebagai "Biaya Promosi/Sample", bukan pemasukan.

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/stock-adjustments?month=X` | owner, manager | List pengeluaran non-penjualan per bulan |
| POST | `/api/stock-adjustments` | owner, manager | Catat pengeluaran baru -- kurangi stok produk jadi |
| DELETE | `/api/stock-adjustments/:id` | owner | Hapus/batalkan (jarang dipakai, untuk koreksi salah input) |

**Detail logic POST `/api/stock-adjustments`:**
```
1. Terima: { productId, variantId, qty, reasonCategory, reasonCustom, recipientName }
2. Snapshot hppPerUnit dari computed HPP saat ini
3. totalCost = qty * hppPerUnit
4. Cek stok tersedia -- TIDAK block kalau kurang (sama prinsip dengan order biasa),
   tapi tampilkan warning kalau qty > stokTersedia
5. Simpan dokumen stockAdjustments
   -- Stok otomatis berkurang karena formula stokTersedia menghitung SUM(stockAdjustments)
6. Return: { success, adjustmentId, totalCost }
```

> **Catatan:** Endpoint ini TIDAK butuh transaction kompleks seperti Rainbow Assembly -- karena selalu ambil dari stok produk jadi (Regular/Full) yang sudah pasti ada, tidak ada percabangan sumber.

---

## 11. Payroll

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/payroll?month=X` | owner, manager | List payroll per bulan, semua karyawan |
| POST | `/api/payroll/generate` | owner, manager | Generate payroll dari data attendance bulan tertentu |
| PATCH | `/api/payroll/:id` | owner, manager | Edit performanceBonus manual |
| PATCH | `/api/payroll/:id/pay` | owner | Tandai sudah dibayar |

**Detail logic POST `/api/payroll/generate`:**
```
1. Terima: { month: "2026-06" }
2. Untuk setiap employee aktif:
   a. Cek dokumen payroll/{month}_{employeeId} yang sudah ada
      -- Kalau isLocked=true (sudah dibayar) -> SKIP, jangan timpa, catat di summary
   b. Query attendance WHERE employeeId=X, date dalam bulan tsb, status='lengkap'
   c. workDays = COUNT hasil query
   d. totalRegularPay = workDays * employee.dailyWage
   e. totalOvertimeBonus = SUM(overtimeBonus dari semua attendance lengkap)
   f. pendingReview = COUNT attendance WHERE status='direview' di bulan tsb
   g. dataStatus = pendingReview > 0 ? 'parsial' : 'final'
   h. Buat/timpa dokumen payroll/{month}_{employeeId} (hanya yang belum locked)
3. Return: summary { generated: [...], skippedLocked: [...], warnings: [...] }
```

**Detail logic PATCH `/api/payroll/:id/pay`:**
```
1. Ambil dokumen payroll
2. Kalau dataStatus='parsial' -> WAJIB ada konfirmasi eksplisit dari client
   (request harus include { confirmedDespitePartial: true })
   -- kalau tidak ada -> return 400, minta konfirmasi dulu
3. Set status='sudah_dibayar', paidAt=now, isLocked=true
4. Return: { success }
```

> Setelah `isLocked=true`, endpoint `/api/payroll/generate` TIDAK akan menimpa dokumen ini lagi pada generate berikutnya untuk bulan yang sama.

> Endpoint ini idempotent -- bisa dipanggil ulang (misal setelah ada attendance yang direview & di-resolve), akan re-calculate tanpa duplikasi.

---

## 12. Dashboard & Reports

| Method | Route | Role | Fungsi |
|---|---|---|---|
| GET | `/api/dashboard/today` | owner, manager | Ringkasan hari ini (omzet, HPP, profit, produksi) |
| GET | `/api/reports/pnl?month=X` | owner, manager | Laporan P&L bulanan |

**Detail formula P&L (urutan baris laporan):**
```
Pemasukan = SUM(orders.items.totalPrice WHERE month=X, status != 'void')
HPP Produk Terjual = SUM(orders.items.totalHpp WHERE month=X, status != 'void')
Laba Kotor = Pemasukan - HPP Produk Terjual

Biaya Operasional = SUM(expenses.totalPrice WHERE month=X, category IN ['operasional'])
Biaya Promosi/Sample = SUM(stockAdjustments.totalCost WHERE month=X)  -- BARIS BARU
Gaji + Bonus = SUM(payroll.totalPaid WHERE month=X)

Laba Bersih = Laba Kotor - Biaya Operasional - Biaya Promosi/Sample - Gaji + Bonus
```
| GET | `/api/reports/monthly-summary` | owner, manager | Omzet per channel per bulan (ganti Ringkasan Bulanan Sheets) |
| GET | `/api/reports/stock-summary` | owner, manager, crew (terbatas) | Stok produk jadi per varian saat ini |

---

## Middleware & Helper

```typescript
// lib/auth-middleware.ts
async function requireRole(allowedRoles: Role[]) {
  // Verify Firebase ID token dari Authorization header
  // Cek custom claim 'role' user
  // Throw 403 kalau role tidak sesuai
}

// lib/ip-helper.ts
function getClientIp(req: NextRequest): string {
  // Baca x-forwarded-for dari Vercel (bisa berisi multiple IP, ambil yang pertama)
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
}

// lib/computed.ts
async function getIngredientStock(ingredientId: string): Promise<number>
async function getProductHpp(productId: string, variantId: string): Promise<number>
async function getAvailableStock(productId: string, variantId: string): Promise<number>
```

---

## Urutan Implementasi yang Disarankan

Karena ini banyak, urutan build yang masuk akal (dari fondasi ke fitur):

1. Auth + role middleware -- semua endpoint lain depend on ini
2. Products, Variants, Ingredients, Recipes (read-only dulu, CRUD belakangan) -- fondasi data
3. Expenses + Productions -- mulai bisa hitung stok computed
4. Orders (manual input) -- POS jadi fungsional
5. Attendance + Settings -- fitur absen
6. Payroll -- depend on Attendance
7. Stock Opname -- fitur tambahan crew
8. Orders public (Form Pemesanan WA) -- customer-facing, butuh extra hardening
9. Dashboard & Reports -- agregasi dari semua data yang sudah ada

---

*Dokumen ini melengkapi Firestore_Data_Model.md. Update bersamaan kalau ada perubahan skema yang mempengaruhi endpoint.*
