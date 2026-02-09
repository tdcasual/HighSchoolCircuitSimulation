# Misuse Tests (Instrument/Switch + Dynamic) - Design

## Context
We want additional classroom-focused tests for common wiring mistakes and dynamic misuse cases. These should validate solver behavior under realistic mis-wiring without introducing ideal-source conflicts.

## Goals
- Add deterministic tests for instrument/switch misuse.
- Add deterministic tests for dynamic component misuse/edge behavior.
- Keep circuits linear and solvable with closed-form expectations.

## Non-Goals
- Do not change solver behavior or models.
- Do not add new components.
- Do not introduce intentionally conflicting ideal sources.

## Proposed Scenarios
### Instrument / Switch Misuse (tests/solver.commonMistakes.spec.js)
1) **Closed switch bypassing a load**
   - Source -> series limiter resistor -> node -> load to ground, plus a closed switch in parallel with the load.
   - Expect load current ~0, node voltage ~0, limiter current ~V/Rlim.

2) **Ammeter in parallel with a load**
   - Source -> series limiter -> node -> load to ground, plus ideal ammeter in parallel with the load.
   - Expect load current ~0, ammeter current ~V/Rlim.

3) **Voltmeter in series with finite resistance**
   - Source -> series voltmeter (finite resistance) -> load -> ground.
   - Expect current reduced but non-zero; voltmeter drop ~I * Rvm.

### Dynamic Misuse (tests/solver.dynamicIntegration.spec.js)
1) **Precharged capacitor with open switch**
   - Set cap prevVoltage/prevCharge, then open the series switch to isolate it.
   - Expect cap voltage stays ~V0, current ~0 after a step.

2) **Inductor free decay from initial current**
   - Source set to 0 V, series R-L loop; seed prevCurrent.
   - Expect BE recurrence: i1 = i0 / (1 + dt * R / L).

3) **Capacitor inrush on first step**
   - RC with backward-Euler; compute V1 from recurrence and I = C * (V1 - V0) / dt.
   - Expect first-step current and voltage match.

## Test Location
- Instrument/switch misuse: `tests/solver.commonMistakes.spec.js`
- Dynamic misuse: `tests/solver.dynamicIntegration.spec.js`

## Validation
- Targeted: `npm test -- tests/solver.commonMistakes.spec.js`
- Targeted: `npm test -- tests/solver.dynamicIntegration.spec.js`
- Full: `npm test`
