# PRJ-008 Batch Diagnostics Contract Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close `PRJ-008` by making runtime diagnostics explicitly defer topology-derived validation while a topology batch or pending rebuild is still open.

**Architecture:** Keep the fix inside runtime diagnostics collection so every caller inherits the same contract. Add unit tests first to prove that batch-mode diagnostics neither flush pending topology rebuilds nor claim topology-derived errors from stale node graphs, then expose a `topologyValidationDeferred` marker on the diagnostics payload.

**Tech Stack:** Node.js, Vitest, existing `Circuit` runtime and diagnostics pipeline.

---

### Task 1: Add failing diagnostics contract tests

**Files:**
- Modify: `tests/circuit.runtimeDiagnostics.spec.js`
- Modify: `tests/runtimeDiagnostics.pipeline.spec.js`

**Step 1: Write the failing test**
- Add a test that opens a topology batch, creates a pending rebuild, calls `collectRuntimeDiagnostics()`, and expects:
  - no rebuild flush,
  - pending flag preserved,
  - `topologyValidationDeferred === true`.
- Add a pipeline test that preserves this marker on the attached payload.

**Step 2: Run tests to verify they fail**
- Run: `npm test -- tests/circuit.runtimeDiagnostics.spec.js tests/runtimeDiagnostics.pipeline.spec.js`
- Expected: FAIL because the marker is not produced today.

### Task 2: Implement the minimal runtime contract

**Files:**
- Modify: `src/core/runtime/Circuit.js`

**Step 1: Add deferred topology logic**
- In `collectRuntimeDiagnostics()`, when `topologyBatchDepth > 0` or `topologyRebuildPending === true`, skip topology validation and annotate diagnostics with `topologyValidationDeferred: true`.

**Step 2: Keep existing paths intact**
- Preserve existing behavior for non-batch diagnostics and already-attached result payloads.

### Task 3: Verify and document

**Files:**
- Create: `docs/audits/reliability/2026-03-07-prj-008-batch-diagnostics-followup.md`

**Step 1: Run targeted verification**
- Run: `npm test -- tests/circuit.runtimeDiagnostics.spec.js tests/runtimeDiagnostics.pipeline.spec.js`
- Expected: PASS.

**Step 2: Write audit note**
- Record the contract, test paths, and whether `PRJ-008` can move from `seed-hypothesis` to `covered` in the worktree.
