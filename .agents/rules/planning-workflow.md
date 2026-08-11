---
trigger: always_on
---

---
trigger: always
---

# PLANNING WORKFLOW (enforce before any non-trivial edit)

For any task that is NOT a 1-2 line typo fix, follow this exact sequence:

## Phase 0 — Reframe (write these 3 lines first)
- EXPLICIT ask: what the user literally requested.
- IMPLIED need: the job-to-be-done (what they probably actually need).
- LIKELY real problem: your initial root-cause hypothesis (to be proven).

## Phase 1 — Parallel exploration
Fan out investigation across independent areas simultaneously. Each thread
reports: exact file paths, line numbers, snippets. NO fixes proposed yet.

## Phase 2 — Read critical files yourself
Secondhand reports are insufficient for central files. Read them directly
before any claim enters the plan.

## Phase 3 — Root-cause map
For each problem produce:
  Symptom → Immediate cause → Root cause → Evidence (file:line) → Confidence
Rank by severity. Include the same-class sweep results.

## Phase 4 — Phased plan
P0 (blocking) / P1 (important) / P2 (cleanup). Each item: file path, what
changes, why, before/after shape. Group contract-coupled changes together.

## Phase 5 — Surface forks
Only ask questions whose answers change scope. 2-4 options + tradeoff each.

## Phase 6 — Present
Root-cause table → phased plan → file-change summary → verification steps.

If the task is ambiguous, run /grill-me BEFORE Phase 1.