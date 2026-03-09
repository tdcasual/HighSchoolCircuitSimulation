# Embed Runtime Request Router Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce `EmbedRuntimeBridge` maintenance load by extracting request dispatch and option mutation logic into a dedicated router seam while preserving the embed runtime contract.

**Architecture:** Keep transport/listener wiring in `EmbedRuntimeBridge`, but move readonly mutation guards, request switching, and `setOptions` state application into a narrow router module under `src/embed/`. Lock the refactor with a seam test plus a size target so the bridge remains a transport orchestrator instead of growing back into a mixed-responsibility file.

**Tech Stack:** ESM JavaScript, Vitest, existing embed bridge tests.

---

### Task 1: Add seam and size guards

**Files:**
- Create: `tests/embedRuntimeRequestRouter.spec.js`
- Create: `tests/embedRuntimeBridge.sizeTarget.spec.js`

**Step 1: Write the failing seam test**

Assert that a new `src/embed/EmbedRuntimeRequestRouter.js` module:
- blocks readonly mutations with the stable bridge error code
- applies `setOptions` in strict v2 mode
- validates `loadCircuit` payloads before dispatch

Run: `npx vitest run tests/embedRuntimeRequestRouter.spec.js -v`
Expected: FAIL because the router module does not exist yet.

**Step 2: Write the failing size target**

Assert `src/embed/EmbedRuntimeBridge.js` stays at or below `260` lines.

Run: `npx vitest run tests/embedRuntimeBridge.sizeTarget.spec.js -v`
Expected: FAIL because the file is currently larger than the target.

### Task 2: Extract the request router seam

**Files:**
- Create: `src/embed/EmbedRuntimeRequestRouter.js`
- Modify: `src/embed/EmbedRuntimeBridge.js`
- Test: `tests/embedRuntimeRequestRouter.spec.js`
- Test: `tests/embedRuntimeBridge.sizeTarget.spec.js`
- Test: `tests/embedRuntimeBridge.spec.js`
- Test: `tests/embedRuntimeBridge.readonlyMutations.spec.js`
- Test: `tests/runtime.v2NoLegacyFallback.spec.js`

**Step 1: Implement the router module**

Export router helpers for readonly mutation guard, request dispatch, and `setOptions` application.

**Step 2: Delegate from `EmbedRuntimeBridge`**

Replace inline request/option logic with delegation to the router module while keeping the bridge public API unchanged.

**Step 3: Verify behavior**

Run:
- `npx vitest run tests/embedRuntimeRequestRouter.spec.js tests/embedRuntimeBridge.sizeTarget.spec.js tests/embedRuntimeBridge.spec.js tests/embedRuntimeBridge.readonlyMutations.spec.js tests/runtime.v2NoLegacyFallback.spec.js -v`
- `npm run lint`
- `npm run check:core-size`
- `npm run check:maintainability`
- `npm run report:debt-dashboard`

Expected: all PASS.
