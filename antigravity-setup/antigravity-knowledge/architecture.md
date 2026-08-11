# Architecture — Anchurpos

Verified architecture of the anchurpos codebase. Read this before reasoning
about data flow, routing, or where to make a change.

## Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| UI | React 18 + TailwindCSS + custom shadcn-style components |
| Auth | Firebase Auth (client SDK) + Firebase Admin SDK (server verification) |
| Database | Cloud Firestore (server-side via Admin SDK; no client SDK writes) |
| Validation | zod — all schemas centralized in `lib/validations.ts` |
| Deployment | Vercel — production at `anchurpos.vercel.app` |
| Forms | Plain `useState` (NO react-hook-form despite it being installed) |
| Data fetching | Native `fetch` wrapped per-page in a local `fetchWithAuth`. NO axios, NO SWR, NO react-query. |

## Directory map (high-level)

```
app/
├── layout.tsx                  # Root server layout (AuthProvider + Toaster)
├── order/                      # PUBLIC order form (no auth)
├── api/                        # All API routes (route.ts per folder)
│   ├── orders/                 # + [id]/, [id]/edit, public/
│   ├── products/               # + [id]/, stocks/, variants subcollection
│   ├── variants/               # + [id]/
│   ├── customers/              # + [id]/
│   ├── suppliers/              # + [id]/
│   ├── ingredients/            # + [id]/, low-stock/, movements/, stock/
│   ├── alerts/                 # + read-all/, [id]/read/
│   ├── auth/login/             # Firebase token exchange
│   ├── public/                 # Public product/variant/stock reads
│   └── settings/               # marketplace-fee, pos-packaging, system-configs
├── manager/                    # Role: owner + manager
│   ├── layout.tsx              # Client layout, renders <NotificationBell/>
│   ├── dashboard/, pos/, orders/, master-data/, inventory/, bom/,
│   ├── expenses/, purchases/, payroll/, employees/, reports/, omzet/,
│   ├── sfm/, rainbow-assembly/, stock-adjustments/, settings/, profile/
├── owner/                      # Role: owner only
│   ├── layout.tsx              # Client layout, renders <NotificationBell/>
│   └── dashboard/, orders/, inventory/, employees/, approval/, sfm/, ...
├── crew/                       # Role: crew
│   ├── layout.tsx              # Client layout (no NotificationBell)
│   └── dashboard/, attendance/, payroll/, sfm/, stock-opname/, settings/
components/
├── shared/                     # NotificationBell, RoleGuard, AlertConfirmProvider, BottomSheet
├── ui/                         # Input, Skeleton, etc. (shadcn-style)
lib/
├── auth-context.tsx            # AuthProvider + useAuth() hook (client)
├── auth-middleware.ts          # verifyAuth + requireRole (server)
├── firebase-client.ts          # Client Firebase init (auth only)
├── firebase-admin.ts           # Admin SDK init (db + auth verification)
├── validations.ts              # ALL zod schemas (single source of truth)
├── business-logic.ts           # HPP calculation, ingredient cost aggregation
types/
└── index.ts                    # Shared TS interfaces (incomplete — see notes)
```

## Routing & protection model
- **NO `middleware.ts` exists.** Route protection is enforced only at the
  API-handler level via `requireRole(req, roles)`, and on the client via the
  `<RoleGuard>` component.
- Page routes (`/manager/*`, `/owner/*`, `/crew/*`) are NOT server-protected —
  they rely on client-side `RoleGuard`. If a user manually navigates, the page
  renders then redirects. This is a known limitation, not a bug to "fix" unless
  asked.

## Data flow (typical write)
```
Client component (useState form)
  → fetchWithAuth("Bearer ${token}")  ← token from useAuth().getToken()
  → POST /api/<entity>/route.ts
  → requireRole(req, [...roles])       ← returns 401/403 if bad
  → zod safeParse(body)                ← returns 400 + details if invalid
  → adminDb.collection(...).add/update ← Firestore write
  → NextResponse.json({ id, ... })
```

## Auth model (critical — most bugs live here)
- **Token transport**: `Authorization: Bearer <firebaseIdToken>` header.
  There is NO session cookie. If the header is missing → `verifyAuth` returns
  `null` → route returns 401.
- **Client**: `lib/auth-context.tsx` exposes `useAuth()` → `{ user, role,
  loading, getToken, login, logout }`. `getToken()` returns the live Firebase
  ID token via `user.getIdToken()`.
- **Server**: `lib/auth-middleware.ts`:
  - `verifyAuth(req)` → `AuthUser | null` (decodes token via Admin SDK, requires
    a `role` custom claim).
  - `requireRole(req, allowedRoles)` → `AuthUser | NextResponse(401|403)`.
- **Custom claim**: `role` is set on the Firebase user (`owner` | `manager` |
  `crew`). Without it, even a valid token returns 401.

See `api-and-auth.md` for the full auth pattern and the recurring failure modes.

## Roles & capabilities (summary)
| Capability | owner | manager | crew |
|---|---|---|---|
| View orders (GET /api/orders) | ✅ | ✅ | ✅ |
| Create/edit orders | ✅ | ✅ | ❌ (403) |
| Master data CRUD | ✅ | ✅ | ❌ |
| Inventory adjustments | ✅ | ✅ | limited (own station) |
| SFM production workflow | ✅ | ✅ | ✅ (assigned work) |
| Approvals / payroll | ✅ | limited | ❌ |
| Back-dated order entry | ✅ | ✅ | ❌ |

## Known architectural debts (do not "fix" unless explicitly asked)
1. `fetchWithAuth` is duplicated in 30+ files instead of a shared hook.
2. No `react-hook-form` usage despite being installed — all forms are manual
   `useState`. Migrating is a big refactor; only do it if authorized.
3. `types/index.ts` is incomplete: no `Supplier` interface; `Customer` is
   missing `code`/`email`/`creditLimit`/`poNumber`; `Ingredient` missing `price`.
4. Master data lives in ONE giant page (`app/manager/master-data/page.tsx`,
   ~2400 lines) with 4 tabs. Splitting it is valid scope only if authorized.
5. Two parallel add-on systems exist: ingredients with `category: "add_on"`
   AND a separate `addOns` Firestore collection. Confirm which is canonical
   before changing add-on logic.

## Deployment
- `npm run build` must pass before Vercel deploy.
- Env vars required: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`, plus client-side `NEXT_PUBLIC_FIREBASE_*`.
- Production URL: `https://anchurpos.vercel.app`.
