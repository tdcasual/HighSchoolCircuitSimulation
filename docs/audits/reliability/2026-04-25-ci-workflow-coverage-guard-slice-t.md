# CI Workflow Coverage Guard - Slice T (2026-04-25)

## Scope

Promote CI workflow contract checks from static unit assertions to an executable guard script with positive and negative regression coverage.

## Changes

1. Added executable workflow guard script:
   - `scripts/ci/assert-ci-workflow-coverage.mjs`
   - Verifies required CI job/step snippets in `.github/workflows/ci.yml`, including:
     - quality gates (`docs-integrity`, `interaction-guide`, `registry-guard`, `check:full`)
     - wire e2e gate
     - workflow guard self-check step
2. Wired script into package pipeline:
   - Added `check:ci-workflow`
   - Added to `npm run check` chain
3. Added workflow step:
   - `Check CI workflow coverage` in `quality` job.
4. Expanded `tests/ci.workflow.spec.js`:
   - package script wiring assertions
   - script execution success case
   - negative mutation case (removing registry guard step triggers expected failure)

## Validation

Executed:

```bash
node scripts/ci/assert-ci-workflow-coverage.mjs
npm test -- tests/ci.workflow.spec.js tests/simulation.registryLegacyFallbackGuard.spec.js tests/interaction.guideSync.spec.js tests/release.docsIntegrity.spec.js
npm run check
npm run baseline:p0
```

Result:

- Workflow guard script passed on current config and failed as expected on negative mutation case.
- Targeted tests passed.
- Full `check` gate passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
