# Day 22 Classroom Audit - Scenario Pack Definition

Date: 2026-03-23
Scope: Week 4 Day 22 (6 classroom presets + fixture validation)

## Goal

Finalize 6 classroom-ready scenario presets and add fixture-level validation tests.

## Implementation Summary

1. Added classroom scenario pack module
- `src/core/scenarios/ClassroomScenarioPack.js`
- Programmatic circuit builders with stable terminal-bound wires via serializer.
- Presets included:
  - `classroom-series`
  - `classroom-parallel`
  - `classroom-divider`
  - `classroom-rc-charge-discharge`
  - `classroom-motor-feedback`
  - `classroom-probe-measurement`
- Exported APIs:
  - `getClassroomScenarioPack()`
  - `getClassroomScenarioById(id)`

2. Added schema fixture validation tests
- `tests/circuitSchema.spec.js`
- Asserts scenario count/ids and validates all preset JSON via `validateCircuitJSON`.

3. Added load+run fixture validation tests
- `tests/circuit.io.spec.js`
- For each preset:
  - schema validation,
  - deserialize success,
  - runtime load + multi-step simulation remains valid.

## Verification Evidence

1. `npm test -- tests/circuit.io.spec.js tests/circuitSchema.spec.js`
- Result: pass
- Test files: 2 passed
- Tests: 13 passed

## Outcome

- All 6 classroom presets are now defined as reusable fixtures.
- Presets are covered by schema and runtime validation gates.
