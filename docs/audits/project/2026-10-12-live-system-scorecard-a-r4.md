# Live-system scorecard A — wrap-stop + shared LU + lazy V1 — 2026-10-12

- Auditor: implementer (Grok)
- Tree: working tree on `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`.
- Includes: Circuit façade; mixin method-map install; ViewMap classroom+AI readers; V2 skip V1 prepare; shared stamps/junction/union-find; **wrapSolverBackend no longer copies ViewMap; LU/stamp primitives/cache-key in `src/utils`; V1 `MNASolver` lazy on fallback/v1/shadow**.
- Parent: `2026-10-12-live-system-scorecard-a-r3.md` (综合 **8.1**).
- Policy: record the live object graph. Do not invent a matching second-auditor score. V1 kernel remains (KD20).

## Scores

| 维度 | shared stamps/nodes | **wrap-stop + shared LU + lazy V1** |
|---|---:|---:|
| 架构整洁度 | 8.1 | **8.3** |
| 健壮性 | 8.0 | **8.0** |
| 解耦程度 | 7.8 | **8.1** |
| 可扩展性 | 8.3 | **8.4** |
| 可维护性 | 8.3 | **8.4** |
| 兼容性代价（越低越好） | 5.5 | **5.2** |
| **综合** | **8.1** | **8.2** |

综合 = (8.3+8.0+8.1+8.4+8.4)/5 = 8.24 → **8.2**

## Live evidence

- `Circuit.js` **502** lines. Constructor sets `this._solver = null`. Getter constructs `MNASolver` only on first read. `setLogger` / `setDebugMode` / diagnostics use `_solver?.…`. `Object.assign(InteractionManagerClass.prototype` **0**.
- `wrapSolverBackend` `solveFrame` on valid v2 calls `restoreStandby` only. It does not call `applyViewMapToComponents`. Shipped test: live seed `currentValue` 9 stays 9. `applyViewMapToComponents` remains for tests / V1-era callers (`two release cycles`).
- Shipped test: `createInjectedSolverBackend` + wrap + `prepareSimulation` + `step` leaves `circuit._solver` **null** and `lastResults.backendUsed === 'v2'`.
- `src/utils/linearAlgebra.js` owns GMIN / zeros / factorize / stampResistor|Current|Voltage|SeriesVoltage / applyGmin. `LinearAlgebraV2` re-exports it. `Matrix` wraps the same factorize/zeros (clone/multiply/print deleted). `buildSystemMatrixCacheKey` lives in `src/utils`; V1 builder and V2 re-export it.
- Stamp table, JunctionModel, `buildElectricalNodes` unchanged from R3: one handler object, one junction, one union-find. Live NodeBuilder still writes `wire.nodeIndex`.
- V2 `runStep` / `prepareSimulation` skip `ensureSolverPrepared` / `setCircuit`. Fallback still restoreStandby → `context.solver.setCircuit` → V1 substep.
- Named readers still prefer `resolveComponentViewRecord`. Missing record still returns the live component.

## Dimension judgments

- **架构整洁度 8.3:** Production tick is injected V2 + shared math/stamps/nodes. V1 is a lazy fallback object, not a constructor-time twin. Circuit is still a mutable-document façade; Interaction is still one prototype; services still take the whole Circuit as `context`.
- **健壮性 8.0:** Same-substep fallback unchanged. Wrap-stop is more honest about live seed; classroom readouts go through ViewMap. No new failure mode covered beyond existing restoreStandby.
- **解耦程度 8.1:** V2 success path does not stamp V1, does not construct V1, and does not copy ViewMap onto live. Remaining coupling: fallback still mutates Circuit via `context.solver`; Interaction shared `this`; missing-record readers still see live fields.
- **可扩展性 8.4:** New stamp still one table. LU/cache-key now one implementation both kernels call. Device-type switches remain in step init, topology, and AI copy.
- **可维护性 8.4:** Duplicate LU/cache-key bodies gone. Circuit 502 / 1400. Bundle main 348.9 KiB / total 603.8 KiB (hard pass, target warn). Interaction method maps still one prototype to trace.
- **兼容性代价 5.2:** Hot path no longer instantiates V1. Soak still keeps the kernel, wrap restoreStandby, and `applyViewMapToComponents`.

## Explicit >8.0 judgment

**综合 8.2 is > 8.0.** This does not delete V1. Remaining debt is KD20 dual kernel (lazy), Interaction shared prototype, and leftover live-field fallbacks.
