# PRJ-012 / PRJ-007 Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining Top30 audit items by first adding a minimal near-field diagnostics guidance contract for `PRJ-012`, then re-assessing `PRJ-007` with targeted reproduction evidence.

**Architecture:** Reuse the existing runtime diagnostics pipeline and status action channel instead of building a new panel. First lock the desired UX with focused tests around `AppRuntimeV2.onCircuitUpdate()`, then add the smallest bridge from `runtimeDiagnostics.hints` to the status/action surface and document audit evidence before syncing back to the main repo.

**Tech Stack:** Vanilla JS, Vitest, existing runtime diagnostics pipeline, audit markdown docs.

---

### Task 1: Reproduce PRJ-012 gap

**Files:**
- Modify: `tests/runtimeDiagnostics.pipeline.spec.js`
- Modify: `src/app/AppRuntimeV2.js`
- Test: `tests/runtimeDiagnostics.pipeline.spec.js`

**Step 1: Write the failing test**
- Add a focused test proving that fatal runtime diagnostics with `hints` currently only show summary text and do not surface actionable near-field guidance.

**Step 2: Run test to verify it fails**
- Run: `npm test -- tests/runtimeDiagnostics.pipeline.spec.js`
- Expected: FAIL on missing near-field guidance/status action contract.

**Step 3: Write minimal implementation**
- Surface the first runtime diagnostics hint through the existing status action channel while preserving current summary behavior.

**Step 4: Run test to verify it passes**
- Run: `npm test -- tests/runtimeDiagnostics.pipeline.spec.js`
- Expected: PASS.

### Task 2: Verify no regression in diagnostics pipeline

**Files:**
- Test: `tests/circuit.runtimeDiagnostics.spec.js`
- Test: `tests/runtimeDiagnostics.pipeline.spec.js`

**Step 1: Run targeted diagnostics tests**
- Run: `npm test -- tests/circuit.runtimeDiagnostics.spec.js tests/runtimeDiagnostics.pipeline.spec.js`
- Expected: PASS.

### Task 3: Capture PRJ-012 closure evidence

**Files:**
- Create: `docs/audits/reliability/2026-03-07-prj-012-runtime-hints-followup.md`
- Modify: `docs/audits/project/top30.md`
- Modify: `docs/audits/project/2026-03-07-top30-closure-review.md`

**Step 1: Document the contract**
- Record the reproduction, the new UI hint surfacing behavior, and the validation commands.

**Step 2: Update Top30 state**
- Mark `PRJ-012` as `covered` only if targeted tests pass and the new contract is documented.

### Task 4: Re-assess PRJ-007 after PRJ-012 closure

**Files:**
- Inspect: `src/core/services/CircuitTopologyService.js`
- Inspect: `tests/circuit.topologyService.spec.js`
- Create or modify only if a minimal reproducible contract is found.

**Step 1: Reproduce the suspected visual/electrical divergence**
- Build the smallest failing test or evidence set.

**Step 2: Decide closure path**
- If reproduced, keep open with narrowed evidence or implement minimal fix.
- If not reproduced and existing contracts cover it, update audit docs accordingly.
