# P0 Baseline Benchmark

- generatedAt: 2026-02-06T13:14:36.381Z
- node: v25.5.0
- platform: darwin arm64

## Scenario Metrics

| Scenario | Components | Wires | Nodes | Import avg ms | Rebuild avg ms | Solve avg ms | Step avg ms | Solve invalid rate | Step invalid rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| series_20 | 21 | 21 | 21 | 0.1965 | 0.0989 | 0.0298 | 0.0285 | 0.00% | 0.00% |
| series_60 | 61 | 61 | 61 | 0.4359 | 0.2618 | 0.1018 | 0.0701 | 0.00% | 0.00% |
| series_120 | 121 | 121 | 121 | 0.7075 | 0.4224 | 0.1699 | 0.1341 | 0.00% | 0.00% |

## Adversarial

| Scenario | Iterations | Invalid rate | Solve avg ms |
|---|---:|---:|---:|
| conflicting_ideal_sources | 120 | 100.00% | 0.0052 |

## Summary

- normalScenarioMaxStepAvgMs: 0.1341
- normalScenarioMaxSolveAvgMs: 0.1699
- normalScenarioMaxInvalidRate: 0.00%
- adversarialInvalidRate: 100.00%
