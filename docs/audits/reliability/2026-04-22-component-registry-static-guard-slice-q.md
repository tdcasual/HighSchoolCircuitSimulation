# Component Registry Static Guard - Slice Q (2026-04-22)

## Scope

Enforce registry-first method shape contracts in addition to anti-fallback checks, so future refactors cannot silently bypass registry dispatch paths.

Guarded methods:
- `MNASolver.stampComponent`
- `ResultPostprocessor.calculateCurrent`

## Changes

1. Enhanced `scripts/ci/assert-registry-legacy-fallback-guard.mjs` with positive structure assertions:
   - `stampComponent` must keep:
     - registry type lookup
     - default registry fallback lookup
     - `handler.stamp(...)` execution path
     - `stampDispatcher.stamp(...)` fallback path and handled return short-circuit
   - `calculateCurrent` must keep:
     - registry/current lookup
     - default registry current fallback lookup
     - `handler.current(...)` execution path
     - explicit `return 0` no-handler fallback
2. Extended `tests/simulation.registryLegacyFallbackGuard.spec.js`:
   - Added checks for new registry-first contract guard messages.

## Validation

Executed:

```bash
node scripts/ci/assert-registry-legacy-fallback-guard.mjs
npm test -- tests/simulation.registryLegacyFallbackGuard.spec.js tests/simulation.registryFallback.spec.js tests/simulation.resultPostprocessor.spec.js
npm run check
npm run baseline:p0
```

Result:

- Guard script passed with structure-contract checks enabled.
- Targeted tests passed.
- Full `check` gate passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
