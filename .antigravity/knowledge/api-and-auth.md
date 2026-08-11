# API & Auth Conventions — Anchurpos

This is the most bug-prone surface in the codebase. Read carefully before
touching any client-side `fetch` or any API route.

## The #1 rule
**Every client-side `fetch()` to `/api/*` MUST attach an `Authorization` header.**

There is NO session cookie. Auth is 100% via the `Authorization: Bearer <token>`
header. If you forget it, the route returns 401 and the feature silently breaks.

## Correct pattern — `fetchWithAuth`

Defined locally in each page via `useCallback`. The canonical shape:

```tsx
const { getToken } = useAuth();
const fetchWithAuth = useCallback(async (url: string, options?: RequestInit) => {
  const token = await getToken();
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}, [getToken]);
```

Usage: `const res = await fetchWithAuth("/api/orders");`

### Two variant forms exist (both correct):
- **Full** `(url, options?)` — for POST/PATCH/DELETE with body.
- **GET-only** `(url)` — omits the options param, headers only.

### Where `getToken` comes from
`useAuth()` hook in `lib/auth-context.tsx`. Returns the live Firebase ID token
via `user.getIdToken()`. Also exposes `loading` (false once `onAuthStateChanged`
resolves) and `role` (from the `role` custom claim).

## Server-side auth helpers — `lib/auth-middleware.ts`

### `verifyAuth(req): Promise<AuthUser | null>`
- Reads `Authorization: Bearer <token>` header. If missing → `null`.
- Verifies token via Firebase Admin `verifyIdToken`. Invalid/expired → `null`.
- Reads the `role` custom claim. If absent → `null` (even with valid token).
- Returns `{ uid, email, role }` on success.

### `requireRole(req, allowedRoles): Promise<AuthUser | NextResponse>`
- Calls `verifyAuth`. If `null` → returns `NextResponse.json({ error:
  "Unauthorized" }, { status: 401 })`.
- If `user.role` not in `allowedRoles` → returns `403 Forbidden`.
- Otherwise returns the `AuthUser`.

### Route handler usage
```ts
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;   // ← early return on 401/403
  // ... handler body, auth.uid / auth.role available
}
```

### Public routes (intentional — no auth)
- `/api/public/products`, `/api/public/variants`, `/api/public/products/stocks`
- `/api/orders/public` (POST — public order submission from `/order` page)
- `/api/auth/login` (Firebase token exchange)

These do NOT call `requireRole`. The `/order` page legitimately uses bare
`fetch` for these. Do not "fix" them.

### Semi-public pattern (orders POST)
`POST /api/orders` allows EITHER an authenticated owner/manager OR an
unauthenticated public submission:
```ts
const user = await verifyAuth(req);
const isPublic = !user;
if (!isPublic) {
  const roleCheck = await requireRole(req, ["owner", "manager"]);
  if (roleCheck instanceof NextResponse) return roleCheck;
}
```
`crew` is NOT allowed to create orders via this route (only view via GET).

## Recurring bug class: bare `fetch` (the 401 spam)

### Confirmed buggy files (as of last audit — VERIFY before assuming still broken):
- `components/shared/NotificationBell.tsx:30` — `fetch("/api/alerts?unread=true")`
- `components/shared/NotificationBell.tsx:82` — `fetch("/api/alerts/read-all", ...)`
- `components/shared/NotificationBell.tsx:108` — `fetch("/api/alerts/${id}/read", ...)`
- `app/manager/pos/components/CartCheckoutPanel.tsx:81` — `fetch("/api/settings/pos-packaging")`
- `app/manager/pos/components/CartCheckoutPanel.tsx:82` — `fetch("/api/ingredients")`

### When you find one bare fetch, sweep for the class
Run a search for `fetch("/api/` and `fetch(\`/api/` across `app/` and
`components/`. Every match in a `"use client"` file MUST be either:
1. Replaced with `fetchWithAuth`, OR
2. Confirmed to hit a public route (the `/api/public/*` set above), OR
3. Confirmed to already be inside a helper that injects auth.

## API route conventions

### Response shapes
- **Success**: `NextResponse.json({ ...data })` or `NextResponse.json([...])`.
- **Validation failure (zod)**: `NextResponse.json({ error: "Data tidak valid",
  details: parseResult.error.format() }, { status: 400 })`.
- **Auth failure**: 401 (no/invalid token) or 403 (wrong role).
- **Server error**: `{ error: "Gagal <action>" }, { status: 500 }`.

### Validation enforcement
- ALL schemas live in `lib/validations.ts`. Do not define inline zod schemas
  in route handlers.
- Read validated fields from `parseResult.data`, NOT from raw `body`. Raw `body`
  is a smell — if a field is in `body` but not in the schema, the schema is
  incomplete and should be extended (see `validation-contract.md`).
- The client receives `details` on 400 — UI SHOULD map these to per-field errors.
  (Many current UIs only read `data.error` generically — that's a UX bug, fixable.)

### Delete semantics (DO NOT mix up)
| Entity | Delete strategy |
|---|---|
| products, variants | Soft: `isActive: false`. GET filters `where("isActive", "==", true)`. |
| customers | Soft: `isActive: false`. |
| suppliers | Hard: `ref.delete()`. |
| ingredients | Hard: `ref.delete()` (with referential guard against recipes). |

### Auto-generated codes
- `customers.code`: `CUST-<random4>` if not supplied. GET fallback uses doc.id prefix.
- `suppliers.code`: `VEND-<random4>` if not supplied.
- `products.code`: REQUIRED, user-supplied, uppercased.

## NotificationBell specifically
Mounted in `app/manager/layout.tsx` and `app/owner/layout.tsx` → fires on EVERY
page in those areas. Its `useEffect` polls every 30s. If it 401s, it spams the
console on every page load. This is why a single missing auth header here is
high-impact. Fix priority: P0 whenever touched.

## Quick reference — common endpoints
| Route | Methods | Roles |
|---|---|---|
| `/api/orders` | GET, POST | GET: all roles; POST: owner/manager (or public) |
| `/api/orders/[id]` | GET, PATCH, DELETE | owner/manager |
| `/api/products` | GET, POST | owner/manager |
| `/api/variants` | GET, POST | owner/manager |
| `/api/customers` | GET, POST | owner/manager |
| `/api/suppliers` | GET, POST | owner/manager |
| `/api/ingredients` | GET, POST | owner/manager |
| `/api/alerts` | GET | owner/manager |
| `/api/settings/*` | GET, POST | owner/manager |
| `/api/public/*` | GET | public |
| `/api/orders/public` | POST | public |
