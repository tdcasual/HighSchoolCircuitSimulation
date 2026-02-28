# CI Script Guard Helper - Slice S (2026-04-24)

## Scope

Reduce duplicated temporary-workspace mutation logic across script guard tests and expand negative-path coverage for CI integrity scripts.

## Changes

1. Added reusable helper:
   - `tests/helpers/scriptGuardTestUtils.js`
   - Provides isolated temp-workspace script execution with optional per-file source mutation.
2. Migrated registry guard tests to helper:
   - `tests/simulation.registryLegacyFallbackGuard.spec.js`
3. Expanded interaction guide sync tests:
   - `tests/interaction.guideSync.spec.js`
   - Added script execution pass case and missing-item negative case.
4. Expanded docs integrity tests:
   - `tests/release.docsIntegrity.spec.js`
   - Added script execution pass case and missing-reference negative case.

## Validation

Executed:

```bash
npm test -- tests/simulation.registryLegacyFallbackGuard.spec.js tests/interaction.guideSync.spec.js tests/release.docsIntegrity.spec.js
npm run check
npm run baseline:p0
```

Result:

- Script guard tests now share one helper and cover pass/fail paths.
- Targeted tests passed.
- Full `check` gate passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
