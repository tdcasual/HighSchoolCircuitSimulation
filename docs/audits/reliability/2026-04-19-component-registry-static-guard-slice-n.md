# Component Registry Static Guard - Slice N (2026-04-19)

## Scope

Add a static CI guard to prevent reintroduction of legacy per-type fallback switch logic in the registry-first simulation path.

Guarded methods:
- `MNASolver.stampComponent`
- `ResultPostprocessor.calculateCurrent`

## Changes

1. Added static guard script:
   - `scripts/ci/assert-registry-legacy-fallback-guard.mjs`
   - Extracts target method bodies and fails if `switch (comp.type)` appears inside either method.
2. Added npm script wiring:
   - `check:registry-guard`
   - Included in top-level `npm run check` pipeline.
3. Added CI workflow step in quality job:
   - `Check registry legacy fallback guard`
4. Added regression coverage for wiring:
   - `tests/simulation.registryLegacyFallbackGuard.spec.js`
   - Extended `tests/ci.workflow.spec.js` expectations.

## Validation

Executed:

```bash
node scripts/ci/assert-registry-legacy-fallback-guard.mjs
npm test -- tests/simulation.registryLegacyFallbackGuard.spec.js tests/ci.workflow.spec.js tests/simulation.registryFallback.spec.js
npm run check
```

Result:

- Guard script passed on current source state.
- Targeted tests passed.
- Full check gate passed with existing non-blocking lint warning unchanged at `src/ui/ai/PanelLayoutController.js:125`.
