# Live System Scorecard B r7

Branch: `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`
Scope: current working tree, including uncommitted files. Record-only audit.

| Dimension | Score | Live basis |
|---|---:|---|
| 架构整洁度 | 6.0 | `Circuit.js` is now 505 lines and services are extracted; classroom default reaches V2. The runtime is still a mutable `Circuit` facade with clock, topology, persistence, diagnostics, and simulation concerns, and V1/V2 remain separate kernels. |
| 健壮性 | 7.2 | V2 invalid results remain `valid:false` and call `noteAdaptive`; no fallback/standby mutation is performed. V1 and shadow preparation remain explicit. The 47 targeted tests pass, but the dual-kernel and mutable-state paths remain failure surfaces. |
| 解耦程度 | 6.0 | ViewMap overlays are consumed by Renderer, PropertyPanel, ObservationSources, and `Circuit.getComponentProperties`; live component fields stay untouched on V2. Netlist/MNA V1 still use live component references and the aggregate facade remains central. |
| 可扩展性 | 5.7 | V2 backend injection and explicit modes are clean extension points. Component behavior is still distributed across registries, projection/reset/UI/type switches, and V2 topology does not represent the production wire-building contract. |
| 可维护性 | 6.3 | The active path has focused adapters and test coverage, and the V2 header now accurately describes a runtime-reachable kernel. Interaction remains one prototype installed through `installInteractionMethodMaps`, with broad mixin ownership; two solver stacks also increase maintenance cost. |
| 兼容性代价（越低越好） | 6.5 | V2 is default for classroom, while explicit V1/shadow and embed-without-`solver=` V1 compatibility remain. Maintaining both kernels, ViewMap/live fallbacks, and mode-specific preparation is an ongoing compatibility tax. |

综合 = (6.0 + 7.2 + 6.0 + 5.7 + 6.3) / 5 = **6.2**.

## Required live checks

- `wc -l src/core/runtime/Circuit.js`: **505**.
- `CircuitSimulationLoopService.runStep`: invalid V2 arm calls `noteAdaptive`; it does not call `restoreStandby`, `setCircuit`, or `commitV1Substep`.
- `wrapSolverBackend`: only copies valid `runtimeOptions.solverBackend`/`shadowThrow`; it does not wrap `solveFrame` and does not restore standby on valid V2.
- Injected V2 + prepare + successful step: `circuit._solver` remains `null`; invalid V2 also leaves it `null`; success does not call `restoreStandby`.
- `resolveComponentViewRecord`: overlays I/U/P plus `blown`, `speed`, `conducting`, and `energized` (and other declared dynamic view fields). A missing ViewMap ID returns live structure with current/voltage/power set to zero.
- Named readers use ViewMap overlays: PropertyPanel via Renderer value resolution, ObservationSources directly, and `Circuit.getComponentProperties` directly.
- Interaction still installs one prototype map through `installInteractionMethodMaps`; the underlying prototype remains mixin-heavy.
- `mode === 'v1'` and `shadow` prepare/use V1; embed without `solver=` pins V1.
- `SolveCircuitV2.js` no longer claims to be tests-only; it states that the classroom default reaches it through the injected backend.

Remaining live-graph burdens are the mutable `Circuit` aggregate, V1 netlist/source coupling, scattered per-type dispatch, V2 topology divergence from production wires, and the prototype-mixed interaction manager. These keep the honest composite well below 8.0.

Validation: `npx vitest run tests/app.solverBackend.spec.js tests/app.solverBackend.defaultOn.spec.js tests/utils.componentViewRecord.spec.js tests/observationSources.spec.js tests/interaction.methodMaps.spec.js` — **5 files, 47 tests passed**.
