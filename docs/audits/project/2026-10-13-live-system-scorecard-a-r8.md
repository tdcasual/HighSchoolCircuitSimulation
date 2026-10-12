# Live-system scorecard A-R8 — C16 classroom V2-only tick

- Auditor: implementer (Grok)
- Tree: working tree on `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs` (uncommitted C16).
- Parent: `2026-10-12-live-system-scorecard-a-r7.md` (综合 **8.5**).
- Policy: record the live object graph. Do not invent a matching second-auditor score.

## Scores

| 维度 | A-R7 | **A-R8 C16** |
|---|---:|---:|
| 架构整洁度 | 8.7 | **8.9** |
| 健壮性 | 8.0 | **8.3** |
| 解耦程度 | 8.6 | **8.8** |
| 可扩展性 | 8.4 | **8.5** |
| 可维护性 | 8.7 | **8.8** |
| 兼容性代价（越低越好） | 4.4 | **3.6** |
| **综合** | **8.5** | **8.7** |

综合 = (8.9+8.3+8.8+8.5+8.8)/5 = 8.66 → **8.7**

## Live evidence

- `Circuit.js` is 484 lines. It does not import `MNASolver`. There is no `_solver` getter/setter. `grep MNASolver src/**/*.js` hits only `src/core/simulation/MNASolver.js`.
- `CircuitSimulationLoopService.runStep` calls `backend.solveFrame` only. Invalid stays `{valid:false, backendUsed:'v2'}`, `noteAdaptive`, `break`. No `restoreStandby` / `setCircuit` / `commitV1Substep`. `ensureSolverPrepared` is a no-op.
- `createInjectedSolverBackend` is a v2-only duck `{mode:'v2', solveFrame, reset}`. Wrap is identity (`wrapSolverBackend` returns `backend`).
- Embed enabled without `solver=` pins `'v2'`. `SimulationRefreshSkill` and `debugRuntimeCircuit` call `solveFrame` only.
- `Circuit.step` does not write live I/U/P. Named readers overlay ViewMap. `resetRuntimeCaches` calls `solverBackend.reset()` so clear/load does not leak V2 capacitor/fuse state.
- `installInteractionMethodMaps(this)` assigns maps onto the instance and groups `host.controllers`. No `Object.assign(InteractionManager.prototype)`.
- Dual `NodeBuilder` wrappers remain (v2 architecture CI forbids inlining into TopologyCoordinatorV2). Type switches remain in stamps/prepare. V1 kernel files remain for isolated tests / KD20.

## Dimension judgments

- **架构整洁度 8.9:** Classroom tick is one injected kernel. Circuit is a mutable document façade without a solver. Remaining: Circuit still holds clock+topology+IO.
- **健壮性 8.3:** Fail-closed invalid V2 plus adaptive. Clear/fromJSON resets V2 state. Same-substep V1 recovery is gone by design.
- **解耦程度 8.8:** Live components are not the display SOT on the classroom tick. Interaction methods are instance-composed. Remaining: Circuit is still the hub.
- **可扩展性 8.5:** Inject `solveFrame`. Shared stamp/LU table. Type switches and dual NodeBuilder wrappers remain.
- **可维护性 8.8:** Loop, wrap, and factory are short. Interaction has one install site. V1 kernel is tests-only.
- **兼容性代价 3.6:** KD20 keeps V1 source on disk. Classroom and embed no longer orchestrate two kernels.

## Explicit >8.0 judgment

**综合 8.7 is > 8.0.** Remaining debt is the mutable Circuit aggregate, type switches, dual NodeBuilder wrappers, and on-disk V1 until KD20.
