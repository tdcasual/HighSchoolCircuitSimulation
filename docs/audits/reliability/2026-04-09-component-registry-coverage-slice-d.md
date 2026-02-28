# Component Registry Coverage - Slice D (2026-04-09)

## Scope

Migrate dynamic current computation for `Capacitor`, `ParallelPlateCapacitor`, and `Inductor` into registry-first path while keeping `ResultPostprocessor` fallback switch branches unchanged for incremental rollout safety.

## Changes

1. Added `current` handlers to `DefaultComponentRegistry`:
   - `Capacitor`
   - `ParallelPlateCapacitor` (reuses capacitor handler)
   - `Inductor`
2. Kept formulas aligned with existing postprocessor behavior for both methods:
   - `backward-euler`
   - `trapezoidal`
3. Added dynamic state resolver helper in registry to support both state shapes:
   - `Map`-backed simulation state (`state.get(comp.id)`)
   - direct state entry object (postprocessor current context)
4. Extended registry tests for dynamic current handler coverage and numeric behavior.

## Validation

Executed:

```bash
npm test -- tests/simulation.componentRegistry.spec.js
npm test -- tests/simulation.componentRegistry.spec.js tests/simulation.resultPostprocessor.spec.js tests/solver.dynamicIntegration.spec.js tests/solver.newComponents.spec.js
npm run baseline:p0
npm run check
```

Result:

- Registry RED tests turned GREEN after implementation.
- Dynamic-focused suites passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Full gate passed; existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
