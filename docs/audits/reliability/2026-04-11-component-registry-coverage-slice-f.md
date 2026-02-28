# Component Registry Coverage - Slice F (2026-04-11)

## Scope

Migrate `Diode` and `LED` stamp/current behavior into registry-first path while preserving `Solver` / `ResultPostprocessor` switch fallback branches for incremental rollout safety.

## Changes

1. Added shared junction-model registry handlers in `DefaultComponentRegistry`:
   - `Diode`
   - `LED` (reuses diode handler)
2. Stamping path now uses nonlinear junction linearization equivalent to solver logic:
   - `resolveJunctionParameters`
   - `linearizeJunctionAt`
   - Norton-equivalent stamp (`G` + `Ioffset`) via `stampResistor(1/G)` and `stampCurrentSource`
3. Current path now uses postprocessor-equivalent nonlinear evaluation:
   - `evaluateJunctionCurrent`
   - initial current from simulation state (`junctionCurrent`) when available
4. Added/extended registry tests for:
   - handler coverage assertions for `Diode`/`LED`
   - stamp/current numeric equivalence checks on representative diode setup

## Validation

Executed:

```bash
npm test -- tests/simulation.componentRegistry.spec.js
npm test -- tests/simulation.componentRegistry.spec.js tests/solver.junctionNonlinear.spec.js tests/solver.newComponents.spec.js tests/solver.commonCases.spec.js tests/simulation.resultPostprocessor.spec.js
npm run baseline:p0
npm run check
```

Result:

- RED tests for `Diode`/`LED` turned GREEN after implementation.
- Junction-focused and component regression subsets passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Full gate passed; existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
