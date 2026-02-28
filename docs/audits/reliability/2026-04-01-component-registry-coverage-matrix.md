# Component Registry Coverage Matrix (2026-04-01)

## Scope

Assess stamp/current routing coverage for all component types defined in `ComponentDefaults`, and verify Day 3 Slice A migration targets are registry-first.

Routing legend:
- `Registry` = handled by `DefaultComponentRegistry`
- `Switch` = handled by legacy `Solver` / `ResultPostprocessor` switch path
- `Special` = explicit early-return path (not stamped)

## Coverage Matrix

| Component Type | Stamp Route | Current Route | Day 3 Status |
|---|---|---|---|
| Ground | Special | Special | N/A |
| PowerSource | Switch | Switch | Backlog |
| ACVoltageSource | Switch | Switch | Backlog |
| Resistor | Registry | Registry | Complete |
| Diode | Switch | Switch | Backlog |
| LED | Switch | Switch | Backlog |
| Thermistor | Registry | Registry | Complete |
| Photoresistor | Registry | Registry | Complete |
| Relay | Switch | Switch | Backlog |
| Rheostat | Switch | Switch | Backlog |
| Bulb | Registry | Registry | Complete |
| Capacitor | Registry | Switch | Partial |
| Inductor | Registry | Switch | Partial |
| ParallelPlateCapacitor | Registry | Switch | Partial |
| Motor | Switch | Switch | Backlog |
| Switch | Switch | Switch | Backlog |
| SPDTSwitch | Switch | Switch | Backlog |
| Fuse | Switch | Switch | Backlog |
| Ammeter | Registry | Registry | Complete |
| Voltmeter | Registry | Registry | Complete |
| BlackBox | Switch (no-op) | Switch (default 0) | Backlog |

## Day 3 Slice A Deliverables

1. Added registry stamp/current handlers for `Thermistor`, `Photoresistor`, `Ammeter`, `Voltmeter`.
2. Wired solver registry stamp context with `stampVoltageSource` so ideal ammeter behavior remains equivalent.
3. Wired result postprocessor registry current context with solve vector and node count for ideal ammeter current extraction.
4. Added coverage tests in `tests/simulation.componentRegistry.spec.js` for Day 3 target types and resistance-model stamping.

## Verification

Executed:

```bash
npm test -- tests/simulation.componentRegistry.spec.js tests/solver.newComponents.spec.js tests/solver.commonCases.spec.js
npm run baseline:p0
```

Result:
- All listed tests passed.
- P0 electrical baseline comparison passed (`scenarios=20`).

## Follow-up Candidates

- Next migration slice: `PowerSource`, `ACVoltageSource`, `Switch`/`SPDTSwitch`, and `Fuse`.
- Dynamic current unification candidates: `Capacitor`, `Inductor`, `ParallelPlateCapacitor` current handlers.
