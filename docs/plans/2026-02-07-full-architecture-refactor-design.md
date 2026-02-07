# Full Architecture Refactor Design (Freeze Mode)

Date: 2026-02-07  
Project: `HighSchoolCircuitSimulation`  
Decision: Freeze feature work, execute a full-chain architecture refactor.

## 1. Goal And Boundaries

This refactor is not a feature iteration. The goal is to reduce structural coupling and future change cost while keeping behavior equivalent.

Current pressure points:

- `src/engine/Circuit.js` is oversized and mixes topology, runtime, diagnostics, and serialization.
- `src/engine/Solver.js` combines matrix stamping, dynamic integration, and result post-processing.
- `src/ui/AIPanel.js` combines chat, settings, layout interactions, logging, and persistence.

Refactor scope:

- Keep existing user-visible behavior and existing JSON compatibility.
- Keep current public APIs initially via facade/adapters.
- Reorganize internal responsibilities into clear module boundaries.

Out of scope:

- New user features.
- Physics model changes.
- UX redesign.

## 2. Target Architecture

Adopt five-layer structure:

1. `ui` layer  
   Handles user events and rendering state only.

2. `app` coordination layer  
   Orchestrates workflows between UI and domain services.

3. `core/topology`  
   Node rebuild, connectivity mapping, wire compaction, topology diagnostics.

4. `core/simulation`  
   MNA stamping, dynamic integration, solve pipeline, current/voltage post-processing.

5. `core/io`  
   JSON schema validation, import/export compatibility migration.

Key rule: upper layer depends only on lower layer abstractions, never on concrete internals.

## 3. Execution Plan (2-Week Freeze)

### Phase 0 (0.5 day): Baseline Freeze

- Tag current `main`.
- Record full test baseline and regression outputs.
- Enforce “refactor-only” PR scope.

DoD: full test suite green and baseline snapshot archived.

### Phase 1 (2 days): AIPanel Split

Split `src/ui/AIPanel.js` into:

- `src/ui/ai/ChatController.js`
- `src/ui/ai/SettingsController.js`
- `src/ui/ai/PanelLayoutController.js`

Keep `AIPanel` as composition facade. Move logic first, keep signatures stable.

DoD: all `aiPanel.*` tests pass without behavior drift.

### Phase 2 (3 days): Circuit Topology Split

Extract from `src/engine/Circuit.js`:

- `src/core/topology/NodeBuilder.js`
- `src/core/topology/WireCompactor.js`
- `src/core/topology/ConnectivityCache.js`

`Circuit` becomes a thin delegation shell for these internals.

DoD: `circuit.*`, `wire*`, `endpoint*` tests all green.

### Phase 3 (3 days): Solver Pipeline Split

Extract from `src/engine/Solver.js`:

- `src/core/simulation/StampDispatcher.js`
- `src/core/simulation/DynamicIntegrator.js`
- `src/core/simulation/ResultPostprocessor.js`

Keep solver input/output contract stable to avoid ripple.

DoD: `solver.*` and `currentDirection.*` tests all green.

### Phase 4 (1.5 days): IO Consolidation

- Consolidate schema validation, load/save migration, and compatibility utilities into `core/io`.
- Remove duplicated conversion/validation paths.

DoD: schema/import-export related tests green and no public API break.

## 4. Data Flow And Error Model

Data flow:

- UI controllers -> App coordinator -> Circuit facade -> Topology/Simulation services -> DTO result back to UI.

Error model:

- `TOPO_*`: topology/connectivity errors.
- `SIM_*`: matrix/integration/solve errors.
- `IO_*`: serialization/schema/migration errors.

Recovery policy:

- Topology error: reject operation and keep previous valid topology.
- Simulation error: keep last valid result instead of clearing all display.
- IO error: preserve raw payload for exportable diagnostics.

Logging:

- Keep per-layer logs with a shared `traceId` for end-to-end tracing.

## 5. Verification Gates

Every phase requires:

- Full `npm test` green.
- Phase-focused suite green.
- No facade API regression.
- Added/updated tests for migrated modules.

Phase-focused suites:

- Phase 1: `aiPanel.*`
- Phase 2: `circuit.*`, `wire*`, `endpoint*`
- Phase 3: `solver.*`, `currentDirection.*`
- Phase 4: `circuitSchema.*` + load/save compatibility tests

## 6. Risks And Controls

Primary risks:

- Hidden coupling in large files.
- Accidental behavior drift during method migration.
- Over-scoping due to “while touching” refactors.

Controls:

- Migrate in small commits with strict phase boundaries.
- Keep adapter facades until final cleanup.
- Require green tests before moving to next phase.
- Enforce YAGNI: no opportunistic feature changes during freeze.

## 7. Ready Criteria For Implementation

Implementation can start when:

- Team confirms freeze scope.
- Phase owners are assigned.
- Baseline tag and CI gates are in place.

Next step after this design: produce an executable task checklist per phase (file-level tasks, owners, and expected verification command set).
