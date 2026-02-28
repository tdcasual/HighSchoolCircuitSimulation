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
  }
}
```

Backward-compatibility fields (`averageTapCount`, `successRate`, `maxTapCount`, `totalDurationMs`) remain at top level for existing consumers.

## Verification

Executed:

```bash
npm test -- tests/mobileFlowMetrics.validity.spec.js tests/mobileFlowMetrics.spec.js
npm run test:e2e:responsive
```

Result:

- Validity tier tests passed.
- Existing metrics tests passed.
- Responsive touch E2E passed and generated updated baseline artifact.
