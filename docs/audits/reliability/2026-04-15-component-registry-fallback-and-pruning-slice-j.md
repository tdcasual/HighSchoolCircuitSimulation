# Component Registry Fallback & Pruning - Slice J (2026-04-15)

## Scope

Prepare safe removal of legacy `switch` branches by ensuring custom registries automatically fall back to `DefaultComponentRegistry` when a type handler is missing, then remove first redundant fallback branches (`Resistor`/`Bulb`).

## Changes

1. Added fallback resolution in solver stamp path:
   - `customRegistry.get(type)` miss -> `DefaultComponentRegistry.get(type)`
2. Added fallback resolution in postprocessor current path:
   - `customRegistry.get(type)` miss -> `DefaultComponentRegistry.get(type)`
3. Added guard tests for fallback behavior:
   - `tests/simulation.registryFallback.spec.js`
   - verifies both stamp and current lookup fallback to default registry
4. Pruned first redundant legacy branches after fallback was in place:
   - removed `Resistor` / `Bulb` cases from `Solver.stampComponent` fallback `switch`
   - removed `Resistor` / `Bulb` cases from `ResultPostprocessor.calculateCurrent` fallback `switch`

## Validation

Executed:

```bash
npm test -- tests/simulation.registryFallback.spec.js
npm test -- tests/simulation.registryFallback.spec.js tests/simulation.componentRegistry.spec.js tests/solver.newComponents.spec.js tests/solver.commonCases.spec.js tests/simulation.resultPostprocessor.spec.js
npm run baseline:p0
npm run check
```

Result:

- Fallback RED tests turned GREEN.
- Focused regression subsets passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Full gate passed; existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
