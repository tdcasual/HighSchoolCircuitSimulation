# Component Registry Coverage - Slice E (2026-04-10)

## Scope

Migrate `Relay` and `Rheostat` stamp/current behavior into registry-first path while preserving `Solver` / `ResultPostprocessor` switch fallback branches for incremental rollout safety.

## Changes

1. Added registry handlers in `DefaultComponentRegistry`:
   - `Relay`
   - `Rheostat`
2. Kept relay behavior equivalent to existing solver/postprocessor logic:
   - coil resistor + contact resistor stamping
   - current measurement based on coil branch (`nodes[0] -> nodes[1]`)
3. Kept rheostat behavior equivalent to existing solver/postprocessor logic:
   - all connection modes (`left-slider`, `right-slider`, `left-right`, `all`)
   - special node-equality handling in `all` mode
4. Extended registry tests for:
   - handler coverage assertions for `Relay`/`Rheostat`
   - representative stamp/current numeric equivalence checks

## Validation

Executed:

```bash
npm test -- tests/simulation.componentRegistry.spec.js
npm test -- tests/simulation.componentRegistry.spec.js tests/solver.newComponents.spec.js tests/solver.commonCases.spec.js tests/currentDirection.rheostat.spec.js
npm run baseline:p0
npm run check
```

Result:

- RED tests for `Relay`/`Rheostat` turned GREEN after implementation.
- Dynamic and component regression subsets passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Full gate passed; existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
