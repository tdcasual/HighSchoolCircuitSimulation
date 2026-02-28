# Component Registry Static Guard - Slice R (2026-04-23)

## Scope

Add negative regression tests for the registry static guard itself, so we verify not only the current green path but also guaranteed failure when legacy fallback patterns are reintroduced.

## Changes

1. Extended `tests/simulation.registryLegacyFallbackGuard.spec.js` with temporary-workspace mutation tests.
2. Added a helper that:
   - creates an isolated temp workspace,
   - copies `Solver.js` and `ResultPostprocessor.js`,
   - applies source mutations,
   - executes `assert-registry-legacy-fallback-guard.mjs` against that workspace.
3. Added explicit negative cases:
   - reintroducing `switch (comp.type)` in `stampComponent` fails.
   - removing registry-first type lookup in `stampComponent` fails.
   - introducing solver-state mutation in `buildSystemMatrixCacheKey` fails.

## Validation

Executed:

```bash
npm test -- tests/simulation.registryLegacyFallbackGuard.spec.js tests/simulation.registryFallback.spec.js
npm run check
npm run baseline:p0
```

Result:

- Guard tests now cover both pass and fail paths.
- Targeted tests passed.
- Full `check` gate passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
