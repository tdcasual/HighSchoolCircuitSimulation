# Next Issues After Default-on V2 — 2026-10-12 (refreshed)

- Date: 2026-10-12
- Scope: live classroom tree on execute-plan PR-6 (default-on V2 + Circuit façade + shared stamps/nodes). Record remaining debt. Do not rewrite `docs/audits/project/top30.md` status cells. Do not delete the V1 kernel (KD20 soak).
- Related: `2026-10-12-live-system-scorecard-a-r2.md`, `2026-10-12-live-system-scorecard-b-r2.md`, `docs/plans/2026-10-12-v2-cutover-design.md`

## Verdict

Classroom default solver is **V2** via Wiring A: `bootstrapV2` injects `createInjectedSolverBackend()` (`DEFAULT_SOLVER_BACKEND_MODE = 'v2'`). `AppRuntimeV2` never imports `src/v2`. Exclusive CI still forbids identifiers `SolveCircuitV2` / `runSimulationStepV2` in `src/app|ui|core|embed`.

Same-substep V1 fallback remains: restoreStandby → V1 for that `substepDt` → `commitStandbyFromCircuit`. Embed without `solver=` still pins v1 (KD7).

Stamp handlers and Shockley junction live in `src/utils/registerDefaultStamps.js` / `src/utils/JunctionModel.js`; both default registries register the **same handler objects**. Union-find lives in `src/utils/buildElectricalNodes.js`; live `NodeBuilder` and `NodeBuilderV2` are thin wrappers (live still writes `wire.nodeIndex`).

Remaining High: 1（H12/R1 dual live kernels until KD20）

## Remaining scorecard (live)

| ID | Sev | Status | Live |
|---|---|---|---|
| H12 / R1 | High | Open (soak) | Production tick uses injected V2. V1 `MNASolver` is constructed lazily on fallback/v1/shadow, not on the V2 success path. LU/stamp primitives/cache-key live in `src/utils`. Dual kernels remain until KD20. |
| R2 / A5 | High | **Done** | `Circuit.js` **502** lines; topology/sim lifecycle in existing services. `Object.assign(InteractionManagerClass.prototype` **0**. One `installInteractionMethodMaps`; leftover per-file `install*` delegates deleted. Interaction is still one prototype with shared `this`. |
| A2 remainder | Med | **Done** | Named classroom readers prefer `resolveComponentViewRecord`. `wrapSolverBackend` restores standby only. `applyViewMapToComponents` left production (test helper only). V1 `updateComponentDisplayValues` still runs when `backendUsed !== 'v2'`. Do not add `circuit.lastViewMap`. |
| N10 | Med | **Done** | Canonical P0 20 DC scenes unchanged. `baseline:p0:ext` has 6 extra scenes. |
| M5 | Med | Open | `DefaultComponentRegistry` aliases Bulb to Resistor. Linear filament. |
| M10 | Low | Open | `SimulationDriver` default 10ms. |
| M7 | Low | Open | Dual rheostat-drag flags. |
| M12 | Low | Open | ExerciseBoard / AIPanel over comfort size. |
| L1 | Low | Open | StampDispatcher only maps Resistor/Bulb; production uses shared registry. |
| L2 / A13 | Low | Open | InteractionModeStore still projects `legacyFlags`. |
| L4 | Low | Open | ESLint 8.57.1 EOL. |
| N3 | Low | Defer | vendor MathJax minified SRE string. Do not edit the blob. |
| N8 | Low | Accept | Node tests sanitize without DOM; browser uses template. |
| A3 | High-arch | **Done** | Shared `buildElectricalNodes` + shared junction/stamps. Live SOT remains production `NodeBuilder` (writes `wire.nodeIndex`); V2 snapshot uses the same union-find with canvas snap. |
| A7 | Low | Open | AppCompositionRootV2 is still a contract patch. |

## What to do next (ordered)

### 1. KD20 soak, then PR-G (delete V1) — do not start now

- Default V2 ≥14d and fallback/step <0.1%.
- Until then keep the fallback. Stamp-parity CI still runs; new types go in `registerDefaultStamps.js` only.

### 2. Live-field visuals (optional purity)

- Named readers already prefer ViewMap. Leftover live `currentValue` paint is V1/fallback only.
- Do not add `circuit.lastViewMap` unless a shipped reader needs it.

### 3. Later

| Item | When |
|---|---|
| M5 nonlinear bulb | Teaching need only |
| M10 display 20Hz / rAF | dt unchanged |
| L4 ESLint 9 | Toolchain |
| N3 SRE string | Never hand-edit minified |

## Anti-pattern / not next

- Do not delete V1 before KD20.
- Do not rewrite closed Top30 status cells.
- Do not treat exclusive-CI green as “V2 is tests-only”.
- Do not invent a third solver or a second ViewMap flag.
- Do not duplicate stamp bodies in `ComponentRegistry` / `StampRegistryV2`.
