# CI Workflow Guard Hardening - Slice U (2026-04-26)

## Scope

Strengthen the executable CI workflow guard from loose snippet matching to step-contract validation (step name + run command + order), reducing false positives from comments or unrelated text.

## Changes

1. Upgraded `scripts/ci/assert-ci-workflow-coverage.mjs`:
   - Parses workflow job blocks for `quality` and `wire-e2e`.
   - Parses named steps within each job.
   - Verifies required step/run command pairs:
     - docs integrity
     - interaction guide sync
     - registry guard
     - CI workflow guard
     - reliability gate
     - quality full gate
     - wire e2e gate
   - Verifies quality gate step order contract.
2. Expanded `tests/ci.workflow.spec.js`:
   - Updated missing-step negative case to match new guard message.
   - Added negative case for run-command drift (`npm run test:reliability` changed to another command).

## Validation

Executed:

```bash
node scripts/ci/assert-ci-workflow-coverage.mjs
npm test -- tests/ci.workflow.spec.js tests/simulation.registryLegacyFallbackGuard.spec.js tests/interaction.guideSync.spec.js tests/release.docsIntegrity.spec.js
npm run check
npm run baseline:p0
```

Result:

- Workflow guard now checks structure contracts instead of raw snippet presence.
- Targeted tests passed.
- Full `check` gate passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
