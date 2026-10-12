# Live System Scorecard B — post-fix independent rescore — 2026-10-12

Measured live tree: `49f0289d693cef5a4034e00e1dc895188f8c744d` plus the working-tree C1/C2 fixes. Scope is the running classroom object graph, using the same §11 dimensions and arithmetic as the prior scorecard. This is record-only; no production, test, script, package, or closed Top30 file was edited.

## Scores

All dimensions use a 10-point scale. Compatibility cost is reported separately and is lower-is-better.

| Dimension | Prior B | Post-fix B |
|---|---:|---:|
| 架构整洁度 | 6.2 | 6.3 |
| 健壮性 | 8.0 | 8.1 |
| 解耦程度 | 6.0 | 6.5 |
| 可扩展性 | 6.4 | 6.4 |
| 可维护性 | 6.5 | 6.6 |
| 兼容性代价 | 7.0 | 7.0 |
| 综合 | 6.62 | 6.78 |

综合 = (6.3 + 8.1 + 6.5 + 6.4 + 6.6) / 5 = **6.78**. Compatibility cost is excluded from this mean.

## Live evidence

The classroom default remains V2 through `bootstrapV2` and `createInjectedSolverBackend` (`DEFAULT_SOLVER_BACKEND_MODE = 'v2'`). `CircuitSimulationLoopService` still performs same-substep V1 fallback after standby restore, then commits the fallback state back into the V2 standby model. Explicit V1, shadow, and usable embed-without-`solver=` paths remain. The V1 kernel is therefore still a live compatibility path.

The C1 documentation fix is material evidence quality: `2026-10-12-next-issues.md` and the project audit README now describe default-on V2, wire-aware V2 topology, P0 extensions, the fallback contract, and the remaining Circuit/mixin/ViewMap debt. This corrects the previous stale operational guidance but does not change the object graph.

The C2 production fix closes the specific Renderer wiring gap. `RuntimeUiBridge.onCircuitUpdate` calls `Renderer.setViewMap(results.viewMap)` only for valid V2 results with a `Map`, and passes `null` for V1, invalid/malformed results, stop, clear, load, and silent load. Renderer value snapshots therefore prefer the solver ViewMap, including true zero readings, on the normal V2 classroom update path. This supports the robustness +0.1 and decoupling +0.5 scores.

Purity is still incomplete. `ComponentViewAdapter` continues to copy current, voltage, power, and dynamic fields onto live components. `MeasurementReadoutController`, `PropertyPanelController`, `ObservationSources`, and `ObservationExportService` still read those live fields. Renderer has a ViewMap fallback when an id has no ViewMap record. The adapter and projection bridge remain necessary for those consumers, so this is a partial decoupling improvement rather than a completed ViewMap boundary.

The primary architecture debt is unchanged: `Circuit.js` is 1078 lines and still owns live components, topology, persistence, diagnostics, projection, stepping, and the V1 `MNASolver`; `src/ui/interaction` still has 33 `Object.assign(InteractionManagerClass.prototype, ...)` sites. V2 has useful injected topology/solve coordinators, but the running system still has two topology builders, two solver implementations, and explicit state transfer between them. `SolveCircuitV2.js` is 516 lines; the prior stale 668-line claim is not current.

The refreshed issue document records P0 extensions as done (six additional motor, AC, diode, and switch scenarios), so no new extensibility credit is assigned: registry/type dispatch and dynamic-state transfer remain split across V1, V2, Circuit projection, and UI readers. The documentation refresh slightly improves maintenance evidence, but does not remove the large façade or mixin change-analysis cost.

## Dimension judgments

- **架构整洁度 6.3:** real injected default-V2 seam and corrected topology/runtime documentation; the live `Circuit` god object, V1 standby, and 33 mixins remain.
- **健壮性 8.1:** fallback and standby recovery are explicit, and ViewMap is now cleared on invalid/fallback/reset paths rather than leaving stale Renderer data. This is not browser-wide or full-fault certification.
- **解耦程度 6.5:** Renderer now reads the isolated V2 ViewMap on production updates; four other shipped read paths and the adapter still depend on mutable component fields.
- **可扩展性 6.4:** V2 coordinators and registries are useful seams; new dynamic components still require both kernel/state-transfer and live projection/UI handling.
- **可维护性 6.6:** stale architecture guidance is corrected and the ViewMap contract is explicit/tested; 1078-line Circuit, 33 mixin patches, dual kernels, and residual live-field readers still raise change-analysis cost.
- **兼容性代价 7.0:** unchanged. V1, shadow, fallback, embed-v1, standby snapshots, and the adapter are deliberate compatibility bridges, but keep two kernels and state representations relevant.

## Explicit >8.0 judgment

**综合 > 8.0 is still not honest.** The two slim fixes improve the production UI boundary and audit accuracy, but they do not resolve the live `Circuit`/mixin/kernel boundary debt. A score above 8 would require treating the V2 directory and default flag as architectural completion, which the running object graph does not support. The true post-fix composite is **6.78**, not 8.1.

## Validation

Read-only inspection confirmed the stated source paths, dimensions, line counts, 33 mixin assignments, V2 default, fallback path, ViewMap attach/clear behavior, and remaining live-field readers. The focused RuntimeUiBridge tests added with C2 cover valid V2 attachment and V1/fallback/stop/clear/load clearing. A hand-built probe using an incomplete Renderer mock failed inside `Renderer.updateWireAnimations` because the mock lacked `wireElements`; this was a harness setup error, not evidence of a product failure. No full browser/E2E or full npm suite was run for this record-only rescore.
