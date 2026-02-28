# Component Registry Static Guard - Slice O (2026-04-20)

## Scope

Harden the static guard introduced in Slice N so legacy fallback logic cannot return via `if/else` per-type branches.

## Changes

1. Upgraded guard logic in `scripts/ci/assert-registry-legacy-fallback-guard.mjs`:
   - Still rejects `switch (comp.type)` in guarded methods.
   - Additionally parses `comp.type` equality/inequality checks and `[].includes(comp.type)` patterns.
   - Enforces a strict whitelist of structural precheck types inside:
     - `stampComponent(comp, A, z, nodeCount)`
     - `calculateCurrent(comp, context = {})`
2. Extended guard test:
   - `tests/simulation.registryLegacyFallbackGuard.spec.js` now executes the guard script and asserts successful pass on current source.

## Validation

Executed:

```bash
node scripts/ci/assert-registry-legacy-fallback-guard.mjs
npm test -- tests/simulation.registryLegacyFallbackGuard.spec.js tests/simulation.registryFallback.spec.js
npm run check
```

Result:

- Guard script passed with whitelist checks enabled.
- Targeted tests passed.
- Full `check` gate passed; existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
