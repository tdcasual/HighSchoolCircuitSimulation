# Day 25 Classroom Audit - Release Candidate Hardening

Date: 2026-03-26
Scope: Week 4 Day 25 (`check:full` hardening, blocker-only fixes)

## Goal

Run full release gate and only fix blockers that prevent release-candidate verification.

## Blockers Found

1. Layer-boundary violations blocked lint gate
- `src/ai/skills/SimulationRefreshSkill.js` imported `core` diagnostics directly (forbidden in `ai` layer).
- `src/core/scenarios/ClassroomScenarioPack.js` imported `engine` (forbidden in `core` layer).

2. Embed packaging regression blocked test gate
- `scripts/build-frontend.mjs` and `scripts/embed-packager.mjs` required `examples/` as mandatory input.
- Repository currently has no `examples/` directory, causing `tests/embedPackaging.spec.js` to fail.

## Fixes Applied

1. Resolved AI-layer boundary violation
- `src/ai/skills/SimulationRefreshSkill.js`
- Removed direct `core` import.
- Runtime diagnostics now attached via circuit-side APIs (`attachRuntimeDiagnostics` / `collectRuntimeDiagnostics`) when available.

2. Consolidated runtime diagnostics attachment in engine
- `src/engine/Circuit.js`
- Added:
  - `collectRuntimeDiagnostics(results, simTime)`
  - `attachRuntimeDiagnostics(results, simTime)`
- `step()` now reuses this unified path.

3. Removed cross-layer dependency in classroom scenario pack
- Moved scenario pack implementation to `src/engine/scenarios/ClassroomScenarioPack.js`.
- Reworked builder to generate serializable scenario data without direct `engine -> components` dependency.
- Updated imports in:
  - `tests/circuit.io.spec.js`
  - `tests/circuitSchema.spec.js`

4. Made embed examples directory optional in packaging scripts
- `scripts/build-frontend.mjs`
- `scripts/embed-packager.mjs`
- `examples/` is now copied only if present; required core assets remain strict.

5. Added/updated regression coverage
- `tests/simulationRefreshSkill.spec.js`
  - Verifies diagnostics attachment path for invalid solve results.

## Verification Evidence

1. Targeted regression set
- `npm test -- tests/knowledgeResourceProvider.spec.js tests/circuitAIAgent.spec.js tests/knowledgeRetrievalSkill.spec.js tests/simulationRefreshSkill.spec.js tests/mcpKnowledgeResourceProvider.spec.js tests/circuit.io.spec.js tests/circuitSchema.spec.js`
- Result: pass
- Test files: 7 passed
- Tests: 31 passed

2. Embed packaging regression
- `npm test -- tests/embedPackaging.spec.js`
- Result: pass
- Test files: 1 passed
- Tests: 2 passed

3. Full release gate
- `npm run check:full`
- Result: pass
- Includes:
  - `npm run check` (lint/format/test)
  - `npm run baseline:p0`
  - `npm run baseline:circuitjs`
  - `npm run baseline:ai`

## Outcome

- Release-candidate hardening gate is green with blocker fixes only.
- Diagnostic pipeline and packaging flow both remain compatible with current repository layout.
