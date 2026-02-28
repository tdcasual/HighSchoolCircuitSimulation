# Component Registry Pruning - Slice M (2026-04-18)

## Scope

Finish incremental removal of redundant legacy fallback `switch` branches after registry coverage closure and fallback hardening.

Targeted fallback branches in this slice:
- Residual component branches in `Solver.stampComponent`
- Residual component branches in `ResultPostprocessor.calculateCurrent`

## Changes

1. Removed the remaining legacy fallback `switch` block in `Solver.stampComponent`.
   - Unknown/unhandled component types now become explicit no-op when neither registry nor dispatcher handles the component.
2. Removed the remaining legacy fallback `switch` block in `ResultPostprocessor.calculateCurrent`.
   - Unknown/unhandled component types now explicitly return `0`.
3. Added regression tests to pin unknown-type behavior:
   - stamp path keeps matrix/vector unchanged
   - current path returns `0A`
4. Pruned newly unused imports in `Solver` created by fallback removal.

## Validation

Executed:

```bash
npm test -- tests/simulation.registryFallback.spec.js
npm run baseline:p0
npm run check
```

Result:

- Added fallback behavior tests passed.
- P0 electrical baseline remained stable (`scenarios=20`).
- Full gate passed; existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
