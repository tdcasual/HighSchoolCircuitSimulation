# Multi-Source / Multi-Ground C-Group Tests - Design

## Context
We want additional C-group robustness coverage for circuits with multiple power sources and multiple Ground components. The focus is classroom-realistic topologies that should remain solvable and yield deterministic voltages/currents.

## Goals
- Add deterministic tests for multi-source + multi-ground topologies.
- Assert stable electrical quantities: node voltages, branch currents, and ground selection behavior.
- Keep cases valid (no ideal-source conflicts) to avoid solver singularities.

## Non-Goals
- Do not change solver behavior or models.
- Do not include intentionally conflicting ideal voltage sources.
- Do not model non-linear or dynamic components in these tests.

## Proposed Scenarios
1) **Parallel sources with internal resistance + shared load/ground**
   - Two sources (e.g., 12V/1Ω and 6V/1Ω) in parallel feeding a resistor.
   - Assertions:
     - `results.valid === true`
     - Terminal voltage matches nodal solution:
       - `V = (E1/r1 + E2/r2) / (1/r1 + 1/r2 + 1/Rload)`
     - Load current `Iload = V / Rload`
     - Source currents `Ii = (Ei - V) / ri` and `I1 + I2 ≈ Iload`

2) **Series sources with midpoint ground**
   - Two ideal sources in series with a Ground at the junction; load across the series.
   - Assertions:
     - Midpoint node index is 0
     - Top node ≈ +V1, bottom node ≈ −V2
     - Load current = (V1 + V2) / R

3) **Multiple grounds on same node**
   - Two Ground components connected to the same node in a simple loop.
   - Assertions:
     - Both ground nodes resolve to 0
     - Circuit current equals expected V/R

4) **Ground inside floating subcircuit**
   - Main loop uses Ground G1 as reference; a floating loop has Ground G2.
   - Assertions:
     - G1 is node 0; G2 is not node 0
     - Both loops solve with expected V/R locally

## Test Location
- New file: `tests/solver.multiSourceMultiGround.spec.js`
- Uses existing helpers: `createTestCircuit`, `addComponent`, `connectWire`, `solveCircuit`

## Risks / Notes
- Keep internal resistances non-zero when sources are in parallel.
- Use only linear components to keep expected values closed-form and stable.
- Avoid short-circuit detection flags by keeping reasonable loads.

## Validation
- Run targeted test: `npm test -- tests/solver.multiSourceMultiGround.spec.js`
- Run full suite: `npm test`
