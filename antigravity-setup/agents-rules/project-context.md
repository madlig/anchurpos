---
trigger: always
---

# PROJECT CONTEXT & PLANNING ENFORCEMENT (anchurpos)

This rule is ALWAYS ON. It enforces the working methodology for every task in
this repo and injects project-specific guardrails.

## A. Mandatory pre-flight (before editing any file)

Before writing or editing code, confirm you have read:
1. `AGENTS.md` at the project root.
2. The relevant knowledge file in `.antigravity/knowledge/` for the domain
   the task touches (see the table in AGENTS.md).
3. The specific file(s) you are about to edit — read them yourself, do not rely
   on secondhand summaries for files central to the decision.

If you have NOT read these, your first action is to read them, not to edit.

## B. Planning workflow (for non-trivial tasks)

A task is "non-trivial" if ANY of these are true:
- Touches more than 2 files.
- Touches a zod schema, API route, or shared type.
- Is a bug report or error-fix.
- Touches auth, payments, inventory, or production (SFM).

For non-trivial tasks, follow this sequence (mirrors the global GEMINI.md
methodology, specialized for this repo):

### Phase 0 — Reframe (3 lines)
- EXPLICIT ask: literal request.
- IMPLIED need: job-to-be-done.
- LIKELY real problem: root-cause hypothesis (to be proven).

### Phase 1 — Explore (parallel, evidence-only)
Fan out across the affected domains. For anchurpos, the common domains are:
POS/checkout, orders, master-data (produk/bahan/pelanggan/pemasok), inventory,
SFM production, payroll, expenses, reports, auth.
Report `file:line` + snippet. NO fixes proposed yet.

### Phase 2 — Read critical files yourself
Especially: `lib/validations.ts`, `lib/auth-middleware.ts`, the API route, and
the UI form involved. These four are the most error-prone contract surface.

### Phase 3 — Root-cause map + same-class sweep
For anchurpos specifically, ALWAYS sweep for these recurring bug classes
(see `.antigravity/knowledge/known-anti-patterns.md` for the full catalog):
- Bare `fetch("/api/...")` without `Authorization` header (→ 401).
- API route reading from `req.body` instead of `parseResult.data` (validation bypass).
- `customerType` enum drift between `types/index.ts`, dropdowns, and zod schemas.
- PATCH handlers that silently drop fields the frontend sends.
- Silent aborts in form save handlers (`if (!name.trim()) return;` with no error).

### Phase 4 — Phased plan (P0/P1/P2)
Group lockstep changes: when you add a zod field, the API route that reads it,
the UI that sends it, and the TS type that declares it must all change together.

### Phase 5 — Decision forks
Only ask when the answer changes scope. Use 2-4 concrete options + tradeoff.

### Phase 6 — Present
Root-cause table → phased plan → file-change summary → verification.

## C. Ambiguity trigger — when to /grill-me

Run `/grill-me` (ask the user 3-4 sharp questions) BEFORE planning when ANY of:
- The user reports a symptom but no clear reproduction ("POS error", "cannot save").
- The request could be interpreted as bug-fix OR feature/refactor.
- The scope could plausibly be "just this file" OR "everywhere in the app".
- A business rule is involved (PO numbers, B2B pricing, credit limits, void reasons).

Do NOT /grill-me for: typos, obvious one-line fixes, or tasks where the user
already gave explicit file paths and a clear desired outcome.

## D. Verification gate (before claiming "done")

A change is NOT done until ALL of:
1. `npx tsc --noEmit` passes (zero errors).
2. `next lint` (or `npm run lint`) passes.
3. `npm run build` succeeds.
4. For UI changes: manual repro steps documented (which page, which action,
   what the expected visible result is).

If any step was skipped, say so explicitly: "edited but not type-checked" etc.
Never claim verified when only edited.

## E. Project-specific guardrails

- **Auth header**: every client-side `fetch` to `/api/*` MUST attach
  `Authorization: Bearer ${token}` via `getToken()` from `useAuth()`. No bare
  fetches. See api-and-auth.md.
- **Validation source**: API routes MUST read validated fields from
  `parseResult.data`, not raw `body`. Raw `body` is only for fields deliberately
  outside zod (and those should be added to zod).
- **Soft vs hard delete**: products/variants/customers → `isActive: false`.
  suppliers/ingredients → `ref.delete()`. Never mix.
- **Indonesian UI**: all user-facing strings are Bahasa Indonesia. Match the
  existing tone (casual-professional, e.g. "Gagal menyimpan pesanan").
- **Currency**: IDR via `Intl.NumberFormat("id-ID", { style: "currency",
  currency: "IDR" })`. Match the `fmt()` helper used across pages.
