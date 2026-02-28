# Component Registry Static Guard - Slice P (2026-04-21)

## Scope

Extend registry static guard coverage into `MNASolver.buildSystemMatrixCacheKey` to keep type-based cache-key logic pure and prevent behavioral solver logic from leaking into the cache-key path.

## Changes

1. Enhanced `scripts/ci/assert-registry-legacy-fallback-guard.mjs`:
   - Extracts `buildSystemMatrixCacheKey(nodeCount)` body.
   - Rejects behavioral side effects in the cache-key method:
     - any `this.stamp*()` invocation
     - `this.stampDispatcher.stamp(...)`
     - component/solver state mutation assignments
   - Requires explicit `return keyParts.join('|')` contract to keep key output deterministic.
2. Extended `tests/simulation.registryLegacyFallbackGuard.spec.js`:
   - Added assertions that guard script includes cache-key method checks and side-effect prohibition messages.

## Validation

Executed:

```bash
node scripts/ci/assert-registry-legacy-fallback-guard.mjs
npm test -- tests/simulation.registryLegacyFallbackGuard.spec.js tests/simulation.registryFallback.spec.js tests/solver.luCache.spec.js
npm run check
npm run baseline:p0
```

Result:

- Guard script passed with cache-key purity checks enabled.
- Targeted tests passed.
- Full `check` gate passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
