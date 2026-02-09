# Integration Method Switch Tests - Design

## Context
We want B-group coverage for integration method selection (auto/trapezoidal/backward-euler) for capacitors and inductors, including the switch override behavior.

## Goals
- Verify method selection policy (history gating, explicit overrides, switch forcing backward-euler).
- Cover both capacitor and inductor cases.
- Keep assertions deterministic and focused on method selection, not waveform accuracy.

## Non-Goals
- No changes to solver logic.
- No detailed numeric transient validation.
- No non-linear components.

## Proposed Scenarios
1) **Auto + no switch**
   - Before history: backward-euler
   - After 1–2 steps: trapezoidal

2) **Auto + connected switch**
   - Always backward-euler, regardless of history readiness.

3) **Explicit trapezoidal**
   - Before history: fallback to backward-euler
   - After history: trapezoidal

4) **Explicit backward-euler**
   - Always backward-euler regardless of history or switch.

Each scenario is mirrored for Capacitor and Inductor where applicable.

## Implementation Notes
- Build small RC/RL circuits with PowerSource + Resistor + C/L.
- Use `circuit.solver.setCircuit(...)` and `solver.resolveDynamicIntegrationMethod(comp)` to inspect decisions.
- Ensure history readiness by running `circuit.step()` with `circuit.isRunning=true`.
- Add a connected `Switch` to force `hasConnectedSwitch` and re-evaluate.

## Test Location
- New file: `tests/solver.integrationMethodSwitch.spec.js`

## Validation
- `npm test -- tests/solver.integrationMethodSwitch.spec.js`
- `npm test`
