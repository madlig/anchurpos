# Validation Contracts (Lockstep Map) — Anchurpos

This file maps the `schema ↔ API ↔ types ↔ UI` contract for each domain. When
you change ONE part, you MUST check all the others. Use this as your checklist.

**Single source of truth for schemas:** `lib/validations.ts`
**Single source of truth for types:** `types/index.ts` (note: incomplete)

## Schemas that exist (in `lib/validations.ts`)

| Schema | Lines | Used by (API) |
|---|---|---|
| `orderItemSchema` | 4–16 | nested in `orderSchema` |
| `orderSchema` | 18–39 | `/api/orders` POST, `/api/orders/[id]` PATCH (partial) |
| `publicOrderSchema` | 41–52 | `/api/orders/public` POST |
| `expenseCreateSchema` | 54–63 | `/api/expenses` POST |
| `purchaseCreateSchema` | 65–77 | `/api/purchases` POST |
| `productionSchema` | 79–86 | production routes |
| `productionBatchSchema` | 88–99 | SFM batch production |
| `employeeSchema` | 101–108 | `/api/employees` POST |
| `employeeUpdateSchema` | 110–112 | `/api/employees/[id]` PATCH |
| `priceTierSchema` | 114–118 | nested in `productSchema` |
| `productSchema` | 120–129 | `/api/products` POST |
| `ingredientSchema` | 131–142 | `/api/ingredients` POST |

## Schemas that are MISSING (validation is ad-hoc inline) — tech debt

| Domain | Schema needed | Current validation |
|---|---|---|
| Customers | `customerSchema` | `if (!name?.trim())` only — no zod |
| Suppliers | `supplierSchema` | `if (!name?.trim())` only — no zod |
| Variants | `variantSchema` | `if (!name?.trim())` only — no zod |

When adding these schemas, the lockstep set to update is large — see per-domain
sections below.

---

## Domain: ORDERS (the POS checkout path)

### Contract set (must move together)
| Layer | File | Field responsibility |
|---|---|---|
| Schema | `lib/validations.ts:18–39` | `orderSchema` |
| API create | `app/api/orders/route.ts` (POST, line ~100) | reads `parseResult.data` + some raw `body` |
| API edit | `app/api/orders/[id]/route.ts` (PATCH, line ~92) | `orderSchema.partial()` |
| UI — POS | `app/manager/pos/components/CartCheckoutPanel.tsx` | `handleCheckout` POST body |
| UI — edit | `app/manager/orders/[id]/edit/components/CustomerDetailForm.tsx` | PATCH body |
| Types | `types/index.ts` `Order` interface | field declarations |

### Known contract drift (bugs)
1. **`secondaryPackagingIngId`**: sent by POS UI (line ~211) but NOT in
   `orderSchema`. API reads from raw `body` (line ~284) → bypasses validation.
   FIX: add to schema, read from `parseResult.data`.
2. **`shippingBorneBy`, `deliveryMethod`, `sauceDistribution`, `poNumber`,
   `customDate`**: present in schema but API reads them from raw `body` (lines
   ~134–140) instead of `parseResult.data`. Works by accident. Should read from
   parsed data for consistency.
3. **`poNumber`**: schema says `z.string().nullable().optional()` (NOT required).
   A blank PO number never blocks creation. Do not "fix" by making it required
   unless the business rule actually changed.
4. **`invoiceNumber`**: always set to `null` on creation; populated later.

### `orderItemSchema` requirements (per cart line)
Required: `productId`, `variantId`, `variantName` (min 1), `productName` (min 1),
`qty` (int, positive), `basePrice` (≥0), `discountPerUnit` (≥0), `totalPrice` (≥0).
Optional: `sauceId`, `sauceName` (nullable).
Loose: `appliedTier` is `z.string()` with no `.min(1)` — empty string passes.

---

## Domain: CUSTOMERS (pelanggan)

### Contract set
| Layer | File |
|---|---|
| Schema | **MISSING** — should be added to `lib/validations.ts` |
| API | `app/api/customers/route.ts` (GET, POST), `[id]/route.ts` (PATCH, DELETE) |
| UI — master data | `app/manager/master-data/page.tsx` (inline form ~line 1319, save handler ~513) |
| UI — POS quick-add | `app/manager/pos/components/CartCheckoutPanel.tsx` (~line 170) |
| Types | `types/index.ts` `Customer` (~line 132) — INCOMPLETE |

### Known contract drift (bugs)
1. **`poNumber` dropped on customer creation**: POS sends `poNumber` in the
   POST body (`CartCheckoutPanel.tsx:175`), but `/api/customers` POST never reads
   it from `body` → silently lost on the customer record. (It IS saved on the
   order via `/api/orders`, just not on the customer.)
2. **Customer PATCH drops fields**: `/api/customers/[id]` PATCH does not handle
   `code`, `email`, or `creditLimit` even though the UI sends them. Edits to
   these fields are silently discarded.
3. **`customerType` enum drift**:
   - `types/index.ts`: `"reguler" | "b2b" | "reseller"`
   - master-data dropdown: `"reguler" | "reseller" | "grosir" | "mitra"` (extra!)
   - POS quick-add dropdown: `"reguler" | "b2b" | "reseller"`
   Pick ONE canonical enum and propagate. Recommended: `reguler | b2b | reseller`
   unless business needs `grosir`/`mitra`.
4. **Silent abort**: `handleSaveCustomer` does `if (!name.trim()) return;` with
   NO error message. User clicks Save, nothing happens, no feedback.
5. **`Customer` type missing**: `code`, `email`, `creditLimit`, `poNumber`.

### Auto-generated fields
- `code`: `CUST-<random4>` if not supplied (POST). GET fallback: `CUST-${doc.id.slice(0,4)}`.

---

## Domain: SUPPLIERS (pemasok)

### Contract set
| Layer | File |
|---|---|
| Schema | **MISSING** |
| API | `app/api/suppliers/route.ts`, `[id]/route.ts` |
| UI | `app/manager/master-data/page.tsx` (inline form ~line 1886, save ~554) |
| Types | **NO `Supplier` interface exists** — suppliers are untyped/`any` |

### Known behavior
- Hard delete (not soft).
- POST checks for duplicate name → returns existing id if found (idempotent-ish).
- `code`: `VEND-<random4>` if not supplied.
- Categories are human-readable: `"Bahan Baku"`, `"Packaging"`, `"Operasional"`,
  `"Lainnya"` (NOTE: different casing from ingredients which use snake_case).
- Silent abort on save like customers (no error message).

---

## Domain: PRODUCTS (produk) + VARIANTS

### Contract set
| Layer | File |
|---|---|
| Schema (product) | `lib/validations.ts:120–129` `productSchema` |
| Schema (variant) | **MISSING** |
| API | `app/api/products/route.ts`, `[id]/route.ts`; `/api/variants/*` |
| UI | `app/manager/master-data/page.tsx` (`ProductForm` ~71, `VariantForm` ~218) |
| Types | `types/index.ts` `Product` |

### Rules
- `code` is REQUIRED and user-supplied, uppercased.
- Soft delete (`isActive: false`).
- Price tiers live in a subcollection `products/{id}/priceTiers` AND optionally
  embedded as `priceTiers` array in the product doc. Confirm which is read.
- Variants: no zod schema; inline `if (!name?.trim())` only.

---

## Domain: INGREDIENTS (bahan baku)

### Contract set
| Layer | File |
|---|---|
| Schema | `lib/validations.ts:131–142` `ingredientSchema` |
| API | `app/api/ingredients/route.ts`, `[id]/route.ts`, `[id]/movements`, `[id]/stock`, `low-stock` |
| UI | `app/manager/master-data/page.tsx` (`IngredientForm` ~290), `app/manager/inventory/*` |
| Types | `types/index.ts` `Ingredient` — missing `price` |

### Rules
- Categories (snake_case): `bahan_baku`, `packaging`, `operasional`, `add_on`.
- `add_on` category items have a `price` field (used as sellable add-ons).
  This `price` field is missing from the `Ingredient` type.
- Hard delete with referential guard (cannot delete if used in a recipe/BOM).
- Two parallel add-on systems exist (ingredients `add_on` AND `addOns`
  collection). Confirm canonical before changing.

---

## How to add a new field to a domain (checklist)

Example: adding `taxId` to customers.
1. `lib/validations.ts` → add to `customerSchema` (create it if missing).
2. `types/index.ts` → add to `Customer` interface.
3. `app/api/customers/route.ts` POST → read from `parseResult.data`, write to Firestore.
4. `app/api/customers/[id]/route.ts` PATCH → handle the field in updates.
5. `app/api/customers/route.ts` GET → include in the returned object.
6. UI form → add input, add to form state, add to submit body.
7. UI list/detail → display the field if user-facing.
8. Run `tsc --noEmit` + `next lint` + `npm run build`.

If you skip any step, you have edited half a contract.
