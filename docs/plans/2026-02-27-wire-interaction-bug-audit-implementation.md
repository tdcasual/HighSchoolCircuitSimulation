# Wire Interaction Bug Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an executable audit workflow that produces a reproducible Top-20 wire-interaction bug backlog (mouse/touch/pen), with severity scoring and regression mapping.

**Architecture:** Implement a documentation-first audit pipeline: matrix-driven exploration, standardized finding records (`WIR-###`), and a defect-to-test mapping ledger. Keep assets in `docs/audits/wire-interaction/` so findings and automation status evolve in one place. Use fail-fast validation checkpoints after each artifact change.

**Tech Stack:** Markdown docs, existing interaction code/tests (`vitest`), shell tooling (`rg`, `npm test`).

---

### Task 1: Bootstrap Audit Workspace

**Files:**
- Create: `docs/audits/wire-interaction/README.md`
- Create: `docs/audits/wire-interaction/matrix.md`

**Step 1: Create audit directory and README scaffold**

Run:
```bash
mkdir -p docs/audits/wire-interaction
```

Write `README.md` with scope, device matrix, severity model, and artifact links.

**Step 2: Add executable matrix**

Write `matrix.md` containing dimensions:
- device (`mouse`, `touch`, `pen`)
- transform (`scale 0.5/1/2/4`, pan center/edge)
- flow stage (start/preview/release/redrag)
- snap target (terminal/wire-endpoint/wire-segment/grid)
- transition scenario (pointer mode switches)

**Step 3: Verify files exist**

Run:
```bash
ls docs/audits/wire-interaction
```
Expected: `README.md`, `matrix.md`

### Task 2: Create Finding Ledgers

**Files:**
- Create: `docs/audits/wire-interaction/top20.md`
- Create: `docs/audits/wire-interaction/backlog.md`
- Create: `docs/audits/wire-interaction/automation-map.md`

**Step 1: Define Top20 schema**

In `top20.md`, define required fields:
`id,title,device,viewport_state,steps,expected,actual,root_cause_class,severity,score,impact_scope,suggested_fix_location,auto_test_status`

**Step 2: Define backlog schema**

In `backlog.md`, use same schema for non-Top20 findings.

**Step 3: Define automation mapping schema**

In `automation-map.md`, define columns:
`wir_id,test_level,test_file,status,notes`

**Step 4: Verify markdown lint basics (manual)**

Run:
```bash
rg -n "WIR-###|root_cause_class|auto_test_status" docs/audits/wire-interaction -S
```
Expected: schema keywords found in all ledgers.

### Task 3: Seed Baseline Findings

**Files:**
- Modify: `docs/audits/wire-interaction/top20.md`

**Step 1: Insert initial high-confidence findings**

Seed at least 6 known findings from current codebase evidence (e.g., wire-segment snap not reachable in main wiring flow, hit-area/snap mismatch, zoom-threshold bugs fixed/regression watch).

**Step 2: Attach concrete evidence references**

Each entry must include absolute file references with line numbers.

**Step 3: Score and prioritize**

Apply formula:
`Score = Impact(1-5) × Frequency(1-5) × Unavoidable(1-3)`

### Task 4: Convert High-Risk Items to Regression Targets

**Files:**
- Modify: `docs/audits/wire-interaction/automation-map.md`
- Modify: `tests/interaction.snapController.spec.js` (if needed)
- Modify: `tests/interaction.orchestrator.spec.js` (if needed)

**Step 1: Map each `P0/P1` finding to current tests**

If mapped test is missing, add `status=planned` with target file.

**Step 2: Add missing regression tests via TDD (when implementing)**

For each missing high-risk mapping:
1. write failing test
2. run to confirm fail
3. minimal fix
4. run focused test suite

**Step 3: Verify mapping completeness**

Run:
```bash
rg -n "\| P0 \||\| P1 \|" docs/audits/wire-interaction/top20.md -n
rg -n "WIR-" docs/audits/wire-interaction/automation-map.md -n
```
Expected: every P0/P1 id appears in automation map.

### Task 5: Add Daily Audit Operation Checklist

**Files:**
- Modify: `docs/audits/wire-interaction/README.md`

**Step 1: Add runbook checklist**

Include:
1. choose matrix slice
2. reproduce and capture evidence
3. classify root cause
4. score
5. enter Top20 or backlog
6. update automation map

**Step 2: Add quality gates**

A finding is valid only if:
- reproducible in clean state
- has expected vs actual
- has root-cause class
- has candidate fix location

### Task 6: Verification Pass

**Files:**
- Verify only

**Step 1: Run focused interaction tests**

Run:
```bash
npm test -- tests/interaction.snapController.spec.js tests/interaction.orchestrator.spec.js tests/interaction.wireSegmentSnap.spec.js
```
Expected: pass.

**Step 2: Validate audit docs references**

Run:
```bash
rg -n "WIR-[0-9]{3}" docs/audits/wire-interaction -S
```
Expected: IDs appear consistently in top20/backlog/automation-map.

### Task 7: Commit in Small Batches

**Step 1: Commit audit scaffolding**

```bash
git add docs/audits/wire-interaction docs/plans/2026-02-27-wire-interaction-bug-audit-implementation.md
git commit -m "docs: scaffold wire interaction bug audit workflow"
```

**Step 2: Commit seeded findings and mapping updates**

```bash
git add docs/audits/wire-interaction
git commit -m "docs: seed wire interaction top20 baseline findings"
```

### Task 8: Handoff

Deliverables:
1. `docs/audits/wire-interaction/README.md`
2. `docs/audits/wire-interaction/matrix.md`
3. `docs/audits/wire-interaction/top20.md`
4. `docs/audits/wire-interaction/backlog.md`
5. `docs/audits/wire-interaction/automation-map.md`

Report:
1. Top20 count and P0/P1 count
2. number of findings mapped to automated tests
3. unresolved planned regressions
