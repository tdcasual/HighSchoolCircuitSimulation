# PRJ-019 Mobile Touch E2E Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add focused mobile E2E evidence for `PRJ-019` so responsive touch regression verifies off-center terminal taps still arm and finish wiring under low zoom.

**Architecture:** Reuse `scripts/e2e/responsive-touch-regression.mjs` instead of adding a parallel harness. Add one focused phone-only scenario that exercises real SVG hit-testing with edge-biased touch coordinates, then lock that contract with a lightweight Vitest source guard and document the resulting audit evidence.

**Tech Stack:** Node.js, Playwright, Vitest, existing responsive touch regression harness.

---

### Task 1: Add contract guard for PRJ-019 coverage

**Files:**
- Create: `tests/e2e.responsiveTouchHitBudgetContract.spec.js`
- Modify: `scripts/e2e/responsive-touch-regression.mjs`

**Step 1: Write the failing test**
- Add a contract spec that requires the responsive touch E2E script to include explicit `PRJ-019` hit-budget assertions and edge-biased touch markers.

**Step 2: Run test to verify it fails**
- Run: `npm test -- tests/e2e.responsiveTouchHitBudgetContract.spec.js`
- Expected: FAIL because the current script does not contain the new markers.

**Step 3: Write minimal implementation**
- Extend `verifyPhoneTouchFlow()` to:
  - create a low-zoom phone wiring scenario,
  - compute edge-biased touch points from terminal hit boxes,
  - route taps through `document.elementFromPoint(...)`,
  - assert start/finish taps still arm and complete wiring.

**Step 4: Run test to verify it passes**
- Run: `npm test -- tests/e2e.responsiveTouchHitBudgetContract.spec.js`
- Expected: PASS.

### Task 2: Verify the responsive E2E end-to-end

**Files:**
- Modify: `scripts/e2e/responsive-touch-regression.mjs`

**Step 1: Run focused E2E**
- Run: `npm run test:e2e:responsive`
- Expected: PASS and write updated artifacts under `output/e2e/responsive-touch/`.

**Step 2: Inspect output contract**
- Confirm the baseline JSON and diff notes mention the responsive pass and preserve the phone diagnostics block.

### Task 3: Document audit evidence

**Files:**
- Create: `docs/audits/mobile/2026-03-07-prj-019-touch-hit-budget-followup.md`

**Step 1: Write evidence note**
- Record the scenario, exact script/test paths, verification command, and whether `PRJ-019` should remain open or move to `covered`.

**Step 2: Re-run targeted verification**
- Run: `npm test -- tests/e2e.responsiveTouchHitBudgetContract.spec.js && npm run test:e2e:responsive`
- Expected: PASS.
