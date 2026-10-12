# Live-system scorecard A — wrap no standby, ViewMap dynamics — 2026-10-13

- Auditor: implementer (Grok)
- Tree: working tree on `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`.
- Includes: R6 (no V2→V1 fallback) plus **wrap no longer restores standby**; ViewMap overlay covers fuse/motor/relay/diode dynamics; invalid V2 feeds adaptive dt; stale tests-only / fallback comments aligned.
- Parent: `2026-10-12-live-system-scorecard-a-r6.md` (综合 **8.4**).
- Policy: record the live object graph. Do not invent a matching second-auditor score. Explicit `mode=v1` / shadow / embed pin still use V1.

## Scores

| 维度 | no V2→V1 fallback | **wrap stop + ViewMap dynamics** |
|---|---:|---:|
| 架构整洁度 | 8.6 | **8.7** |
| 健壮性 | 7.8 | **8.0** |
| 解耦程度 | 8.4 | **8.6** |
| 可扩展性 | 8.4 | **8.4** |
| 可维护性 | 8.6 | **8.7** |
| 兼容性代价（越低越好） | 4.6 | **4.4** |
| **综合** | **8.4** | **8.5** |

综合 = (8.7+8.0+8.6+8.4+8.7)/5 = 8.48 → **8.5**

## Live evidence

- `wrapSolverBackend` only copies `runtimeOptions.solverBackend` / `shadowThrow`. It does not wrap `solveFrame` and does not call `restoreStandby`.
- `resolveComponentViewRecord` overlays I/U/P plus `blown` / `speed` / `conducting` / `energized` / history fields. Missing ViewMap id zeros I/U/P.
- Named readers (Renderer, PropertyPanel, ObservationSources) and `Circuit.getComponentProperties` use that overlay. Live fuse seed stays unblown when ViewMap says blown.
- Invalid V2 substep still `{valid:false, backendUsed:'v2'}` and `break`, and now `noteAdaptive` so enabled adaptive dt shrinks.
- `SolveCircuitV2.js` header and `AGENTS.md` match the injected default-on V2 graph.
- Interaction is still one prototype via `installInteractionMethodMaps`. Explicit v1/shadow/embed pin remain.

## Dimension judgments

- **架构整洁度 8.7:** Classroom default tick is one injected kernel plus a mode wrap. Display SOT is ViewMap.
- **健壮性 8.0:** Adaptive on invalid V2 is back. Same-substep V1 recovery is still gone by design.
- **解耦程度 8.6:** Valid V2 no longer writes live dynamics through wrap. Remaining: Interaction shared `this`; dual NodeBuilder wrappers; explicit V1 modes.
- **可扩展性 8.4:** Shared stamp/LU table unchanged. Type switches in prepare/AI remain.
- **可维护性 8.7:** Wrap is a short mode apply. Comments match the loop.
- **兼容性代价 4.4:** Soak kernel and explicit v1/shadow/embed remain.

## Explicit >8.0 judgment

**综合 8.5 is > 8.0.** Remaining debt is Interaction shared prototype, explicit V1 modes until KD20, and dual NodeBuilder wrappers.
