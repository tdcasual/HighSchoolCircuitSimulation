# Component Registry Pruning - Slice L (2026-04-17)

## Scope

Continue incremental removal of redundant legacy fallback `switch` branches now that registry coverage and fallback guards are in place.

Targeted fallback branches in this slice:
- `Thermistor` / `Photoresistor`
- `Ammeter` / `Voltmeter`

## Changes

1. Removed redundant fallback stamp branches in `Solver.stampComponent`:
   - `Thermistor`
   - `Photoresistor`
   - `Ammeter`
   - `Voltmeter`
2. Removed redundant fallback current branches in `ResultPostprocessor.calculateCurrent`:
   - `Thermistor`
   - `Photoresistor`
   - `Ammeter`
   - `Voltmeter`
3. Cleaned unused physics import from `ResultPostprocessor` after branch removal.

## Validation

Executed:

```bash
npm test -- tests/simulation.registryFallback.spec.js tests/simulation.componentRegistry.spec.js tests/solver.newComponents.spec.js tests/solver.commonCases.spec.js tests/simulation.resultPostprocessor.spec.js
npm run baseline:p0
npm run check
```

Result:

- Focused regression subsets passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Full gate passed; existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
