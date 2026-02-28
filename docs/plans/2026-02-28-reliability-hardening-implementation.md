# Reliability Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CI protection for wire interaction regressions, align `AGENTS.md` with current component reality, and ship a safer AI proxy request mode that does not require browser-stored API keys.

**Architecture:** Work in three isolated vertical slices with TDD. First, add a workflow assertion test and update CI to run wire E2E. Second, add doc consistency tests that compare `AGENTS.md` component table to `ComponentDefaults`, then repair the document and remove invalid trailing content. Third, add proxy-mode tests in `OpenAIClient`, then extend config + settings UI and request paths to support `direct` and `proxy` modes.

**Tech Stack:** Node.js, Vitest, GitHub Actions YAML, vanilla ES modules.

---

### Task 1: CI Wire E2E Gate

**Files:**
- Create: `tests/ci.workflow.spec.js`
- Modify: `.github/workflows/ci.yml`

**Step 1: Write the failing test**

- Assert CI workflow contains `npm run test:e2e:wire`.
- Assert failure artifact upload path for wire E2E exists.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/ci.workflow.spec.js`  
Expected: FAIL because workflow does not run wire E2E.

**Step 3: Write minimal implementation**

- Add a dedicated `wire-e2e` job in `.github/workflows/ci.yml`.
- Install Playwright Chromium and run `npm run test:e2e:wire`.
- Upload failure screenshots (`output/e2e/wire-interaction`) as artifact.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/ci.workflow.spec.js`  
Expected: PASS.

### Task 2: AGENTS Doc Consistency

**Files:**
- Create: `tests/agents.doc.spec.js`
- Modify: `AGENTS.md`

**Step 1: Write the failing test**

- Parse `AGENTS.md` component overview table and assert it includes all keys from `ComponentDefaults`.
- Assert `AGENTS.md` does not contain accidental template residue markers like `<content>` or `<parameter`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/agents.doc.spec.js`  
Expected: FAIL due missing component rows and trailing residue.

**Step 3: Write minimal implementation**

- Update the component table rows in `AGENTS.md` to match current supported components.
- Keep descriptions concise and aligned to existing behavior.
- Remove invalid trailing markers at end of file.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/agents.doc.spec.js`  
Expected: PASS.

### Task 3: AI Proxy Request Mode

**Files:**
- Modify: `tests/openaiClient.spec.js`
- Modify: `tests/aiPanel.settingsController.spec.js`
- Modify: `src/ai/OpenAIClient.js`
- Modify: `src/ui/ai/SettingsController.js`
- Modify: `index.html`

**Step 1: Write failing tests**

- `OpenAIClient`: when `requestMode=proxy`, `callAPI` should not require `apiKey`, must call `proxyEndpoint`, and must not send `Authorization`.
- `OpenAIClient`: when `requestMode=proxy`, `listModels` uses proxy endpoint.
- `SettingsController`: save/open paths include `requestMode` and `proxyEndpoint`.

**Step 2: Run tests to verify they fail**

Run:
- `npm test -- tests/openaiClient.spec.js`
- `npm test -- tests/aiPanel.settingsController.spec.js`  
Expected: FAIL on new proxy assertions.

**Step 3: Write minimal implementation**

- Add `requestMode` (`direct|proxy`) and `proxyEndpoint` defaults in `OpenAIClient` config load/save.
- Gate auth requirement and headers by mode.
- Route `callAPI` / `listModels` requests to proxy endpoint when proxy mode is enabled.
- Add settings controls in `index.html` and bind behavior in `SettingsController`.

**Step 4: Run tests to verify they pass**

Run:
- `npm test -- tests/openaiClient.spec.js`
- `npm test -- tests/aiPanel.settingsController.spec.js`  
Expected: PASS.

### Task 4: Focused Verification

**Files:**
- Verify only

**Step 1: Run aggregate focused checks**

Run:
`npm test -- tests/ci.workflow.spec.js tests/agents.doc.spec.js tests/openaiClient.spec.js tests/aiPanel.settingsController.spec.js`

Expected: All pass.

**Step 2: Optional full guard**

Run:
`npm run check`

Expected: lint/format/tests pass if runtime budget allows.
