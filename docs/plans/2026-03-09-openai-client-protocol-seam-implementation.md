# OpenAI Client Protocol Seam Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce `OpenAIClientV2` maintenance load by extracting pure protocol/config normalization helpers into a dedicated seam while preserving all runtime behavior.

**Architecture:** Keep transport, storage persistence, and retries inside `OpenAIClientV2`, but move stateless endpoint normalization, model-endpoint derivation, request-body construction, and response-text extraction into a pure helper module under `src/ai/`. Lock the refactor with a seam test and a size target so future changes do not collapse back into one file.

**Tech Stack:** ESM JavaScript, Vitest, existing OpenAI client tests.

---

### Task 1: Add seam and size guards

**Files:**
- Create: `tests/openaiClientProtocol.spec.js`
- Create: `tests/openaiClient.sizeTarget.spec.js`

**Step 1: Write the failing seam test**

Assert that a new `src/ai/OpenAIClientProtocol.js` module exports pure helpers for:
- API endpoint normalization to `/v1/responses`
- model-list endpoint derivation
- responses request-body construction
- response text extraction

Run: `npx vitest run tests/openaiClientProtocol.spec.js -v`
Expected: FAIL because the helper module does not exist yet.

**Step 2: Write the failing size target**

Assert `src/ai/OpenAIClientV2.js` stays at or below `500` lines.

Run: `npx vitest run tests/openaiClient.sizeTarget.spec.js -v`
Expected: FAIL because the file is currently larger than the target.

### Task 2: Extract the pure helper module

**Files:**
- Create: `src/ai/OpenAIClientProtocol.js`
- Modify: `src/ai/OpenAIClientV2.js`
- Test: `tests/openaiClientProtocol.spec.js`
- Test: `tests/openaiClient.sizeTarget.spec.js`
- Test: `tests/openaiClient.spec.js`
- Test: `tests/endpointResolution.spec.js`
- Test: `tests/aiClient.v2.responsesOnly.spec.js`

**Step 1: Implement the helper module**

Export pure helpers for endpoint normalization, model endpoint derivation, request payload construction, and response text extraction.

**Step 2: Delegate from `OpenAIClientV2`**

Replace the duplicated inline logic with imports from `src/ai/OpenAIClientProtocol.js` while keeping the class API unchanged.

**Step 3: Verify behavior**

Run:
- `npx vitest run tests/openaiClientProtocol.spec.js tests/openaiClient.sizeTarget.spec.js tests/openaiClient.spec.js tests/endpointResolution.spec.js tests/aiClient.v2.responsesOnly.spec.js -v`
- `npx eslint src/ai/OpenAIClientV2.js src/ai/OpenAIClientProtocol.js tests/openaiClientProtocol.spec.js tests/openaiClient.sizeTarget.spec.js`

Expected: all PASS.
