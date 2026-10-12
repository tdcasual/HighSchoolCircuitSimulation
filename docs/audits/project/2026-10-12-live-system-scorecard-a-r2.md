# Live-system scorecard A — R2 façade + ViewMap readers — 2026-10-12

- Auditor: implementer (Grok)
- Tree: working tree on `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`.
- Includes: Circuit façade into existing services; 33 `Object.assign(prototype)` retired to one method-map install; remaining classroom readers prefer ViewMap; V2 hot path does not stamp V1.
- Parent: `2026-10-12-live-system-scorecard-a-rescore.md` (综合 **6.2** after C1+C2).
- Policy: record the live object graph. Do not invent 8.1. V1 kernel remains (KD20).

## Scores

| 维度 | C1+C2 | **R2+ViewMap** |
|---|---:|---:|
| 架构整洁度 | 6.2 | **7.8** |
| 健壮性 | 7.6 | **7.8** |
| 解耦程度 | 5.6 | **7.6** |
| 可扩展性 | 5.5 | **6.6** |
| 可维护性 | 6.3 | **8.1** |
| 兼容性代价（越低越好） | 6.0 | **6.0** |
| **综合** | **6.2** | **7.6** |

综合 = (7.8+7.8+7.6+6.6+8.1)/5 = 7.58 → **7.6**

## Live evidence

- `Circuit.js` **491** lines; topology/sim lifecycle lives in existing `CircuitTopologyService` / `CircuitSimulationLoopService`.
- `Object.assign(InteractionManagerClass.prototype` in `src/ui/interaction`: **0**. Production install: one `installInteractionMethodMaps`.
- V2 `runStep` / `prepareSimulation` do not call `ensureSolverPrepared` / `solver.setCircuit`. Dirty flag is cleared so diagnostics do not rebuild topology every tick. Fallback still `setCircuit` after restoreStandby.
- `resolveComponentViewRecord` is the shared ViewMap overlay. MeasurementReadout, PropertyPanel, ObservationSources, ObservationExportService prefer it. Adapter still copies live fields for AI/V1.
- Dual node SOT and V1 `new MNASolver()` remain.

## Dimension judgments

- **架构整洁度 7.8:** Façade + V2-default path that does not stamp V1. Dual kernel still exists as injected fallback; dual NodeBuilder remains.
- **健壮性 7.8:** Same-substep fallback unchanged; ViewMap true-zero covered on readout and observation tests.
- **解耦程度 7.6:** Named classroom readers prefer ViewMap. Adapter and AI still read live fields; V1/V2 standby transfer remains.
- **可扩展性 6.6:** New stamps still need both kernels. V2 hot path no longer requires a V1 netlist rebuild.
- **可维护性 8.1:** Circuit 491; 19 installer aggregators gone; one compose file.
- **兼容性代价 6.0:** Unchanged soak bridges.

## Explicit >8.0 judgment

**综合 7.6 is not > 8.0.** Remaining gap is dual live kernels (KD20), dual node SOT, and leftover live-field consumers (AI). This score does not invent 8.1.
