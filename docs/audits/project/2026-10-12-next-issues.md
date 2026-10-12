# Next Issues After Default-on V2 — 2026-10-12 (refreshed)

- Date: 2026-10-12
- Scope: live classroom tree at execute-plan PR-F tip (`49f0289` and follow-up slim audit fixes). Record remaining debt. Do not rewrite `docs/audits/project/top30.md` status cells. Do not rewrite InteractionManager. Do not delete the V1 kernel (KD20 soak).
- Related: `2026-10-12-live-system-scorecard-a.md`, `2026-10-12-live-system-scorecard-b.md`, `docs/plans/2026-10-12-v2-cutover-design.md`

## Verdict

Classroom default solver is **V2** via Wiring A: `bootstrapV2` injects `createInjectedSolverBackend()` (`DEFAULT_SOLVER_BACKEND_MODE = 'v2'`). `AppRuntimeV2` never imports `src/v2`. Exclusive CI still forbids identifiers `SolveCircuitV2` / `runSimulationStepV2` in `src/app|ui|core|embed` — that is an import-boundary check, not proof that production stays on V1.

Same-substep V1 fallback remains: restoreStandby → V1 for that `substepDt` → `commitStandbyFromCircuit`. Embed without `solver=` still pins v1 (KD7).

Remaining High: 2（H12/R1 dual live kernels until KD20; R2/A5 Circuit god object + 33 mixins）

## Remaining scorecard (live)

| ID | Sev | Status | Live |
|---|---|---|---|
| H12 / R1 | High | Open (soak) | Production tick uses injected V2 (`runSimulationStepV2` inside `src/v2` only). V1 `MNASolver` is the same-substep fallback and explicit/embed-v1 path. `SolveCircuitV2.js` is **516** lines. Do not isolate/remove the island while classroom default is V2. |
| R2 / A5 | High | Open | `Circuit.js` **1078** lines; add/remove, step, IO, diagnostics on one instance. `Object.assign(InteractionManagerClass.prototype` **33** times. |
| A2 remainder | Med | Partial | Adapter still copies I/V/P onto live components for meter/property/observation readers. `RuntimeUiBridge.onCircuitUpdate` now calls `Renderer.setViewMap` on valid v2 and clears on V1/fallback/stop/clear/load. Do not delete the adapter yet. |
| N10 | Med | **Done** | Canonical P0 20 DC scenes unchanged. `baseline:p0:ext` has 6 extra scenes (motor stall, AC RMS, diode forward/reverse, switch). Do not duplicate that work. |
| M5 | Med | Open | `DefaultComponentRegistry.register('Bulb', Resistor)`. Linear filament. |
| M10 | Low | Open | `SimulationDriver` default 10ms. |
| M7 | Low | Open | Dual rheostat-drag flags. Follow mixin split. |
| M12 | Low | Open | ExerciseBoard / AIPanel over comfort size. |
| L1 | Low | Open | StampDispatcher only maps Resistor/Bulb; production uses registry. |
| L2 / A13 | Low | Open | InteractionModeStore still projects `legacyFlags`. |
| L4 | Low | Open | ESLint 8.57.1 EOL. |
| N3 | Low | Defer | vendor MathJax minified SRE string. Do not edit the blob. |
| N8 | Low | Accept | Node tests sanitize without DOM; browser uses template. |
| A3 | High-arch | **Updated** | `TopologyCoordinatorV2.buildNetlist` passes `wires` into `NodeBuilderV2` (union-find). Live node SOT is still production `NodeBuilder` until R2. Junction stamps are Shockley linearization on both registries (Ron/Roff fork is closed). |
| A7 | Low | Open | AppCompositionRootV2 is still a contract patch. |

## What to do next (ordered)

### 1. KD20 soak, then PR-G (delete V1) — do not start now

- Default V2 ≥14d and fallback/step <0.1%.
- Until then keep the fallback and stamp-parity CI.

### 2. Remaining ViewMap readers (true purity)

- MeasurementReadout / PropertyPanel / ObservationSources / ObservationExportService still read live `currentValue`.
- After those read ViewMap or a single renderer snapshot, delete `applyViewMapToComponents`.
- Do not add `circuit.lastViewMap` unless a shipped reader needs it.

### 3. R2 — Circuit façade and mixin retirement (P3)

- Separate from soak. Do not mix with kernel deletion.

### 4. Later

| Item | When |
|---|---|
| M5 nonlinear bulb | Teaching need only |
| M10 display 20Hz / rAF | dt unchanged |
| L4 ESLint 9 | Toolchain |
| N3 SRE string | Never hand-edit minified |

## Anti-pattern / not next

- Do not rewrite 33 mixins to chase an architecture score.
- Do not delete V1 before KD20.
- Do not rewrite closed Top30 status cells.
- Do not treat exclusive-CI green as “V2 is tests-only”.
- Do not invent a third solver or a second ViewMap flag.

## Suggested first ticket after soak starts

**PRJ-047**：把剩余面板/观测读数从 `comp.currentValue` 迁到 Renderer ViewMap（或 `circuit.lastResults.viewMap`），适配器调用次数降到 0 后再删 `applyViewMapToComponents`。
