# Skill: UI/UX Principles — Berpikir Kreatif & Tepat Sasaran

## Ikhtisar

Skill ini mengatur **cara berpikir tentang UI/UX** sebelum dan selama menulis kode frontend. Berlaku untuk semua proyek — web, desktop, maupun hybrid.

---

## Langkah 0: Definisikan User Intent SEBELUM Menulis Kode UI

Untuk **setiap komponen atau halaman**, jawab ini dulu:

```
Siapa user-nya?         → [nama/peran]
Tujuan utama mereka?    → [aksi utama dalam 1 kalimat]
Frekuensi pemakaian?    → [setiap hari / sesekali / jarang]
Kondisi pemakaian?      → [terburu-buru / santai / monitoring]
```

Jawaban ini menentukan: seberapa prominens CTA utama, seberapa banyak info yang ditampilkan default, seberapa cepat feedback harus muncul.

---

## Hierarki Visual: Satu Fokus Per Area

**Aturan utama**: Setiap area layar harus punya **satu elemen paling menonjol** — primary action atau informasi terpenting.

```
❌ Semua elemen punya bobot sama → user bingung harus ke mana
✅ Satu primary button dominan + secondary/tertiary yang lebih kecil
```

**Cara implementasi di Tailwind:**
```
Primary:    bg-[accent] text-white px-6 py-3 rounded-lg font-semibold
Secondary:  border border-[surface] text-[secondary] px-4 py-2 rounded-lg
Tertiary:   icon button tanpa border, opacity lebih rendah
```

**Icon + label** selalu lebih baik daripada label saja untuk aksi yang berulang — mengurangi cognitive load.

---

## Progressive Disclosure: Default Minimal

Tampilkan hanya yang dibutuhkan untuk keputusan saat ini. Sisanya → accordion, tooltip, atau panel terpisah.

```
❌ Semua info dump sekaligus (technical details, metadata, log, status internal)
✅ Nama item + status utama + aksi primer → detail on-demand via expand/modal
```

**Aturan praktis**: Jika user tidak perlu info X untuk membuat keputusan utama, sembunyikan X secara default.

---

## Status Visual: Sistem Warna Konsisten

Buat sistem status yang **konsisten di seluruh aplikasi** — jangan 3 cara berbeda untuk menunjukkan "berhasil":

| Status | Warna | Icon |
|--------|-------|------|
| Selesai / Berhasil | green / emerald | `✓` |
| Sedang proses | blue / indigo | spinner / `◌` |
| Belum / Pending | gray / slate | `○` |
| Error / Gagal | red | `✗` |
| Perlu perhatian | yellow / amber | `△` |

**Warna selalu berpasangan dengan icon atau label** — jangan mengandalkan warna saja (aksesibilitas).

---

## Feedback Instan: Setiap Aksi Harus Ada Respons

```
❌ User klik → tidak ada yang terjadi selama 2 detik → user klik lagi
✅ User klik → button disabled + spinner → success state / error message
```

**Pattern wajib:**
- Button `loading` state: disabled + spinner selama proses
- Success: perubahan visual pada item (status berubah, badge muncul) + toast
- Error: toast/inline message yang **actionable** — sebutkan apa yang salah dan apa yang harus dilakukan
- Toast: gunakan sistem toast yang **sudah ada di proyek** — jangan buat yang baru

---

## Layout Patterns Umum

### List + Detail Panel
```
┌─────────────────┬──────────────────────────────────┐
│  LIST           │  DETAIL / ACTION PANEL           │
│  [item 1] ←     │  [Nama + status]                 │
│  [item 2]       │  [PRIMARY ACTION BUTTON]         │
│  [item 3]       │  [secondary actions]             │
└─────────────────┴──────────────────────────────────┘
```
Primary action harus **selalu visible** tanpa scroll di panel detail.

### Form: Urutan Logis + Error Inline
- Urutan field mengikuti alur berpikir user (bukan urutan database)
- Error inline di bawah field, bukan semua di atas form
- Submit button disable saat form tidak valid atau sedang submit

### Empty State: Informatif, Bukan Kosong
```
❌ [halaman kosong / loading spinner tanpa batas]
✅ [icon] + pesan kontekstual + CTA ("Belum ada data. Tambah yang pertama.")
```

---

## Copy & Label: Jelas dan Actionable

```
❌ "Process" / "Submit" / "Error occurred"
✅ "Upload ke Drive" / "Simpan Pesanan" / "Gagal menyimpan: koneksi terputus"
```

**Error message harus menjawab**: *Apa yang salah? Apa yang harus saya lakukan?*

**Label button harus menjawab**: *Apa yang akan terjadi setelah saya klik ini?*

---

## Checklist Sebelum Submit UI Code

- [ ] Aksi utama halaman sudah paling menonjol visually?
- [ ] Sistem warna status konsisten dengan halaman lain di proyek ini?
- [ ] Ada progressive disclosure — info non-esensial bisa di-hide?
- [ ] Setiap aksi punya feedback (loading → success/error)?
- [ ] Label/copy jelas, menjelaskan aksi/kondisi, dalam bahasa proyek?
- [ ] Toast/notifikasi pakai sistem yang sudah ada (bukan buat baru)?
- [ ] Tidak ada magic number layout hardcoded yang akan rusak saat konten berubah?
- [ ] Empty state informatif (ada pesan + CTA)?
- [ ] Error message actionable (sebutkan apa yang salah + apa yang harus dilakukan)?
