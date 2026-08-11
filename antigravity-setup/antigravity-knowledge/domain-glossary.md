# Domain Glossary — Anchurpos

Indonesian SMB food-processing business terms used throughout the codebase and
UI. Misunderstanding these causes wrong fixes. When in doubt, match the
existing Indonesian string verbatim.

## Core business terms

| Term | Meaning | Where it appears |
|---|---|---|
| **Anchurpos** | Portmanteau: "anchovy" + "POS". The product name. | branding |
| **Anchovy** | Ikan teri (the raw material the business processes). | product context |
| **Kasir** | Cashier / POS station. | `/manager/pos` page title "Input Pesanan" |
| **Pesanan** | Order. | orders domain |
| **Pelanggan** | Customer. | customers domain |
| **Pemasok** | Supplier / vendor. | suppliers domain |
| **Bahan baku** | Raw material / ingredient. | ingredients domain |
| **Produk** | Product (the sellable item, e.g. a 250g pack). | products domain |
| **Varian / Varian rasa** | Variant / flavor variant of a product. | variants domain |
| **Satuan** | Unit of measure (pcs, kg, pack, Loyang). | ingredient/product units |
| **Loyang** | Baking tray/pan (production unit). "LoyangCount" = how many trays. | production |
| **Pcs** | Pieces (the smallest sellable unit). | production / inventory |
| **HPP** | Harga Pokok Penjualan — Cost of Goods Sold (COGS). | `lib/business-logic.ts` `calculateProductHPP` |
| **Omzet** | Revenue / turnover (gross sales). | `/manager/omzet`, reports |
| **Pendapatan bersih** | Net revenue (after fees/shipping). | POS checkout panel |

## Order domain terms

| Term | Meaning | Notes |
|---|---|---|
| **Walk-in** | In-store customer, no prior contact. | `orderChannel: "walkin"`, `source: "walk_in"` |
| **PO / Nomor PO / Referensi** | Purchase Order number / reference number. | `poNumber` field. For B2B/Reseller customers. Optional. |
| **B2B** | Business-to-business customer type. | `customerType: "b2b"` |
| **Reseller** | Reseller customer type (gets tier pricing). | `customerType: "reseller"` |
| **Reguler** | Regular/retail customer type. | `customerType: "reguler"` (default) |
| **Grosir** | Wholesale (appears in some dropdowns — NOT in the type). | enum drift, see validation-contract.md |
| **Mitra** | Partner (appears in some dropdowns — NOT in the type). | enum drift |
| **Channel** | Where the order originated. | `walkin`/`whatsapp`/`tiktok`/`shopee` |
| **Marketplace fee** | Platform commission (TikTok/Shopee). | `platformFeePercent`, `platformFee` |
| **Back-dated order** | An order recorded with a past date. | `customDate`; owner/manager only |
| **Void** | Cancelled order (soft-deleted from active lists). | `status: "void"`, `voidReason`, `voidedAt` |
| **Sudah bayar / Belum bayar** | Paid / Unpaid. | `paymentStatus` enum |
| **Catat pesanan** | "Record the order" (the submit button). | POS checkout |
| **Kemasan pengiriman / Kantong** | Shipping packaging / bag (secondary packaging). | `secondaryPackagingIngId` |

## Production terms

| Term | Meaning | Notes |
|---|---|---|
| **SFM** | The internal production workflow name. | `/manager/sfm`, `/crew/sfm` — phased pipeline |
| **Batch** | One production run unit. | `batches` field |
| **Rainbow assembly** | A specific assembly step in the production pipeline. | `/manager/rainbow-assembly` |
| **Stock opname** | Physical inventory count/reconciliation. | `/manager/inventory/stock-opname`, `/crew/stock-opname` |
| **BOM** | Bill of Materials (recipe). | `/manager/bom` |
| **Stock adjustment** | Manual inventory correction (with reason). | `/manager/stock-adjustments` |
| **Mutasi** | Inventory movement log. | ingredient `[id]/movements` |

## Roles & HR

| Term | Meaning |
|---|---|
| **Owner** | Business owner (highest privilege). |
| **Manager** | Operational manager. |
| **Crew** | Production/warehouse worker (limited privileges, owns a station). |
| **Payroll** | Penggajian — salary/wage management. |
| **Attendance** | Kehadiran — clock in/out. |
| **Karyawan / Pegawai** | Employee. |

## UI string conventions
- All user-facing text is **Bahasa Indonesia**.
- Tone: casual-professional. Examples: "Gagal menyimpan pesanan", "Catat
  Pesanan (Belum Bayar)", "Tandai semua dibaca".
- Currency always IDR: `Intl.NumberFormat("id-ID", { style: "currency",
  currency: "IDR", minimumFractionDigits: 0 })`. The helper is named `fmt()`.
- Do not translate Indonesian strings to English when editing UI — match
  existing exactly.

## Common error messages (match verbatim when adding similar)
- `"Data tidak valid"` — zod validation failed (server).
- `"Gagal menyimpan pesanan"` — order POST failed (client catch).
- `"Gagal menghubungi server"` — network error (client catch).
- `"Gagal mengambil data order"` — GET orders failed.
- `"Pilih minimal 1 item"` — empty cart on checkout.
- `"Unauthorized"` — 401 (auth header missing/invalid).
- `"Forbidden"` — 403 (wrong role).
