# Anchur POS — Catatan Perencanaan & Roadmap
> Dokumen ini mencatat semua keputusan desain sistem, keterbatasan sementara, dan rencana pengembangan dari Google Sheets menuju App POS mandiri.
> Terakhir diupdate: Juni 2026

---

## 1. Konteks Bisnis

**Anchur** adalah home industry churros frozen berbasis di Bandung (Ciwastra), dikelola oleh Aya (pemilik/produksi) dan Adli (marketing/management).

### Produk Aktif
| Kode | Nama | Isi | Harga Dasar | Catatan |
|---|---|---|---|---|
| CFR | Churros Frozen Regular | 12 pcs | Rp15.000 | Harga tier berlaku |
| CFF | Churros Frozen Full | 16 pcs | Rp17.000 | Harga tier berlaku |
| CTK | Churros TikTok | 12 pcs | Rp23.000 | Half cooked, vacuum sealed |
| CMT | Churros Matang | 12 pcs | Rp20.000 | Tidak bisa dadakan |
| CRB | Churros Rainbow | 12 pcs campur | Rp72.000-87.000/paket | Dijual per 6 pack / kelipatan 6 |

### Varian Rasa
Original, Coklat, Red Velvet, Taro, Greentea, Charcoal

### Varian Dipping Sauce
Cheese, Vanilla, Tiramisu, Coklat, Taro, Red Velvet, Matcha

### Tier Harga Reguler (CFR)
| Qty | Harga/pack |
|---|---|
| 1 - 10 pack | Rp15.000 |
| 11 - 24 pack | Rp14.000 |
| 25 - 34 pack | Rp13.000 |
| ≥ 35 pack | Rp12.000 |

### Tier Harga Full (CFF)
| Qty | Harga/pack |
|---|---|
| 1 - 24 pack | Rp17.000 |
| 25 - 34 pack | Rp16.000 |
| ≥ 35 pack | Rp15.000 |

### Channel Penjualan
- Shopee (retail, fee ~17%)
- TikTok Shop (half cooked, kirim luar kota)
- WhatsApp Business (direct, harga variatif)
- B2B — Deu Coffee (Dago, Mekarwangi, Dipatiukur), cafe lain
- Reseller (Nadya, dll)

---

## 2. Sistem Google Sheets (MVP Saat Ini)

### Sheet yang Ada
| Sheet | Fungsi | Status |
|---|---|---|
| Master Produk | Daftar produk + HPP otomatis | ✅ Aktif |
| Master Bahan | Stok bahan baku real-time | ✅ Aktif |
| Master Pelanggan | Daftar pelanggan + channel | ✅ Aktif |
| Resep Produk | BOM per batch | ✅ Aktif |
| Log Produksi | Catat produksi harian | ✅ Aktif |
| Pengeluaran | Catat pembelian bahan | ✅ Aktif |
| Transaksi | Catat penjualan | ✅ Aktif |
| Stok Produk Jadi | Stok freezer per produk+varian | ✅ Aktif |
| Gaji Karyawan | Hitung gaji + bonus | ✅ Aktif |
| P&L | Laporan laba rugi bulanan | ✅ Aktif |
| Ringkasan Bulanan | Omzet per channel per bulan | ✅ Aktif |

### Cara Kerja Harian
1. Ada produksi → isi **Log Produksi** (tanggal, varian, jumlah batch)
2. Beli bahan → isi **Pengeluaran** (item, qty, total bayar)
3. Ada penjualan → isi **Transaksi** (pelanggan, produk, varian, qty, potongan)
4. Akhir bulan → isi **Gaji Karyawan** (hari kerja per orang)
5. Semua sheet lain update otomatis

### Logika Produksi
- 1 batch = 1 adonan = 1 kg tepung + 325g mentega + 325g gula + 6 butir telur
- 1 batch menghasilkan 192 biji = **16 pack** (default pre-pack isi 12)
- Churros Full (isi 16) = repack dari stok Regular yang ada
- Cutoff stok: 15 Juni 2026 (stok awal diisi manual, tracking mulai dari sini)

---

## 3. Keterbatasan Sistem Sheets (Sementara)

### 3a. Rainbow — Sudah Diselesaikan di Desain App (Update dari Versi Sheets)
**Status lama (Sheets):** Rainbow dicatat sebagai 1 baris transaksi, stok per varian tidak di-track (terlalu kompleks untuk Sheets).

**Status baru (App/Firestore):** Diselesaikan lewat fitur **Rainbow Assembly** — proses approval semi-otomatis. Sistem kasih rekomendasi sumber per 6 varian (pack jadi dulu, fallback pool loyang), Manager review & approve, baru stok dikurangi. Pack yang dibongkar sebagian masuk ke tracking `openPacks` agar tidak hilang dari sistem. Detail lengkap ada di `Firestore_Data_Model.md` (collection `openPacks`, field `assemblyStatus`) dan `API_Routes_Breakdown.md` (grup 10b).

### 3b. Tier Harga — Input Manual
**Keputusan:** Harga dasar tetap Rp15.000 (Reguler) / Rp17.000 (Full). Potongan diisi manual sesuai qty.

**Solusi di App POS nanti:**
```
Saat input qty, sistem otomatis:
- Hitung tier yang berlaku
- Apply harga tier sebagai harga transaksi
- Tampilkan breakdown ke kasir
```

### 3c. Churros Full — Stok Produksi Tidak Di-track
**Keputusan:** Full direpak dari stok Regular. Stok Full di Stok Produk Jadi = 0 sampai ada pencatatan repack.

**Solusi di App POS nanti:**
```
Fitur "Repack":
- Input: dari stok Regular varian X, repack ke Full sebanyak Y pack
- Sistem: stok Regular X berkurang (Y × 16 / 12), stok Full X bertambah Y
```

### 3d. HPP Partial
**Keputusan:** HPP otomatis hanya menghitung bahan base (tepung, mentega, gula, telur). Packaging, gas, tenaga kerja belum masuk HPP.

**Rencana di App POS:** HPP = bahan + packaging + alokasi overhead per pack.

### 3e. Data Transaksi Lama (Nov 2025 - Feb 2026)
- Semua diisi varian "Original" sebagai default
- Kolom Cabang Deu sudah dihapus, diganti dengan nama lengkap pelanggan di Master Pelanggan
- Data lama dianggap arsip, tidak di-edit ulang

---

## 4. Roadmap Menuju App POS

### Fase 1 — Sheets MVP ✅ (Juni 2026)
Sistem pencatatan lengkap di Google Sheets:
- Tracking pengeluaran + stok bahan baku
- Tracking stok produk jadi per varian
- Manajemen produksi berbasis batch
- Laporan P&L bulanan
- Sistem gaji karyawan

### Fase 2 — Data Matang (Juli - Agustus 2026)
Target: 2 bulan data produksi + penjualan + pengeluaran yang konsisten.
- Validasi akurasi HPP otomatis
- Identifikasi varian terlaris per channel
- Tentukan target produksi berbasis data (bonus mulai berlaku Agustus)
- Finalisasi struktur database sebelum migrasi ke app

### Fase 3 — App POS MVP (Target: Q4 2026)
**Tech stack:** React + Firestore + Vercel (konsisten dengan MyGameON Hub yang sudah ada)

**Fitur inti:**
- [ ] Dashboard stok real-time (bahan baku + produk jadi)
- [ ] Input transaksi dengan tier harga otomatis
- [ ] Input produksi (batch → pack otomatis)
- [ ] Repack Regular → Full
- [ ] Rainbow transaction (kurangi 6 varian sekaligus)
- [ ] Laporan P&L otomatis
- [ ] Manajemen karyawan + gaji

**Database schema (dari struktur Sheets):**
```
products: { id, name, code, basePrice, packPerBatch, hpp }
variants: { id, name }
ingredients: { id, name, category, unit, stock, minStock, pricePerUnit }
recipes: { productId, variantId, ingredientId, qtyPerBatch }
transactions: { id, date, customerId, items: [{ productId, variantId, qty, price, discount }] }
productions: { id, date, variantId, batches, resultPacks }
expenses: { id, date, category, ingredientId, qty, totalPrice }
employees: { id, name, dailyWage }
payroll: { id, month, employeeId, workDays, bonus, total }
```

### Fase 4 — Integrasi Website (Target: 2027)
- Website jualan terintegrasi dengan POS
- Order dari website masuk otomatis ke POS
- Stok real-time di website
- Customer bisa cek status order

---

## 5. Keputusan Desain yang Sudah Diambil

| Topik | Keputusan | Alasan |
|---|---|---|
| Satuan bahan baku | Gram (bukan kg) | Konsisten dengan resep Aya |
| Satuan telur | Butir (bukan gram) | Lebih mudah hitung fisik stok |
| HPP basis | Per batch, bukan per pack | Match cara kerja dapur |
| Rainbow tracking | Rainbow Assembly (approval-based) | Sheets terlalu kompleks, App bisa handle dengan benar |
| Tier harga | Harga dasar 15rb, potongan manual | Simpel, cukup akurat |
| Cutoff stok | 15 Juni 2026 | Hari pertama karyawan masuk |
| Data lama | Arsip, tidak di-edit | Continuity data terjaga |
| Karyawan | 3 aktif (Aldhy, Ajeng, Ihsan) | Satria tidak membalas, Harris overqualified |
| Gaji | Rp60.000/hari kerja | Belum ada bonus di bulan pertama |
| Masa training | 15-21 Juni 2026 | Bersama Aya, 1 shift 1 karyawan |
| Masa probation | 22 Juni - 31 Juli 2026 | 2 orang per shift, Aya supervisi |
| Bonus berlaku | Agustus 2026 | Setelah ada data demand 2 bulan |

---

## 6. Catatan Teknis untuk Developer

### Google Sheets → Firestore Migration
- Setiap sheet = 1 collection di Firestore
- Primary key: gunakan timestamp + random ID (bukan auto-increment)
- Relasi antar collection pakai reference ID, bukan nama (nama bisa berubah)

### Formula yang Perlu Jadi Logic di App
- HPP otomatis: `SUM(ingredient.pricePerUnit × recipe.qtyPerBatch) / product.packPerBatch`
- Stok bahan: `stockAwal + SUM(expenses.qty) - SUM(productions × recipe.qty)`
- Stok produk: `SUM(productions.resultPacks) - SUM(transactions.qty)`
- P&L: `revenue - cogs - opex - payroll`

### Catatan Rainbow di App
```javascript
// Saat Rainbow transaction:
const rainbowVariants = ['Original','Coklat','Red Velvet','Taro','Greentea','Charcoal'];
const pcsPerVariant = 2; // per pack Rainbow
const packsOrdered = qty; // dari input kasir

rainbowVariants.forEach(variant => {
  stock[variant] -= (packsOrdered × pcsPerVariant / 12); // dalam satuan pack Regular
});
```

---

*Dokumen ini diupdate setiap ada keputusan desain baru. Simpan di Google Drive bersama file Sheets untuk referensi developer nanti.*
