# Diode/LED Tests - Design

## Context
We want a focused batch of semiconductor coverage for diode and LED components that emphasizes default parameters, cutoff behavior below threshold, and LED brightness saturation.

## Goals
- Verify diode default parameters are honored when custom values are not supplied.
- Confirm diode cutoff below forward voltage threshold.
- Confirm LED brightness saturates at 1 when current exceeds ratedCurrent.

## Non-Goals
- No solver changes or new component models.
- No non-linear IV curve modeling beyond existing linearized behavior.
- No thermal or time-dependent effects.

## Proposed Scenarios
1) **Diode uses default parameters (forward-biased)**
   - Series circuit: 5V source -> diode -> 100Ω resistor -> return.
   - Leave diode parameters at defaults (or explicitly null them) to exercise fallback.
   - Expect: conducting true, current ≈ (5 - 0.7) / (100 + 1).

2) **Diode below threshold stays off**
   - Series circuit: 0.5V source -> diode -> 100Ω resistor -> return.
   - Expect: conducting false, |current| < 1e-6.

3) **LED brightness saturates**
   - Series circuit: 5V source -> LED -> 10Ω resistor -> return.
   - Expect: conducting true, current ≈ (5 - 2) / (10 + 2) and brightness == 1.

## Test Location
- New file: `tests/solver.semiconductor.spec.js`
- Use helpers: `createTestCircuit`, `addComponent`, `connectWire`, `solveCircuit`

## Validation
- Targeted: `npm test -- tests/solver.semiconductor.spec.js`
- Full: `npm test`
