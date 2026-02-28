# Day 24 Classroom Audit - Error-to-Lesson Mapping

Date: 2026-03-25
Scope: Week 4 Day 24 (runtime diagnostics -> teaching prompts)

## Goal

Connect top runtime failure diagnostics to structured learning prompts that explain:
- what happened,
- why it happened,
- how to fix it.

## Implementation Summary

1. Added diagnostic lesson mapping in local knowledge provider
- `src/ai/resources/KnowledgeResourceProvider.js`
- Added normalized runtime diagnostic context parsing.
- Added deterministic mapping for:
  - `CONFLICTING_SOURCES`
  - `SHORT_CIRCUIT`
  - `SINGULAR_MATRIX`
  - `INVALID_PARAMS`
  - `FLOATING_SUBCIRCUIT`
- For diagnostic categories present in query context, provider now prepends structured lesson copy (`发生了什么 / 为什么会这样 / 如何修复`) before regular knowledge ranking.

2. Passed runtime diagnostics through AI retrieval chain
- `src/ai/skills/KnowledgeRetrievalSkill.js`
- Added `runtimeDiagnostics` passthrough in provider query payload.

3. Updated AI agent to propagate diagnostic context and isolate cache keys
- `src/ai/agent/CircuitAIAgent.js`
- Added extraction of `circuit.lastResults.runtimeDiagnostics`.
- Added diagnostic-aware cache token to avoid stale knowledge reuse across different fault states.
- Passed diagnostic context into `knowledge_retrieve` skill call.

4. Strengthened refresh path to attach diagnostics on invalid solve
- `src/ai/skills/SimulationRefreshSkill.js`
- For invalid results, now builds `runtimeDiagnostics` using topology + short-circuit signals when diagnostics are missing.

5. Added copy tests + snapshot checks
- `tests/knowledgeResourceProvider.spec.js`
  - New test verifies diagnostic lesson prioritization and fixed copy snapshot for short-circuit mapping.
- `tests/circuitAIAgent.spec.js`
  - New test verifies agent forwards runtime diagnostics into knowledge query and system prompt reflects diagnostic copy (inline snapshot).
- `tests/knowledgeRetrievalSkill.spec.js`
  - New passthrough assertion for `runtimeDiagnostics`.
- `tests/simulationRefreshSkill.spec.js`
  - New assertion that invalid solve attaches structured runtime diagnostics.

## Verification Evidence

1. Day24 target verification
- `npm test -- tests/knowledgeResourceProvider.spec.js tests/circuitAIAgent.spec.js`
- Result: pass
- Test files: 2 passed
- Tests: 10 passed

2. Extended regression verification
- `npm test -- tests/knowledgeResourceProvider.spec.js tests/circuitAIAgent.spec.js tests/knowledgeRetrievalSkill.spec.js tests/simulationRefreshSkill.spec.js tests/mcpKnowledgeResourceProvider.spec.js`
- Result: pass
- Test files: 5 passed
- Tests: 18 passed

## Outcome

- Diagnostic-heavy failure states now produce directly teachable prompts instead of generic knowledge only.
- AI response grounding now varies with current fault context and remains cache-safe across fault transitions.
