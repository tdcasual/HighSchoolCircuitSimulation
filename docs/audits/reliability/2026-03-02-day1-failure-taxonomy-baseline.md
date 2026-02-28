# Reliability Baseline - Day 1 Failure Taxonomy (2026-03-02)

## Objective

Establish a deterministic, test-backed failure category layer that maps current topology + solver signals into canonical runtime diagnostics.

## Canonical Categories

| Category | Source Signal | Current Mapping Rule |
|---|---|---|
| `CONFLICTING_SOURCES` | Topology validation error | `topologyReport.error.code === TOPO_CONFLICTING_IDEAL_SOURCES` |
| `SHORT_CIRCUIT` | Runtime short diagnostics | `solverShortCircuitDetected === true` or non-empty `shortedSourceIds` |
| `SINGULAR_MATRIX` | Solver invalid reason | `results.meta.invalidReason in {factorization_failed, solve_failed}` |
| `INVALID_PARAMS` | Parameter validation signal | Non-empty `invalidParameterIssues` or `results.meta.invalidReason === invalid_params` |
| `FLOATING_SUBCIRCUIT` | Topology warning | Presence of warning `TOPO_FLOATING_SUBCIRCUIT` |

Priority order used by runtime classification:
1. `CONFLICTING_SOURCES`
2. `SHORT_CIRCUIT`
3. `SINGULAR_MATRIX`
4. `INVALID_PARAMS`
5. `FLOATING_SUBCIRCUIT`

Fatal categories (`hasFatalFailure=true`):
- `CONFLICTING_SOURCES`
- `SHORT_CIRCUIT`
- `SINGULAR_MATRIX`
- `INVALID_PARAMS`

Non-fatal advisory category:
- `FLOATING_SUBCIRCUIT`

## Implemented Artifacts

- Category mapper module:
  - `src/core/simulation/FailureDiagnostics.js`
- Baseline category tests:
  - `tests/failureDiagnostics.spec.js`

## Verification

Executed command:

```bash
npm test -- tests/failureDiagnostics.spec.js
```

Result:
- `1` test file passed
- `6` tests passed
- No failures

## Notes

- This baseline does not yet attach category payloads to app-level status messages.
- Day 2 should introduce structured runtime payload integration (`code/summary/hints/componentIds/wireIds`) using this category layer.
