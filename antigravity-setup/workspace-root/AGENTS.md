# AGENTS.md — Anchurpos (Anchovy Processing POS)

This file is the entry point for any AI agent working in this repo. It points
the agent to project-specific knowledge so the agent does not hallucinate the
architecture, conventions, or domain language.

## Project one-liner
Indonesian anchovy-processing business operations platform: POS (kasir),
orders, master data, inventory, production (SFM), payroll, expenses, reports.
Built with Next.js (App Router) + Firebase (Auth + Firestore) + TypeScript.

## Read these BEFORE acting on any task
Ordered by relevance. If a task touches a domain, read that knowledge file first.

| When task involves… | Read this knowledge file first |
|---|---|
| Any backend / API / data flow | `.antigravity/knowledge/architecture.md` |
| Auth, tokens, 401/403 errors, fetch calls | `.antigravity/knowledge/api-and-auth.md` |
| Form validation, zod, saving data | `.antigravity/knowledge/validation-contract.md` |
| Orders, products, customers, ingredients, suppliers | `.antigravity/knowledge/validation-contract.md` (per-domain contract map) |
| Indonesian business terms (PO, B2B, omzet, SFM, HPP) | `.antigravity/knowledge/domain-glossary.md` |
| Running tests / verifying a change | `.antigravity/knowledge/testing-strategy.md` |
| Avoiding past bugs (anti-pattern catalog) | `.antigravity/knowledge/known-anti-patterns.md` |

## Hard rules (do not violate without explicit user approval)
1. **Never use bare `fetch("/api/...")` in client components.** Always go through
   `fetchWithAuth` (see api-and-auth.md). This is the #1 recurring bug class here.
2. **Never read validation fields from `req.body` raw when a zod schema exists.**
   Read from `parseResult.data` so validation is enforced.
3. **Never change a zod schema without checking every API route + UI + type that
   depends on it** (see validation-contract.md for the lockstep map).
4. **Never claim a fix is "done" without running** `tsc --noEmit`, `next lint`,
   and `npm run build` (see testing-strategy.md).
5. **Soft-deleted records use `isActive: false`** for products, variants,
   customers. Suppliers + ingredients are HARD deleted. Check before deleting.

## Roles (auth)
`owner` > `manager` > `crew`. Each has its own route area:
`/owner/*`, `/manager/*`, `/crew/*`. Role lives in the Firebase custom claim
`role` and is read via `getIdTokenResult()`. See api-and-auth.md.

## Slash commands this project recommends
- `/grill-me` — when the request is ambiguous or high-stakes.
- `/planning` — for any task touching >2 files or any bug report.
- `/goal` — only after a plan is approved and spec is locked.

## Tech stack quick reference
- Framework: Next.js 15 (App Router), React 18, TypeScript
- Auth + DB: Firebase Auth (client SDK) + Firebase Admin (server) + Firestore
- Validation: zod (`lib/validations.ts`)
- UI: TailwindCSS + custom shadcn-style components (`components/ui/`)
- Deployment: Vercel (production at `anchurpos.vercel.app`)
- No axios, no SWR, no react-query — native `fetch` + `fetchWithAuth` wrapper.

## Where things live (quick map)
- API routes: `app/api/**/route.ts`
- Manager UI: `app/manager/**` (POS, orders, master-data, inventory, reports…)
- Owner UI: `app/owner/**`
- Crew UI: `app/crew/**`
- Shared components: `components/shared/**`, `components/ui/**`
- Validation schemas: `lib/validations.ts`
- Auth helpers: `lib/auth-middleware.ts`, `lib/auth-context.tsx`
- Firebase init: `lib/firebase-client.ts`, `lib/firebase-admin.ts`
- Business logic (HPP, cost calc): `lib/business-logic.ts`
- Types: `types/index.ts`

Full detail in `.antigravity/knowledge/architecture.md`.
