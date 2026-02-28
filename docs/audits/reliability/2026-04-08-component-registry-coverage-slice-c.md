# Component Registry Coverage - Slice C (2026-04-08)

## Scope

Migrate source stamping/current logic for `PowerSource` and `ACVoltageSource` into registry-first path while preserving Norton/ideal source behavior.

## Changes

1. Added shared source handlers in `DefaultComponentRegistry`:
   - Norton branch: stamp equivalent resistor + current source (`i2 -> i1`).
   - Ideal branch: stamp voltage source constraint with `vsIndex`.
2. Added source helper context to solver registry call:
   - `getSourceInstantVoltage`.
3. Extended component registry tests for source coverage and stamp semantics.

## Validation

Executed:

```bash
npm test -- tests/simulation.componentRegistry.spec.js tests/solver.newComponents.spec.js tests/solver.commonCases.spec.js
npm run baseline:p0
npm run check
```

Result:

- All tests passed.
- P0 baseline remained stable (`scenarios=20`).
- Full gate passed (existing non-blocking lint warning unchanged).

