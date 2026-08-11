# Known Anti-Patterns & Bug Catalog — Anchurpos

Catalog of recurring bug CLASSES observed in this codebase. When you find one
instance, sweep for all the others in the same class. Each entry has: the
pattern, why it's wrong, how to find more, and the correct shape.

> **Line numbers below were accurate at the time of writing. ALWAYS re-verify
> with `file:line` before treating as current.** The patterns are stable even
> if the exact lines drift.

---

## Class A: Bare `fetch` to protected `/api/*` (missing auth header)

### The bug
```ts
// ❌ WRONG — no Authorization header → 401
const res = await fetch("/api/alerts?unread=true");
```
The route calls `requireRole` → `verifyAuth` → no header → returns 401. The
feature silently breaks and the console fills with 401 spam.

### Why it happens
Devs forget that there is NO session cookie — auth is 100% via the
`Authorization: Bearer <token>` header. Copy-pasting a fetch from a public page
(or from memory of a cookie-based app) introduces this.

### Correct shape
```ts
// ✅ Use the fetchWithAuth pattern
const { getToken } = useAuth();
const fetchWithAuth = useCallback(async (url, options?) => {
  const token = await getToken();
  return fetch(url, { ...options, headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options?.headers,
  }});
}, [getToken]);
const res = await fetchWithAuth("/api/alerts?unread=true");
```

### How to sweep
```bash
grep -rn 'fetch("/api/' app/ components/
grep -rn 'fetch(`/api/' app/ components/
```
Every match in a `"use client"` file is suspect UNLESS it hits a known public
route (`/api/public/*`, `/api/orders/public`, `/api/auth/login`).

### Known instances (re-verify before fixing)
- `components/shared/NotificationBell.tsx` — 3 fetches (alerts GET, read-all
  PATCH, single-read PATCH). High-impact: runs on every `/manager` + `/owner`
  page on a 30s timer.
- `app/manager/pos/components/CartCheckoutPanel.tsx` — 2 GETs in a `useEffect`
  (`/api/settings/pos-packaging`, `/api/ingredients`). Breaks the "Smart
  Auto-Select" packaging feature.

---

## Class B: API reads from raw `body` instead of `parseResult.data`

### The bug
```ts
// ❌ WRONG — bypasses zod validation
const parseResult = orderSchema.safeParse(body);
// ...
const poNumber = body.poNumber;        // not validated!
const customDate = body.customDate;
```
The field exists in the zod schema, but the handler reads it from `body`
instead of `parseResult.data`. Type and shape are unvalidated. Works by
accident; breaks silently if the schema tightens.

### Correct shape
```ts
const parseResult = orderSchema.safeParse(body);
if (!parseResult.success) { /* 400 */ }
const { poNumber, customDate, /* ...all fields */ } = parseResult.data;
```
Only fall back to `body` for fields deliberately outside zod — and those
should be ADDED to zod (see validation-contract.md).

### How to sweep
```bash
grep -rn "= body\." app/api/
grep -rn "body\.\w" app/api/ | grep -v "req.json"
```
Compare each `body.X` read against the schema imported by that route. Any field
that's in the schema but read from `body` is this bug.

### Known instance
`app/api/orders/route.ts` POST reads `customDate`, `shippingBorneBy`,
`deliveryMethod`, `sauceDistribution`, `poNumber` from raw `body` (lines ~134-140)
even though all are in `orderSchema`. Also reads `secondaryPackagingIngId` from
`body` (line ~284) — that one isn't in the schema at all and should be added.

---

## Class C: Silent abort in form save handlers (no user feedback)

### The bug
```ts
// ❌ WRONG — user clicks Save, nothing happens, no message
const handleSaveCustomer = async () => {
  if (!customerForm.name.trim()) return;   // silent!
  // ...
};
```
The user clicks Save with an empty required field. The handler returns early
with NO error message. The UI looks broken ("I clicked Save and nothing
happened").

### Correct shape
```ts
const handleSaveCustomer = async () => {
  if (!customerForm.name.trim()) {
    setErr("Nama pelanggan wajib diisi");   // surface the error
    return;
  }
  setErr("");                                // clear previous
  // ...
};
```
Match the existing banner pattern (rose-tinted box) used in `ProductForm`.

### How to sweep
```bash
grep -rn "if (!.*\.trim()) return" app/manager/
grep -rn "=> {$" app/manager/ -A 2 | grep "return;"
```
Look for early returns inside save/submit handlers that don't call a setter.

### Known instances
- `app/manager/master-data/page.tsx` `handleSaveCustomer` (~line 513)
- `app/manager/master-data/page.tsx` `handleSaveSupplier` (~line 554)
- Variants form uses inline `setErr` correctly — use as the reference pattern.

---

## Class D: PATCH handler drops fields the frontend sends

### The bug
The frontend PATCH body includes fields `{ name, code, email, creditLimit }`,
but the PATCH route only writes a subset to Firestore:
```ts
// ❌ WRONG — email and creditLimit silently discarded
if (body.name !== undefined) updates.name = body.name;
if (body.code !== undefined) updates.code = body.code;
// email and creditLimit never handled → lost
```
The user edits a field, clicks save, gets success — but the field doesn't
persist. Extremely confusing regression.

### Correct shape
Handle EVERY field the frontend can send. Better: drive updates from the zod
schema's parsed data so you can't miss one:
```ts
const parseResult = schema.safeParse(body);
if (!parseResult.success) { /* 400 */ }
const updates = { ...parseResult.data };
delete updates.id;  // never overwrite the id
await ref.update(updates);
```

### How to sweep
For each `PATCH`/`PUT` handler, diff the set of fields in the corresponding
form's submit body against the fields the handler writes. Any mismatch is this
bug. Cross-reference validation-contract.md for the per-domain maps.

### Known instance
- `app/api/customers/[id]/route.ts` PATCH — does not handle `code`, `email`,
  or `creditLimit` (frontend sends all three).
- Suppliers PATCH handles `code` correctly — use as the reference pattern.

---

## Class E: Enum drift across type / schema / UI

### The bug
The same logical enum has different members in different layers:
- `types/index.ts`: `customerType: "reguler" | "b2b" | "reseller"`
- master-data dropdown: `"reguler" | "reseller" | "grosir" | "mitra"`
- POS dropdown: `"reguler" | "b2b" | "reseller"`

Saving a `grosir` customer from the UI passes the inline check but violates
the TS type. Compiles only because the form state is loosely typed.

### Correct shape
Define the enum ONCE (in `types/index.ts` or a shared constant), and import it
everywhere. The zod schema, the TS type, and every dropdown must use the same
source.

### How to sweep
For each enum-like field (`customerType`, `category`, `status`, `source`,
`orderChannel`, `paymentStatus`, `role`), grep all three layers and diff:
```bash
grep -rn "customerType" app/ lib/ types/
```

### Known instance
`customerType` (see above). Also check ingredient `category`
(snake_case) vs supplier `category` (Title Case) — these represent overlapping
concepts with incompatible casing. Not strictly a bug but a consistency hazard.

---

## Class F: `isB2B`-style logical errors (always-truthy operator misuse)

### The bug
```ts
// ❌ WRONG — always truthy
const isB2B = effectiveCustomerType === "b2b" || "reseller";
```
`"reseller"` is a non-empty string → always truthy → `isB2B` is ALWAYS `true`.
The PO/reference field then renders for every customer instead of only B2B.

This class is insidious because it compiles, doesn't throw, and just silently
produces wrong UI. The user sees a field that shouldn't be there.

### Correct shape
```ts
const isB2B = effectiveCustomerType === "b2b" || effectiveCustomerType === "reseller";
// or
const isB2B = ["b2b", "reseller"].includes(effectiveCustomerType);
```

### How to sweep
```bash
grep -rn '|| "' app/ | grep -v node_modules
grep -rn "|| '[a-z]" app/ | grep -v node_modules
grep -rn "=== \".*\" || " app/
```
Look for `|| "<literal>"` patterns where the second operand is a constant
string/number rather than a comparison. ESLint's `no-constant-condition` can
catch some of these.

### Known instance
`app/manager/pos/components/CartCheckoutPanel.tsx:152` — was the root cause of
the "Nomor PO / Referensi appears for everyone" symptom reported by the user.

---

## Class G: Layout-level side effects that fire on every page

### The pattern / risk
`NotificationBell` is mounted in `app/manager/layout.tsx` AND
`app/owner/layout.tsx`. Any bug in it (auth, infinite loop, heavy fetch)
affects EVERY page in those areas. Layouts are amplifiers.

### Mitigation
When touching a layout-mounted component:
1. Treat it as P0 — the blast radius is the whole role area.
2. Verify it works on at least 2 different pages (not just dashboard).
3. Confirm it respects `loading` state — don't fetch before the token resolves.
4. Confirm cleanup in `useEffect` returns is correct (no leaked intervals).

### How to sweep
```bash
grep -rn "<NotificationBell" app/
grep -rn "layout.tsx" app/ -l
```
Audit every component imported by a `layout.tsx` — these are high-leverage.

---

## When you find a NEW anti-pattern
1. Add it to this file (pattern + why wrong + sweep command + correct shape).
2. Sweep the codebase for existing instances immediately.
3. Note whether the user authorized fixing the whole class or just the reported
   instance.

Keeping this catalog current is how the agent gets smarter over time about
THIS codebase's specific failure modes.
