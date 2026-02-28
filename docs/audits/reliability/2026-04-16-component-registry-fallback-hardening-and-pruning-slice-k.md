# Component Registry Fallback Hardening & Pruning - Slice K (2026-04-16)

## Scope

Harden registry fallback behavior for partial custom handlers (handler exists but lacks `stamp`/`current`) and prune next redundant legacy branches (`Switch` / `SPDTSwitch` / `Fuse`) from solver/postprocessor fallback switches.

## Changes

1. Hardened solver registry lookup:
   - Prefer custom handler only when it provides `stamp()`.
   - If custom handler exists but lacks `stamp()`, fall back to `DefaultComponentRegistry` handler when available.
2. Hardened postprocessor registry lookup:
   - Prefer custom handler only when it provides `current()`.
   - If custom handler exists but lacks `current()`, fall back to `DefaultComponentRegistry` handler when available.
3. Extended fallback tests in `tests/simulation.registryFallback.spec.js`:
   - custom handler missing `stamp()` -> fallback stamp works
   - custom handler missing `current()` -> fallback current works
4. Pruned additional redundant fallback switch branches:
   - `Solver.stampComponent`: removed `Switch` / `SPDTSwitch` / `Fuse` cases
   - `ResultPostprocessor.calculateCurrent`: removed `Switch` / `SPDTSwitch` / `Fuse` cases

## Validation

Executed:

```bash
npm test -- tests/simulation.registryFallback.spec.js
npm test -- tests/simulation.registryFallback.spec.js tests/simulation.componentRegistry.spec.js tests/solver.newComponents.spec.js tests/solver.commonCases.spec.js tests/simulation.resultPostprocessor.spec.js
npm run baseline:p0
npm run check
```

Result:

- Fallback RED test for missing `current()` turned GREEN after implementation.
- Focused regression subsets passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Full gate passed; existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
