# Antigravity IDE Setup for Anchurpos

This folder contains a complete configuration set that makes the Antigravity
agent behave like a rigorous engineering planner/diagnostician — with deep
project knowledge of anchurpos to suppress hallucination.

Everything is staged here for review. Follow the install steps below to
activate each piece in its target location.

---

## What's inside

```
antigravity-setup/
├── README.md                          ← you are here
├── global/
│   └── GEMINI.md                      ← global agent DNA (all projects)
├── workspace-root/
│   └── AGENTS.md                      ← project entry point (repo root)
├── agents-rules/
│   └── project-context.md             ← workspace rule (Always On)
├── agents-custom/
│   └── diagnostician/
│       └── agent.md                   ← custom agent for forensic debugging
└── antigravity-knowledge/
    ├── architecture.md                ← stack, routing, data flow, auth model
    ├── api-and-auth.md                ← fetchWithAuth pattern, auth helpers, endpoints
    ├── validation-contract.md         ← schema ↔ API ↔ types ↔ UI lockstep map
    ├── domain-glossary.md             ← Indonesian business terms
    ├── testing-strategy.md            ← verification gates + manual repro
    └── known-anti-patterns.md         ← recurring bug catalog (6 classes)
```

---

## The 4 layers (and where each file goes)

| # | File in this folder | Target location | Scope | Type |
|---|---|---|---|---|
| 1 | `global/GEMINI.md` | `~/.gemini/GEMINI.md` | ALL projects | Global Rule |
| 2 | `workspace-root/AGENTS.md` | `<repo-root>/AGENTS.md` | anchurpos only | Project root file |
| 3 | `agents-rules/project-context.md` | `<repo-root>/.agents/rules/project-context.md` | anchurpos only | Workspace Rule (Always On) |
| 4 | `agents-custom/diagnostician/agent.md` | `<repo-root>/.agents/agents/diagnostician/agent.md` | anchurpos only | Custom Agent |
| 5–10 | `antigravity-knowledge/*.md` | `<repo-root>/.antigravity/knowledge/*.md` | anchurpos only | Knowledge files |

> On Windows, `~/.gemini/` is typically `C:\Users\<You>\.gemini\`. Antigravity
> honors both `~/.gemini/GEMINI.md` (global rules). Confirm the exact path in
> your Antigravity Customizations panel.

---

## Install steps (in this order)

### Step 1 — Global DNA (applies to every project)
1. Open Antigravity → `...` menu (top of agent panel) → **Customizations** → **Rules**.
2. Click **+ Global**.
3. Paste the contents of `global/GEMINI.md`.
4. Save. (Antigravity stores this at `~/.gemini/GEMINI.md`.)

> Alternatively, copy the file directly: place `global/GEMINI.md` at
> `C:\Users\<You>\.gemini\GEMINI.md`.

### Step 2 — Project entry point
1. Copy `workspace-root/AGENTS.md` to the repo root:
   `C:\mad\website\anchurpos\AGENTS.md`

### Step 3 — Workspace rule (Always On)
1. Copy the folder structure:
   `agents-rules/project-context.md` →
   `C:\mad\website\anchurpos\.agents\rules\project-context.md`
2. Open it in the Antigravity Rules panel and confirm the trigger is **Always On**
   (the YAML frontmatter sets `trigger: always`, but verify in the UI).

> Antigravity defaults to `.agents/rules/` and keeps backward-compat with
> `.agent/rules/`. Use `.agents/` (plural).

### Step 4 — Custom diagnostician agent (optional but recommended)
1. Copy the folder:
   `agents-custom/diagnostician/` →
   `C:\mad\website\anchurpos\.agents\agents\diagnostician\`
2. Restart Antigravity (or reopen the `/agents` panel) — `diagnostician` should
   appear under **Available Agents**.
3. Activate it from the agent panel when you have a tricky bug to diagnose.

### Step 5 — Knowledge files (anti-hallucination core)
1. Create the directory: `C:\mad\website\anchurpos\.antigravity\knowledge\`
2. Copy ALL six `.md` files from `antigravity-knowledge/` into it.

After this, `AGENTS.md` (Step 2) will resolve all its relative links correctly.

---

## Verify the setup

1. Open Antigravity in the anchurpos workspace.
2. Open the agent panel. Confirm:
   - Global rule `GEMINI.md` is listed under Global Rules.
   - `project-context.md` is listed under Workspace Rules (Always On).
   - `diagnostician` appears under Available Agents.
3. Run this smoke-test prompt in the agent:
   > "Halaman POS error kayaknya rules nomor referensi. Fix dong."
4. **Expected behavior** (if the setup works):
   - The agent does NOT immediately edit code.
   - It reads `AGENTS.md` + the relevant knowledge files first.
   - It restates your hypothesis, then says it will verify in code.
   - It cites `file:line` for its claims.
   - It sweeps for the same bug class (bare fetch, enum drift, etc.).
   - If anything is ambiguous, it uses `/grill-me`-style questions (2-4 options
     with tradeoffs) before planning.
5. If the agent jumps straight to editing without reading — your rules aren't
   active. Recheck Step 1 and Step 3.

---

## Slash commands to use day-to-day

| Command | When |
|---|---|
| `/grill-me` | Request is ambiguous or high-stakes. Agent interviews YOU first. |
| `/planning` | Any task touching >2 files or any bug. Agent plans before editing. |
| `/goal` | Spec is locked and plan is approved. Autonomous finish. |
| `@diagnostician` | Activate the forensic-debugging custom agent for a tricky bug. |

**Default workflow for non-trivial work:**
`/grill-me` (if ambiguous) → `/planning` → review plan → `/goal` (to execute).

---

## Maintenance

- **Keep `known-anti-patterns.md` current.** Whenever you (or the agent) find a
  new recurring bug class, add it. This is how the agent gets smarter about
  THIS codebase over time.
- **Update line numbers** in knowledge files when you do a big refactor. The
  patterns stay valid even if exact lines drift, but citations help.
- **The `validation-contract.md` lockstep map** must be updated whenever a new
  zod schema is added (e.g., when `customerSchema`/`supplierSchema`/`variantSchema`
  are created — they're currently missing, see the file).
- **Don't over-pad `GEMINI.md`.** It's intentionally under 12k chars. If you add
  more global rules, prefer a SECOND global rule file over bloating one.

---

## What this setup gives you

- **Mode planning komprehensif** — enforced via the Always-On workspace rule
  and the global methodology (Phase 0–6).
- **Grill-me behavior** — both the built-in `/grill-me` slash command AND a
  calibrated protocol in `GEMINI.md` for when/how to interrogate.
- **Low hallucination** — 6 knowledge files of verified anchurpos facts
  (architecture, auth, validation contracts, glossary, testing, anti-patterns)
  that the agent reads before reasoning.
- **Systematic bug-finding** — the anti-pattern catalog + "sweep for the class"
  mandate means one reported bug triggers a full-codebase audit for the same
  class, not just a one-off patch.
- **Measurable done-ness** — `testing-strategy.md` defines explicit gates
  (tsc, lint, build, manual repro). The agent can't honestly claim "done"
  without running them.

---

## Troubleshooting

**"The agent still jumps to editing without planning."**
→ The workspace rule isn't active. Confirm `trigger: always` in the frontmatter
AND in the Rules UI. Also confirm the file is at `.agents/rules/` (not a typo'd
`.agent/rules/`).

**"The agent doesn't seem to read the knowledge files."**
→ `AGENTS.md` must be at the EXACT repo root and the knowledge paths must be
exactly `.antigravity/knowledge/*.md`. Check for typos. The links in
`AGENTS.md` are relative to the repo root.

**"Global rules don't apply."**
→ Confirm `~/.gemini/GEMINI.md` exists (on Windows: `C:\Users\<You>\.gemini\`).
Antigravity reads this on startup — restart the IDE after editing.

**"The diagnostician agent doesn't appear."**
→ Confirm the path `.agents/agents/diagnostician/agent.md` (note: agents/agents/
— double "agents"). The outer `.agents/` is the Antigravity config dir; the
inner `agents/` is the agents subdir. Restart Antigravity after adding.

**"Line numbers in the knowledge files are stale."**
→ Expected over time. The patterns are what matter. Re-verify with a quick
`grep` before relying on a specific line number.
