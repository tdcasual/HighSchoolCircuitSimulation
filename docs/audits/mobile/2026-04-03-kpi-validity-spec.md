# Mobile KPI Validity Spec (2026-04-03)

## Goal

Separate engineering synthetic execution metrics from behavior-oriented usability metrics, so responsive E2E outputs do not overstate user experience quality.

## KPI Tier Definitions

### Synthetic Tier

Synthetic KPIs describe scripted execution efficiency under controlled automation:

- `averageTapCount`: mean taps per canonical task
- `successRate`: proportion of tasks marked successful
- `maxTapCount`: worst-case tap count across tasks
- `totalDurationMs`: total scripted execution duration

### Behavior Tier

Behavior KPIs describe user-facing quality signals independent from script success counts:

- `medianDurationMs`: p50 completion time across tasks (nearest-rank percentile)
- `p90DurationMs`: p90 completion time across tasks (nearest-rank percentile)
- `destructiveCancelRate`: ratio of tasks marked `destructiveCancel=true`

### Task KPI Tier

Task KPIs describe whether a teaching-critical flow was actually finished and observed:

- `averageInteractionCount`: mean interaction count per measured task
- `completionRate`: proportion of tasks that completed all required steps successfully
- `observationRate`: proportion of tasks that reached a confirmed observation step
- `stepCompletionRate`: ratio of completed required steps across all measured tasks

## Data Contract

`summary` from `summarizeMobileFlowMetrics(report)` now returns:

```json
{
  "synthetic": {
    "averageTapCount": 0,
    "successRate": 0,
    "maxTapCount": 0,
    "totalDurationMs": 0
  },
  "behavior": {
    "medianDurationMs": 0,
    "p90DurationMs": 0,
    "destructiveCancelRate": 0
  },
  "taskKpi": {
    "averageInteractionCount": 0,
    "completionRate": 0,
    "observationRate": 0,
    "stepCompletionRate": 0
  }
}
```

Backward-compatibility fields (`averageTapCount`, `successRate`, `maxTapCount`, `totalDurationMs`) remain at top level for existing consumers.

## Verification

Executed:

```bash
npm test -- tests/mobileFlowMetrics.validity.spec.js tests/mobileFlowMetrics.spec.js tests/e2e.mobileCoreLearningContract.spec.js
node scripts/e2e/mobile-core-learning-flow.mjs
npm run test:e2e:responsive
```

Result:

- Validity tier tests passed.
- Existing metrics tests passed.
- Core learning KPI flow passed and generated a dedicated KPI report.
- Responsive touch E2E remained available for synthetic baseline output.
