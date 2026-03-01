# CI Workflow Package Script Consistency - Slice W (2026-04-28)

## Scope

Ensure CI workflow `npm run ...` commands are always backed by real scripts in `package.json`, preventing silent drift between workflow commands and package script definitions.

## Changes

1. Enhanced `scripts/ci/assert-ci-workflow-coverage.mjs`:
   - Loads and validates `package.json`.
   - Scans workflow `run: npm run <script>` commands.
   - Fails when any referenced script is missing from `package.json`.
2. Expanded `tests/ci.workflow.spec.js`:
   - Updated workflow guard execution tests to include `package.json` in temp workspace.
   - Added negative mutation case:
     - remove `test:e2e:wire` from package scripts
     - guard must fail with missing-script message.

## Validation

Executed:

```bash
node scripts/ci/assert-ci-workflow-coverage.mjs
npm test -- tests/ci.workflow.spec.js tests/simulation.registryLegacyFallbackGuard.spec.js tests/interaction.guideSync.spec.js tests/release.docsIntegrity.spec.js
npm run check
npm run baseline:p0
```

Result:

- Workflow guard now verifies step contracts and package script consistency.
- Targeted tests passed.
- Full `check` gate passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
