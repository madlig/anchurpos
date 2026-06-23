# AnchurPOS — UI & Halaman per Role
> Versi 1.0 — Breakdown navigasi, halaman, dan komponen per role
> Mobile-first, kecuali ditandai khusus desktop

---

## Ringkasan Role

| Role | Device Utama | Fokus Penggunaan |
|---|---|---|
| Owner (Aya) | Mobile | Supervisi, approval, lihat laporan |
| Manager (Adli) | Mobile + Desktop | Full akses, kelola semua operasional |
| Crew (Aldhy, Ajeng, Ihsan) | Mobile | Absen, produksi, stock opname |
| Customer | Mobile (browser, no login) | Form Pemesanan WhatsApp saja |

---

## ROLE: CREW

Akses paling terbatas. Bottom nav cuma 3 tab biar nggak bingung.

### Bottom Navigation
```
[Absen] [Produksi] [Pre-Pack] [Stok Opname]
```

### Halaman: Absen (`/crew/attendance`) — Landing page default
**Komponen:**
- Status card besar: "Belum Absen" / "Sedang Bekerja sejak 08:02" / "Sudah Pulang"
- 1 tombol besar: "Absen Masuk" atau "Absen Pulang" (tombol berubah sesuai status)
- Info kecil di bawah: "Pastikan terhubung WiFi rumah produksi"
- Riwayat 7 hari terakhir (list sederhana: tanggal, jam masuk-pulang, total jam)

**Behavior penting:**
- Kalau IP tidak valid saat tap tombol → modal error: "Gagal absen. Pastikan kamu terhubung ke WiFi rumah produksi, lalu coba lagi. Kalau masih gagal, hubungi Manager."
- Tidak ada cara manual override di sisi crew — semua error mengarah ke "hubungi Manager"

---

### Halaman: Produksi (`/crew/production`) — Input Akhir Shift
**Konsep:** Crew TIDAK input real-time tiap selesai 1 batch. Mereka kerja dulu, baru di akhir shift input semua sekaligus dalam 1 sesi — tanpa buka-tutup modal berkali-kali.

**Komponen:**
- Header: "Apa yang kamu buat hari ini?"
- 6 chip varian (Original, Charcoal, Red Velvet, Taro, Coklat, Greentea) — tap untuk pilih, bisa multi-select, chip yang dipilih berubah warna
- Untuk setiap chip yang dipilih, muncul **card kecil di bawahnya** dengan 2 input:
  - Jumlah Batch/Adonan (stepper, support desimal seperti 4.5)
  - Jumlah Loyang (stepper, angka bulat) — *catatan kecil di bawahnya: "Sesuai loyang yang sudah dicetak"*
- Catatan umum (opsional, 1 textarea di bawah semua card)
- Tombol besar "Simpan Semua Produksi" — submit SEMUA varian yang diisi dalam 1 request
- List riwayat hari ini di bawah (read-only, untuk konfirmasi visual)

**Tidak ada di halaman ini:**
- Harga, HPP
- Loyang TIDAK dihitung otomatis dari jumlah batch — selalu input manual karena hasil cetak tidak konsisten

---

### Halaman: Pre-Packing (`/crew/pre-packing` atau bisa diakses Manager juga)
**Konsep:** Tahap TERPISAH dari Produksi, benar-benar independen waktu — tidak terikat shift/absen, bisa diisi siapa saja kapan saja. Dirancang untuk minim friction karena crew sering mengisi ini sambil masih sibuk kerja.

**Komponen:**
- Pilih Varian (chip, sama seperti di Produksi)
- Setelah pilih varian, tampilkan 1 angka ringkas: **"14 loyang siap di-pack"** (detail per-tanggal FIFO disembunyikan default — ada tombol kecil opsional "Lihat rincian" untuk yang butuh)
- 3 input simpel:
  - Loyang dipakai sekarang (stepper, validasi cuma: tidak melebihi yang tersedia)
  - Jadi pack Regular berapa
  - Jadi pack Full berapa
- **Tidak ada validasi matematis silang** (loyang vs biji vs pack) — selisih dianggap wajar (sisa potongan, dst)
- **Boleh parsial** — tidak harus pakai semua loyang yang tersedia sekaligus
- Tombol "Simpan"
- Konfirmasi singkat: "Tersimpan ✓" (tidak perlu paragraf panjang)

**Di balik layar (tidak terlihat user):**
- Sistem alokasikan FIFO otomatis (loyang dari tanggal paling lama dipakai duluan)
- Detail alokasi tetap tersimpan di database (`sourceProductions`) untuk keperluan audit Manager/Owner, hanya muncul kalau diminta lewat "Lihat rincian"

---

### Halaman: Stock Opname (`/crew/stock-opname`)
**Konsep:** Standalone, bisa dilakukan siapa saja kapan saja — idealnya akhir shift (validasi pemakaian bahan hari itu), tapi tidak wajib terikat waktu tertentu. **Boleh cek sebagian bahan saja** — tidak harus lengkap semua.

**Komponen:**
- Header: "Stock Opname — Shift Pagi/Siang/Malam" (pilih shift dulu)
- List semua bahan baku, **tampilan input berbeda sesuai jenis bahan:**
  - **Bahan biasa** (`opnameMethod: 'direct'`, misal Tepung, Gula): 1 input angka — "Tepung Terigu (gram): ___"
  - **Bahan dalam kemasan gelap** (`opnameMethod: 'packaged'`, misal Toffieco, Red Bell):
    - Input jumlah "botol penuh yang masih tersegel": ___
    - Dropdown untuk 1 botol yang sedang dipakai/dibuka: **Penuh / Setengah / Hampir Habis / Kosong / (Tidak ada botol terbuka)**
    - *(Tidak perlu hitung ml — sistem yang convert di belakang)*
- **Boleh skip** — bahan yang tidak diisi tidak akan dikirim/dihitung, tidak ada validasi "wajib semua"
- **Tidak ditampilkan:** angka stok sistem (biar crew nggak "nyontek" — opname harus independent)
- Tombol "Submit Opname" di bawah
- Setelah submit: ringkasan sederhana — "Opname tersimpan (8 bahan dicek)" (TIDAK ditampilkan discrepancy ke crew, itu cuma untuk Manager)

> **Catatan akurasi:** Untuk bahan dalam kemasan gelap, perhitungan SELALU estimasi (terutama untuk botol yang sedang dibuka) — ini keterbatasan fisik (botol tidak transparan), bukan kekurangan sistem. Discrepancy kecil untuk bahan jenis ini dianggap wajar oleh Manager saat review.

---

## ROLE: OWNER

Owner butuh **insight cepat**, bukan input data detail. Mobile-first, dashboard-heavy.

### Bottom Navigation
```
[Dashboard] [Laporan] [Approval] [Lainnya]
```

### Halaman: Dashboard (`/owner/dashboard`) — Landing page default
**Komponen (mirip dashboard yang sudah ada di kerangka, tapi data asli):**
- Hero card: Omzet hari ini + sparkline 7 hari
- 2 card kecil: HPP hari ini, Profit hari ini
- Card: Stok produk jadi per varian (ringkas, tap untuk detail)
- Card: Alert bahan menipis (kalau ada)
- Card: Alert stock opname dengan discrepancy (kalau ada, dari Crew manapun)
- Card: Alert attendance perlu review (IP tidak valid)

### Halaman: Laporan (`/owner/reports`)
**Komponen:**
- Selector bulan
- P&L ringkas: Pemasukan → HPP → Laba Kotor → Operasional → Gaji → Laba Bersih
- Grafik omzet per channel (bar chart, mirip yang sudah ada di kerangka)
- Top pelanggan (list ringkas)

### Halaman: Approval (`/owner/approval`)
**Komponen:**
- Tab: Stock Opname Bermasalah | Attendance Perlu Review | Payroll Pending
- Setiap item: card dengan info ringkas + tombol "Review" → buka detail → approve/resolve

**Detail Review Stock Opname:**
- List item yang punya selisih (`difference != 0`), item lain (tanpa selisih) disembunyikan default
- Per item: "Tepung Terigu — Sistem: 4.500g, Fisik: 4.200g (selisih -300g)"
- Per item ada toggle/checkbox: "Sesuaikan stok sistem ke angka fisik" (default OFF — Manager pilih sendiri item mana yang perlu dikoreksi)
- Textarea catatan umum (opsional)
- Tombol "Selesaikan Review" — kirim sekaligus mana yang diacknowledge biasa vs yang dikoreksi
- Setelah submit: konfirmasi ringkas "1 bahan disesuaikan, 1 bahan diacknowledge tanpa perubahan"

### Halaman: Lainnya (`/owner/more`)
**Komponen:**
- Link ke: Pengaturan Absen (whitelist IP), Manajemen Karyawan, Manajemen Produk (read-only untuk Owner, edit hanya Manager — atau samakan akses, tergantung kepercayaan internal)

---

## ROLE: MANAGER

Akses paling lengkap. Mobile untuk on-the-go, Desktop untuk kerja detail (input banyak data, review laporan panjang).

### Bottom Navigation (Mobile)
```
[Dashboard] [Kasir] [Inventori] [Lainnya]
```

### Sidebar (Desktop) — lebih banyak opsi langsung terlihat
```
Dashboard | Kasir/POS | Produksi | Inventori | Pelanggan | Karyawan | Laporan | Pengaturan
```

### Halaman: Dashboard (`/manager/dashboard`)
Sama seperti Owner, tapi dengan tambahan quick actions: "Input Transaksi", "Catat Pengeluaran", "Generate Payroll".

### Halaman: Detail Order (`/manager/orders/:id`)
**Komponen:**
- Info pelanggan: Nama, No HP, Alamat Pengiriman, Tanggal Pengiriman diminta
- List item yang dipesan + subtotal
- Keterangan Pesanan dari customer (kalau ada)
- Foto bukti transfer (kalau di-upload customer) — bisa diperbesar/zoom
- **Input Ongkos Kirim** (manual, angka bebas) + tombol "Konfirmasi Ongkir" — setelah dikonfirmasi, total akhir (produk + ongkir) baru muncul
- **Tombol "Generate Invoice"** (aktif hanya setelah ongkir dikonfirmasi) → buat PDF formal (logo, rincian, total, info rekening) → tombol "Download PDF" muncul setelah berhasil
  - Kalau sudah pernah generate sebelumnya → tombol berubah jadi "Download Invoice" + opsi kecil "Generate Ulang" (misal kalau ongkir direvisi)
- Status pembayaran (toggle Belum Bayar/Lunas)
- Status order (toggle Belum Selesai/Selesai)
- Khusus order yang berisi Rainbow → link ke halaman Rainbow Assembly kalau masih `pending_approval`
- *(Khusus role Owner)* Tombol "Void Order" — dengan dialog konfirmasi sebelum eksekusi, mengembalikan stok semua item (termasuk penanganan khusus kalau ada item Rainbow)

**Alur kerja singkat:** Order masuk → Manager cek alamat → input & konfirmasi ongkir → generate invoice → download PDF → kirim manual ke WA pembeli → pembeli transfer → Manager update status jadi Lunas.

### Halaman: Kasir/POS (`/manager/pos`) — **Cart-based, beda dari kerangka sekarang**
**Komponen:**
- Pilih Pelanggan (search/dropdown dari customers)
- Tombol "+ Tambah Item" → modal pilih Produk → pilih Varian → input Qty → harga otomatis muncul sesuai tier
  - **Khusus produk Rainbow:** tidak ada pilih varian (otomatis campuran 6 varian), input jumlah PAKET, harga sesuai tier paket
- Cart list: setiap item ditampilkan dengan qty, harga, subtotal, tombol hapus
- Summary di bawah: Subtotal, Diskon, Total
- Pilih metode pembayaran + status bayar (lunas/belum)
- Tombol besar "Buat Order"
- Setelah submit: kalau `needsProduction=true` → tampilkan banner "Stok kurang, perlu produksi tambahan untuk memenuhi order ini"
- **Kalau ada item Rainbow** → tampilkan banner tambahan: "🌈 Order ini berisi Rainbow, perlu di-assembly" + link langsung ke halaman Rainbow Assembly

### Halaman: Rainbow Assembly (`/manager/rainbow-assembly`)
**Konsep:** Tahap approval WAJIB sebelum stok varian individual berkurang untuk pesanan Rainbow. Tidak ada pengurangan stok otomatis — semua lewat review Manager dulu.

**Komponen:**
- List order Rainbow yang masih `pending_approval` (badge jumlah di nav kalau ada yang pending)
- Tap 1 order → tampilkan breakdown 6 varian dengan rekomendasi sistem:
  ```
  Original   → dari Pack Jadi (4 pcs, sisa pack masuk "Pack Terbuka")
  Charcoal   → dari Pool Loyang (4 pcs, sisa 6 loyang)
  Red Velvet → dari Pack Jadi (4 pcs)
  Taro       → ⚠️ Stok tidak cukup, akan jadi "perlu produksi"
  Coklat     → dari Pool Loyang (4 pcs)
  Greentea   → dari Pack Jadi (4 pcs)
  ```
- Tiap varian punya tombol kecil "Ubah sumber" — Manager bisa override (misal pindah dari Pack Jadi ke Pool Loyang)
- Tombol besar "Konfirmasi & Proses" — baru di titik ini stok benar-benar dikurangi
- Setelah konfirmasi: tampilkan ringkasan termasuk "Pack Terbuka" baru yang tercipta (kalau ada), dengan link ke halaman pengelolaannya

### Halaman: Pack Terbuka (`/manager/open-packs`)
**Konsep:** Tempat Manager kelola sisa pack yang sudah dibongkar sebagian (dari proses Rainbow Assembly).

**Komponen:**
- List `openPacks` dengan status `open`: "Regular Original — sisa 8 pcs (dari order ORD-xxx)"
- Aksi yang bisa diambil per item: "Gabungkan ke Rainbow order lain" / "Tandai sudah dipakai habis" / "Buang (rusak)"
- Setelah resolved, item pindah ke histori (tidak hilang, untuk audit)

### Halaman: Pengeluaran Stok Non-Penjualan (`/manager/stock-adjustments`)
**Konsep:** Untuk mencatat stok yang keluar bukan karena dijual -- sample affiliate, hadiah teman, bonus kerabat, rusak, dll. Tetap tercatat sebagai biaya di laporan, supaya laba tidak terlihat lebih besar dari kenyataan.

**Komponen:**
- Tombol "+ Catat Pengeluaran"
- Form: Pilih Produk → Pilih Varian → Qty
- Pilih Kategori (chip): Sample Affiliate / Hadiah-Bonus / Rusak-Reject / Konsumsi Internal / Lainnya
  - Kalau pilih "Lainnya" → muncul textarea custom
- *(opsional)* Nama penerima — misal nama affiliate atau teman
- Preview: "Akan tercatat sebagai biaya ≈ Rp[nilai HPP]"
- Tombol "Simpan"
- List histori di bawah, bisa difilter per kategori/bulan

### Halaman: Produksi & Pre-Packing (`/manager/production`)
Sama seperti Crew (lihat halaman Produksi & Pre-Packing di atas), tapi Manager bisa lihat & input untuk crew manapun, plus akses penuh ke histori loyang pool semua varian (untuk monitoring berapa lama loyang "mengendap" sebelum di-pack — indikator kalau produksi terlalu jauh di depan permintaan).

### Halaman: Inventori (`/manager/inventory`)
**Sub-tab:**
- **Bahan Baku** — list + stok computed + status (Aman/Menipis/Habis) + tombol edit minStock
  - Form "+ Bahan Baru": Nama, Kategori, Satuan, Stok Minimum, toggle "Pakai metode kemasan?" (ON kalau bahan dalam botol/kemasan gelap → muncul input `unitPerPackage` dan label kemasan)
- **Pengeluaran** — list pengeluaran per bulan + form tambah baru
  - Form "+ Catat Pengeluaran": pilih Bahan (dropdown) → satuan auto-fill, input Qty + Total Harga (bukan harga/unit — sistem hitung otomatis), pilih Metode Bayar, Supplier (opsional)
- **Produk** — list 5 produk (Regular, Full, TikTok, Matang, Rainbow) + edit harga/deskripsi
- **Resep** — per produk, list bahan + qty per batch, bisa edit

### Halaman: Pelanggan (`/manager/customers`)
- List customer + channel + diskon
- Form tambah/edit customer baru

### Halaman: Karyawan (`/manager/employees`)
**Sub-tab:**
- **Absensi** — kalender/list attendance semua crew, filter per orang, highlight yang status='direview'
- **Payroll** — pilih bulan → tombol "Generate Payroll" → list hasil per karyawan dengan badge **"Final"** (hijau) atau **"⚠️ Parsial"** (kuning, kalau ada absen `direview` yang belum diselesaikan) → edit `performanceBonus` per baris → tombol "Tandai Dibayar"
  - Kalau tap "Tandai Dibayar" pada baris berstatus Parsial → muncul dialog konfirmasi: "Data [nama] masih ada 2 absen belum direview. Tetap bayar dengan data ini?" — perlu konfirmasi eksplisit sebelum lanjut
  - Setelah dibayar, baris terkunci (tidak bisa di-generate ulang/ketimpa) — ada ikon gembok kecil sebagai indikator visual

### Halaman: Laporan (`/manager/reports`)
Sama seperti Owner tapi dengan detail lebih (bisa export, lihat per-transaksi).

### Halaman: Pengaturan (`/manager/settings`)
- **Absen** — lihat whitelist IP, banner kalau ada `lastDetectedIp` baru, tombol approve
- **Stock Opname** — list yang perlu direview

---

## ROLE: CUSTOMER (Public, No Login)

Cuma 1 halaman, diakses lewat link yang dikirim manual (WA).

### Halaman: Form Pemesanan WhatsApp (`/order` generik)
**Komponen (sesuai format pemesanan yang sudah dipakai Aya):**
- Header sederhana: Logo Anchur + "Form Pemesanan"
- Input **No HP** duluan (di urutan paling atas) — sistem cek otomatis ke data customer lama (debounced, tidak perlu klik tombol cek manual)
  - Kalau cocok → Nama & Alamat auto-fill (tetap bisa diedit kalau alamat berubah)
  - Kalau tidak cocok → field Nama & Alamat kosong, customer isi manual
- Input **Tanggal Pengiriman** (wajib, date picker, tidak bisa pilih tanggal lampau)
- Input **Alamat Pengiriman** (textarea)
- Tombol "+ Tambah Item" → pilih Produk → pilih Varian → pilih Qty (harga otomatis sesuai tier, dan diskon otomatis kalau No HP match customer lama)
- Mini-cart: list item + subtotal per item
- Input **Keterangan Pesanan** (opsional, textarea bebas)
- Ringkasan: **Subtotal Produk** + catatan kecil: *"Ongkos kirim akan dikonfirmasi terpisah oleh Anchur sebelum pengiriman"*
- Info rekening pembayaran (statis, ditulis manual di sini): "Transfer BCA [nomor] a/n [nama]"
- Upload **Bukti Transfer** (opsional, boleh skip — ada catatan kecil "Atau kirim susulan via WhatsApp")
- Tombol besar "Kirim Pesanan"
- Setelah submit: halaman konfirmasi — "Pesanan diterima! No. Order: ORD-XXXX. Ongkir akan dikonfirmasi terpisah. Jangan lupa kirim bukti transfer via WA kalau belum upload di sini."

**Tidak ada di halaman ini:**
- HPP, margin, atau data internal apapun
- Riwayat order (customer tidak bisa lihat order lamanya — itu informasi yang dipegang manual oleh Manager/Owner via WA)
- Kalkulasi ongkir otomatis (sengaja tidak ada — selalu dikonfirmasi manual karena sering perlu judgement kasus per kasus)

---

## Komponen Shared (Dipakai Lintas Role)

| Komponen | Dipakai di | Catatan |
|---|---|---|
| `StatCard` | Dashboard semua role | Sudah ada di kerangka, reusable |
| `StepperInput` | POS, Produksi | Sudah ada di kerangka |
| `ProductVariantPicker` | POS, Produksi, Form Public | BARU — dropdown 2 tingkat (Produk → Varian) |
| `AttendanceStatusCard` | Crew Absen, Owner/Manager Approval | BARU |
| `StockBadge` | Inventori, Dashboard | Mirip `Badge` yang ada, warna sesuai status |
| `OrderCart` | POS Manager, Form Public | BARU — list item + subtotal, reusable antara internal & public |
| `RoleGuard` | Wrapper semua halaman | BARU — redirect kalau role tidak sesuai akses halaman |

---

## Catatan Desain Mobile-First

Karena crew dan sebagian besar interaksi terjadi di HP saat tangan mungkin masih ada sisa tepung/minyak:
- Touch target minimum 48px (lebih besar dari standar 44px kerangka sekarang)
- Hindari input teks panjang — pakai dropdown/stepper sebanyak mungkin
- Konfirmasi visual jelas (toast besar, bukan teks kecil) setelah setiap submit
- Untuk Absen khususnya: 1 tombol besar, full-width, warna kontras tinggi — minim kemungkinan salah tap

---

*Dokumen ini melengkapi Firestore_Data_Model.md dan API_Routes_Breakdown.md. Setiap halaman di sini akan consume 1 atau lebih API routes yang sudah didefinisikan.*
