# Simulation Core Decoupling Design

Date: 2026-02-08  
Project: `HighSchoolCircuitSimulation`  
Focus: Reduce coupling in simulation core, improve extensibility and testability.

## 1. Goal And Boundaries

Primary goals:

- Separate component parameters from runtime simulation state.
- Reduce cross-module `switch` logic for component types.
- Make the solver less dependent on UI geometry and component object mutation.

In scope:

- Simulation core data flow (`Circuit -> Solver -> Postprocess -> DynamicIntegrator`).
- A new runtime state container (SimulationState).
- A component registry that centralizes stamp/current/connectivity rules.

Out of scope:

- Changes to physics models or numerical behavior.
- UI/UX redesign.
- Breaking JSON compatibility.

## 2. Target Architecture (High-Level)

Recommended migration order: **B -> A -> (optional) C**.

B. SimulationState first (low risk):
- Introduce a `SimulationState` map keyed by component id.
- Move runtime fields (prevCurrent, prevVoltage, backEmf, conducting, energized, etc.) into state.
- Keep component objects as static parameter carriers.

A. ComponentRegistry next (medium risk):
- Provide `defaults`, `stamp`, `current`, `connectivityRule`, and `displayHints` per type.
- Solver and ResultPostprocessor route through the registry instead of `switch` chains.

C. Netlist adapter last (optional, higher risk):
- Convert topology/geometry to a pure electrical netlist.
- Solver depends only on netlist + state, not on geometry.

## 3. Data Flow And Error Model

New data flow:

1) `Circuit.ensureSolverPrepared()` builds topology and prepares solver input.
2) `Solver.solve(netlist, state, dt, time)` returns `{valid, voltages, currents, diagnostics}`.
3) `ResultPostprocessor` computes branch currents using registry rules and state.
4) `DynamicIntegrator` updates `SimulationState` only (no component mutation).
5) `Circuit` maps results to UI display values (current/voltage/power).

Error handling:

- All solver failures return `valid: false` with a diagnostics payload.
- UI consumes diagnostics for status messaging instead of direct console warnings.
- `Circuit` retains last valid result (do not erase UI values on failure).

## 4. Migration Plan

### Phase 1: SimulationState (Low Risk)

- Add `SimulationState` (Map or class) to store runtime fields by `componentId`.
- Update DynamicIntegrator to read/write SimulationState.
- Update Solver/ResultPostprocessor to read state instead of mutating `comp.*`.
- Keep temporary dual-write to component fields until regression is stable.

DoD:
- `tests/solver.*`, `tests/currentDirection.*` pass.
- `npm run baseline:p0` and `npm run baseline:circuitjs` pass.

### Phase 2: ComponentRegistry (Medium Risk)

- Create `ComponentRegistry` with per-type handlers:
  - `stamp(component, state, context)`
  - `current(component, state, context)`
  - `connectivityRule(component, topology)`
  - `defaults`
- Replace `switch` chains in Solver/ResultPostprocessor/ConnectivityCache with registry lookup.
- Migrate types incrementally (Resistor/Bulb first, then dynamic components).

DoD:
- New types require registry-only changes (no Solver edits).
- Existing tests and baselines remain green.

### Phase 3: Netlist Adapter (Optional, High Risk)

- Introduce `NetlistBuilder` that transforms topology -> netlist DTO.
- Solver consumes netlist only; UI remains on geometry.
- Build mapping from netlist nodes to UI node indices for display.

DoD:
- All solver regression suites green.
- Geometry changes no longer require solver changes.

## 5. Risks And Controls

Risks:

- Behavior drift during state migration.
- Dual-write period creates inconsistent state if not carefully controlled.
- Registry migration may introduce missing type handling.

Controls:

- Migrate one component type at a time.
- Keep dual-write for a short window, then remove.
- Use regression baselines after each phase.

## 6. Verification Gates

Required before each phase completion:

- `npm test`
- `npm run baseline:p0`
- `npm run baseline:circuitjs`

Optional (only when AI modules touched):

- `npm run baseline:ai`

## 7. Ready Criteria For Implementation

Implementation can start when:

- The team confirms phase order B -> A -> C.
- SimulationState interface is defined.
- Baseline commands are runnable and green.

Next step after this design: create an implementation plan with per-phase tasks and a rollback checklist.
