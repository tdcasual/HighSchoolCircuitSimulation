# RC/RL Transient Tests - Design

## Context
We want B-group coverage for RC/RL transient behavior in the solver using a deterministic backward-Euler recurrence. The goal is to validate discrete-time updates for charge/discharge and current rise/decay.

## Goals
- Add tests for RC charge and discharge using backward-Euler recurrence.
- Add tests for RL current rise and decay using backward-Euler recurrence.
- Keep assertions deterministic and focused on discrete-step behavior.

## Non-Goals
- No solver/model changes.
- No continuous-time accuracy benchmarking.
- No nonlinear components.

## Proposed Scenarios
1) **RC charging (BE)**
   - Circuit: Vs -> R -> C -> return, with `integrationMethod='backward-euler'`.
   - Recurrence: `V_{n+1} = (V_n + α*Vs) / (1+α)` where `α = dt/(R*C)`.

2) **RC discharging (BE)**
   - Vs = 0, pre-charge C by setting `prevCharge=C*V0`, `prevVoltage=V0`.
   - Recurrence: `V_{n+1} = V_n / (1+α)`.

3) **RL rise (BE)**
   - Circuit: Vs -> R -> L -> return, with `integrationMethod='backward-euler'`.
   - Recurrence: `I_{n+1} = (I_n + dt*Vs/L) / (1 + dt*R/L)`.

4) **RL decay (BE)**
   - Vs = 0, pre-seed `prevCurrent=I0`.
   - Recurrence: `I_{n+1} = I_n / (1 + dt*R/L)`.

## Implementation Notes
- Use small, linear circuits and `circuit.step()` with `isRunning=true`.
- Read capacitor voltage from `lastResults.voltages` and inductor current from `lastResults.currents`.
- Keep dt/R/C/L values simple (e.g., dt=0.01, R=100Ω, C=1mF, L=0.1H).

## Test Location
- New file: `tests/solver.rcRlTransient.spec.js`

## Validation
- `npm test -- tests/solver.rcRlTransient.spec.js`
- `npm test`
