# Live System Scorecard B — independent second audit — 2026-10-12

Measured HEAD: `49f0289d693cef5a4034e00e1dc895188f8c744d` (verified before inspection and before writing).
Branch: `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`.
Scope: running classroom object graph, not directory shape. Record-only: no source, test, script, package or closed Top30 edits. Neither scorecard A was read before these numeric scores were written; neither was needed for this report.

## Scores

All numbers use a 10-point scale; compatibility cost is separate and lower is better.

| Dimension | Score |
|---|---:|
| 架构整洁度 | 6.2 |
| 健壮性 | 8.0 |
| 解耦程度 | 6.0 |
| 可扩展性 | 6.4 |
| 可维护性 | 6.5 |
| 兼容性代价 | 7.0 |
| 综合 | 6.62 |

综合 = (6.2 + 8.0 + 6.0 + 6.4 + 6.5) / 5 = **6.62**. The 2026-10-10 §11 comparator is 5.6 with the same first-five-dimension arithmetic; compatibility cost is not included. These are engineering judgments supported by the evidence below, not inferred from test pass percentages.

## Actual production graph

`src/main.js:5-12 → bootstrapV2.js:33-35 → createInjectedSolverBackend.js:5,194-244 → AppRuntimeV2.js:59-71 → Circuit.step (Circuit.js:844-870) → CircuitSimulationLoopService.runStep (:165-235) → backend.solveFrame → RunSimulationStepV2.js:10-24 → TopologyCoordinatorV2 + SimulationCoordinatorV2 → SolveCircuitV2`.

Classroom factory default is literally `v2`; successful substeps use V2 and failure restores standby, runs V1 at the same substepDt, and seeds V2 from the committed fallback. Circuit still owns live topology, state, persistence, diagnostics and MNASolver standby. Successful classroom V2 output is copied through ComponentViewAdapter to live components; Renderer and other UI consumers use that bridge. This is a real production V2 solver behind an injected port, not a tests-only island and not a completed clean architecture.

Exclusive search `rg SolveCircuitV2|runSimulationStepV2 src/app src/ui src/core src/embed` produced **0 matches**. It establishes identifier/import separation only: bootstrap and factory outside those directories deliberately connect V2 into production.

## Evidence per dimension

- **架构整洁度 6.2:** injected backend at `src/v2/main/bootstrapV2.js:35` and `src/app/AppRuntimeV2.js:60-61` improves the solver boundary. Circuit still constructs MNASolver, topology, projection and persistence collaborators (`src/core/runtime/Circuit.js:39,68-87`) and retains 1078 lines. Interaction installs core/tail delegates (`src/ui/Interaction.js:28-29`); measured **33** prototype `Object.assign` sites under `src/ui/interaction`. Composition root still patches contracts (`src/v2/main/AppCompositionRootV2.js:1-24`).
- **健壮性 8.0:** same-substep dispatch, standby restore, fallback commit and recovery are explicit (`src/core/services/CircuitSimulationLoopService.js:203-235,262-267`; `src/v2/app/createInjectedSolverBackend.js:276-307`). V2 clones DTO and state before solving (`src/v2/simulation/SolveCircuitV2.js:335-339`), returns invalid convergence results (`:497-506`), and shares junction-model behavior rather than the obsolete Ron/Roff-only claim (`src/v2/simulation/StampRegistryV2.js:215-250`). Memory-only verification below passes 26 baseline scenarios and focused classroom wrapper/fallback assertions. This audit does not establish browser-wide reliability or full fault coverage.
- **解耦程度 6.0:** DTO/state cloning and injected solveFrame separate the primary solve from live component mutation. But `src/app/simulation/ComponentViewAdapter.js:19-30,48-52` writes both display and dynamic fields to live objects. `src/core/runtime/Circuit.js:187-198` always prepares V1 with live arrays, and `:763-788` writes state back. Renderer ViewMap support exists (`src/ui/Renderer.js:77-79,313-330`) but **no production setViewMap call and no lastViewMap writer** exist in `src`; `RuntimeUiBridge.js:99` only calls updateValues. UI purity is unfinished.
- **可扩展性 6.4:** V1 registry injection (`src/core/simulation/MNASolver.js:45,337-356`) and V2 topology/solve coordinator injection (`src/v2/app/coordinators/TopologyCoordinatorV2.js:47-52`; `SimulationCoordinatorV2.js:5-10`) are useful extension points. Type dispatch remains in V2 source-index preparation (`src/v2/simulation/SolveCircuitV2.js:121-240`) and live state synchronization (`Circuit.js:767-785`); a new dynamic component must account for both registries, state transfer and UI projection.
- **可维护性 6.5:** measured `wc -l`: Circuit **1078**, MNASolver **485**, SolveCircuitV2 **516**, AppRuntimeV2 **488**, Renderer **722**; total **3289**. Services and focused adapter tests help (`tests/app.componentViewAdapter.spec.js:10-27,29-112` verifies zeros and topology identity), but 33 mixed-in method groups and stale runtime descriptions raise change-analysis cost. The adapter test also requires sunset-comment strings rather than proving production ViewMap wiring.
- **兼容性代价 7.0:** V1 is intentionally retained for explicit v1, default usable embed (`src/embed/EmbedRuntimeOptions.js:148-155`), shadow and fallback. Standby capture/restore/seed spans `src/v2/app/createInjectedSolverBackend.js:33-191,276-297`; the view adapter preserves old UI field consumers. These bridges buy real compatibility but mean two states, two topology builders and two solver implementations remain relevant. This cost is not a recommendation to delete V1.

## Findings and smallest recommendations

| Severity | Location | Evidence / consequence | Smallest fix or wontfix recommendation |
|---|---|---|---|
| Medium | `docs/audits/project/2026-10-12-next-issues.md:5,12,21,34,46-51`; `src/v2/simulation/SolveCircuitV2.js:1-3` | Document says production stays V1 and forbids V2 topology in tick; current bootstrap defaults to V2. Claimed 668-line island is actually 516 lines. Claimed discarded wires are passed at TopologyCoordinatorV2.js:56-62 and normalized to a map at NodeBuilderV2.js:15-31. Claimed semiconductor model fork is obsolete: both registries use junction linearization. Following isolation/removal advice now breaks the production import graph. | Delete/replace obsolete runtime and tests-only statements with the measured graph. Keep exclusive identifier checks described as dependency checks, not proof of a tests-only solver. No new architecture layer or flag. No edits performed here. |
| Medium | `src/ui/Renderer.js:77,313-320`; `src/app/RuntimeUiBridge.js:93-101`; `src/app/simulation/ComponentViewAdapter.js:19-30` | ViewMap API is implemented but unwired in production; Renderer falls back to mutated components. Adapter writes dynamic as well as display fields. Tests manually setting ViewMap do not complete the classroom path. | Wire the existing Renderer setter in the existing update bridge for valid V2 results. Clear it for V1/fallback, reset and document replacement to avoid stale displays. Keep adapter for remaining meter/property/observation consumers until those read paths are migrated; do not prematurely delete state synchronization or introduce another map/flag. |
| High (architecture debt, not a reproduced classroom failure) | `src/core/runtime/Circuit.js:39-87,183-202,763-870`; `src/ui/Interaction.js:28-29` and 33 prototype assignments | Solver switch does not remove live Circuit ownership across topology/IO/state/diagnostics or implicit cross-mixin state. File splitting and V2 names alone do not resolve these responsibilities. | **wontfix in this scope**: no small production change honestly removes this debt. Preserve behavior and defer Circuit/mixin redesign; do not manufacture helpers to raise scores. |
| Medium (maintenance/compatibility debt) | `src/v2/app/createInjectedSolverBackend.js:33-191,276-297`; `src/core/services/CircuitSimulationLoopService.js:183-255` | Parallel solver state plus hand-enumerated transfer keys remain essential on the production path. Future dynamic fields can be omitted from transfer even when an isolated V2 model test passes. | Keep V1 kernel and current bridge. For each actual newly supported dynamic field, amend the existing transfer list and add a focused wrapped mixed-substep regression. **wontfix** wholesale dual-kernel removal; no third state layer or catch-all copying. |
| Low (performance debt, magnitude unmeasured) | `src/v2/app/usecases/RunSimulationStepV2.js:10-15`; `src/v2/simulation/SolveCircuitV2.js:373`; `src/v2/app/createInjectedSolverBackend.js:213-230` | Each substep builds topology/DTO again and factorization cache is local to one solve call. Snapshot reuse across substeps does not imply topology/factorization reuse across frames. No wall-clock regression is claimed. | Measure the existing classroom AC/high-component benchmark first. **wontfix pending evidence**; do not add speculative caches or rewrite kernels. If measurable, reuse the existing coordinator output under its existing topology/parameter invalidation contract. |

The next-issues document **does not match this HEAD**. Its remaining 20 original DC scenarios claim is literally true, but its N10 action is incomplete/stale: six separate extensions already cover motor stall, AC RMS, diode forward/reverse and switch behavior (`scripts/benchmark/p0-electrical-extensions.mjs:42`; baseline scenarioCount 6). Preserve the existing original baseline; do not duplicate that work based on the outdated recommendation.

## Validation and limits

Read-only shell searches, line-numbered inspection and memory-only Node assertions were used. No Vitest cache, baseline reports, build files or other artifacts were generated.

- PASS: factory v2 + wrapped classroom series fixture at one and four substeps, 0.3 A, simTime 0.01, backendUsed v2, no fallback.
- PASS: wrapped RC with forced failure at substep 2 of 4; fallback count 1, consecutive wall-clock fallback count 1, same total dt, resumed V2, finite capacitor history, persistent mode stays v2.
- PASS: adapter copies true zeros and preserves live node-array identity; usable embed without solver= pins v1.
- PASS: all **20 original P0** and **6 P0 extensions** through exported in-memory runners match stored scenarios at absolute 1e-6 plus relative 1e-3 tolerance. No baseline CLI writes were invoked.

An initial probe incorrectly omitted the required usable embed origin and was corrected; it was an audit harness assumption, not an application defect. Importing baseline runners from stdin initially required a harmless process.argv[1] sentinel because their CLI guard expects a path; the corrected imports did not invoke CLI code. The inspected adapter Vitest suite was not run. Full browser/E2E, full npm check and exhaustive kernel parity were not run, so the passing focused checks are not a release certification.

## Explicit >8.0 judgment

**No: 综合 > 8.0 is not honest on this tree without addressing the Circuit/mixin/kernel boundary debt.** Default V2 and pure solve inputs are substantive improvements over the 5.6 comparator, but the classroom object graph still has the large live Circuit, 33 prototype mixin sites, dual-kernel/state compatibility and live UI writeback. Kernel deletion or a broad rewrite is not required or authorized by this audit; counting the V2 directory or passing identifier gate as completion would inflate the score. Current honest composite is **6.62**, not an invented 8.1.
