# Testing & Verification Strategy — Anchurpos

A change is NOT done until these pass. Run them in this order; stop and fix at
the first failure.

## 1. Type check (fastest, run first)
```bash
npx tsc --noEmit
```
- Must produce ZERO errors.
- Common new error: adding a zod field without updating the TS interface, or
  vice versa. The type check catches contract drift early.

## 2. Lint
```bash
npm run lint
# or: npx next lint
```
- Warnings are tolerated but should be reviewed; errors block.
- The repo has no custom ESLint rules beyond Next.js defaults.

## 3. Production build
```bash
npm run build
```
- Catches server/client boundary violations, bad imports, route handler errors.
- Slowest gate but the most authoritative. Run before declaring done.
- If deploying to Vercel, this is what Vercel runs.

## 4. Manual repro (per affected feature)

For each user-facing change, document a repro: which page, which action, what
the expected visible result is. Do not just "open the page and look around."

### POS order creation (most-touched flow)
1. Log in as `manager` (or `owner`).
2. Go to `/manager/pos`.
3. Pick a channel (Walk-in / WhatsApp / TikTok / Shopee).
4. Add ≥1 product to cart (opens variant selector).
5. Open checkout.
6. For WhatsApp: pick/create a customer.
7. Submit. Expected: redirect to `/manager/orders/<newId>` with no console error.
8. Check browser DevTools console: NO 401 from `/api/alerts`, NO 401 from
   `/api/settings/pos-packaging` or `/api/ingredients`.
9. Verify the order appears in `/manager/orders` list.

### Notifications (after touching NotificationBell)
1. Log in as manager or owner.
2. Open DevTools console + Network tab.
3. Reload any `/manager/*` or `/owner/*` page.
4. Expected: `GET /api/alerts?unread=true` returns 200 (NOT 401).
5. Click the bell → dropdown opens, shows alerts (or "Belum ada notifikasi").
6. Click "Tandai semua dibaca" → `PATCH /api/alerts/read-all` returns 200.

### Master data (after touching customer/supplier/product/ingredient forms)
1. Go to `/manager/master-data`.
2. Per affected tab, test: create (happy path), create (missing required field →
   must show an error message, NOT silently abort), edit existing, save, reload
   to verify persistence.
3. Specifically for customers: edit `email` and `creditLimit`, save, reload —
   values MUST persist (regression test for the PATCH-drops-fields bug).

### Validation changes (after touching any zod schema)
1. Submit a form with deliberately invalid data (empty required field, wrong
   type). Expected: server returns 400 with `details`, and the UI surfaces a
   meaningful message (not a generic "Gagal").
2. Submit valid data. Expected: 200 + record created.

## 5. Auth verification (after touching auth or fetch patterns)
1. Hard reload (cold load) a protected page. The Firebase token resolves
   asynchronously — confirm the page does not error before `loading` flips.
2. Log out, then try to access `/manager/*` directly. Expected: redirect to
   login (client-side RoleGuard).
3. For any new `fetch` you added: confirm the Network tab shows the
   `Authorization: Bearer ...` header on the request.

## 6. Regression sweep checklist (when a fix might affect other areas)
After fixing one instance of a recurring bug class, check the SIBLING features:
- Touched customers? Check suppliers + products + ingredients forms too.
- Touched POS checkout? Check `/order` public form (different schema) and the
  order edit page (`/manager/orders/[id]/edit`).
- Touched a zod schema? Grep for every API route importing it
  (`grep -r "orderSchema" app/api/`).
- Touched `NotificationBell`? It runs on EVERY `/manager` and `/owner` page —
  smoke-test at least 2 different pages.

## What "done" means (honesty contract)
You may say a change is complete ONLY when ALL applicable gates above passed.
If you ran only some:
- Say "type-checked + linted, NOT build-verified."
- Say "edited, NOT tested" if you skipped manual repro.
Never say "fixed" or "verified" when you only edited source. State exactly what
was run and what wasn't.

## Test accounts / data
- The repo has no automated test suite (no jest/vitest). All verification is
  type-check + lint + build + manual.
- If you need seed data for manual testing, ask the user — do not fabricate
  Firestore writes.
- The production deployment is at `anchurpos.vercel.app`. Do not run destructive
  actions against production data without explicit user approval.
