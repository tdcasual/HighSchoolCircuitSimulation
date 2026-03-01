# CI Workflow E2E Coverage Guard - Slice V (2026-04-27)

## Scope

Expand executable CI workflow guard coverage to all browser E2E jobs (`responsive-e2e`, `wire-e2e`, `observation-e2e`) with step-contract validation.

## Changes

1. Enhanced `scripts/ci/assert-ci-workflow-coverage.mjs`:
   - Parses `responsive-e2e` and `observation-e2e` jobs in addition to `quality` and `wire-e2e`.
   - Verifies run-step contracts:
     - `Run responsive touch E2E` -> `npm run test:e2e:responsive`
     - `Run wire interaction E2E` -> `npm run test:e2e:wire`
     - `Run observation touch E2E` -> `npm run test:e2e:observation`
   - Verifies upload-step contracts (failure condition, upload action, artifact name, artifact path) for all three E2E jobs.
2. Expanded `tests/ci.workflow.spec.js`:
   - Added static assertions for responsive/observation E2E jobs.
   - Added negative mutation case: removing observation run step must fail guard.

## Validation

Executed:

```bash
node scripts/ci/assert-ci-workflow-coverage.mjs
npm test -- tests/ci.workflow.spec.js tests/simulation.registryLegacyFallbackGuard.spec.js tests/interaction.guideSync.spec.js tests/release.docsIntegrity.spec.js
npm run check
npm run baseline:p0
```

Result:

- Workflow guard passed current workflow and failed as expected on observation-step removal mutation.
- Targeted tests passed.
- Full `check` gate passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
