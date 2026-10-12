# Live-system scorecard A — shared stamps/nodes + ViewMap remainder — 2026-10-12

- Auditor: implementer (Grok)
- Tree: working tree on `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`.
- Includes: Circuit façade; mixin method-map install; ViewMap classroom+AI readers; V2 skip V1 prepare; **shared stamp table + junction + union-find**.
- Parent: `2026-10-12-live-system-scorecard-a-r2.md` (综合 **7.6**).
- Policy: record the live object graph. Do not invent 8.1. V1 kernel remains (KD20).

## Scores

| 维度 | R2+ViewMap | **shared stamps/nodes** |
|---|---:|---:|
| 架构整洁度 | 7.8 | **8.1** |
| 健壮性 | 7.8 | **8.0** |
| 解耦程度 | 7.6 | **7.8** |
| 可扩展性 | 6.6 | **8.3** |
| 可维护性 | 8.1 | **8.3** |
| 兼容性代价（越低越好） | 6.0 | **5.5** |
| **综合** | **7.6** | **8.1** |

综合 = (8.1+8.0+7.8+8.3+8.3)/5 = 8.10 → **8.1**

## Live evidence

- `Circuit.js` **491** lines. `Object.assign(InteractionManagerClass.prototype` **0**.
- `DefaultComponentRegistry.get('Resistor') === DefaultStampRegistryV2.get('Resistor') === DefaultStampHandlers.get('Resistor')`. New types go in `src/utils/registerDefaultStamps.js` only.
- `JunctionModel.js` / `JunctionModelV2.js` re-export `src/utils/JunctionModel.js`.
- `NodeBuilder` / `NodeBuilderV2` call `buildElectricalNodes`. Live wrapper still writes `wire.nodeIndex`; V2 wrapper snaps canvas points. Live SOT remains production NodeBuilder.
- V2 hot path still skips `setCircuit`. Fallback still restoreStandby → V1. `Circuit` still `new MNASolver()`.
- `resolveComponentViewRecord` lives in utils. MeasurementReadout, PropertyPanel, ObservationSources (I/U/P and electric field), ObservationExport, CircuitExplainer prefer it, including true zero.
- Adapter still copies I/V/P for leftover live-field visuals / V1.

## Dimension judgments

- **架构整洁度 8.1:** Façade + single stamp/junction/union-find source. Dual kernel (injected V2 + constructed V1 fallback) still exists; Interaction is still one prototype.
- **健壮性 8.0:** Same-substep fallback unchanged. True-zero ViewMap now covers explainer and electric-field observation.
- **解耦程度 7.8:** Catalog stamps are no longer forked. Named readers including AI prefer ViewMap. Adapter copies and shared Interaction `this` remain.
- **可扩展性 8.3:** A new component stamp is one table, both kernels pick it up. Dual matrix/solve implementations remain for fallback; they are no longer a dual catalog.
- **可维护性 8.3:** Duplicate 582/594 stamp files and 219/224 node builders collapsed. Circuit 491; 19 mixin aggregators already gone.
- **兼容性代价 5.5:** Soak bridges remain; dual-write of stamp bodies is gone.

## Explicit >8.0 judgment

**综合 8.1 is > 8.0.** This does not delete V1. Remaining debt is KD20 dual kernel, adapter copies, and Interaction shared prototype.
