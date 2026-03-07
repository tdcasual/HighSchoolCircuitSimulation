# Mobile Core Learning KPI Follow-up

Date: 2026-03-07
Scope: Task KPI upgrade for the primary phone learning path

## Goal

Add a dedicated mobile E2E flow that measures the teaching-critical path:

1. `place-power-source`
2. `place-resistor`
3. `wire-series-loop`
4. `run-simulation`
5. `observe-readout`

This KPI complements the existing synthetic regression baseline and prevents mobile quality from being represented only by CSS checks or aggregate tap counts.

## Implementation Summary

- Added dedicated script: `scripts/e2e/mobile-core-learning-flow.mjs`
- Extended `MobileFlowMetrics` with a `taskKpi` tier:
  - `averageInteractionCount`
  - `completionRate`
  - `observationRate`
  - `stepCompletionRate`
- Kept existing tiers intact:
  - `synthetic`
  - `behavior`
- Added contract and unit coverage:
  - `tests/e2e.mobileCoreLearningContract.spec.js`
  - `tests/mobileFlowMetrics.spec.js`
  - `tests/mobileFlowMetrics.validity.spec.js`

## Verification Evidence

Executed on 2026-03-07:

```bash
npm test -- tests/e2e.mobileCoreLearningContract.spec.js tests/mobileFlowMetrics.spec.js tests/mobileFlowMetrics.validity.spec.js
node scripts/e2e/mobile-core-learning-flow.mjs
```

Result:
- Task KPI tests passed.
- Dedicated phone learning flow completed successfully.
- Output report generated:
  - `output/e2e/mobile-core-learning/mobile-core-learning-kpi.json`

## Latest KPI Snapshot

From `output/e2e/mobile-core-learning/mobile-core-learning-kpi.json`:

- `interactionCount`: `7`
- `durationMs`: `244`
- `completionRate`: `1`
- `observationRate`: `1`
- `stepCompletionRate`: `1`
- Readouts observed:
  - current: `0.1194 A`
  - voltage: `11.9403 V`
  - power: `1.4257 W`

## Outcome

Mobile audit coverage now distinguishes two separate questions:

1. Can the scripted flow run efficiently?
2. Can the learner actually finish the core learning task and see a valid electrical observation?

This closes the audit gap where responsive mobile quality could look healthy while the primary teaching loop was not directly measured.
