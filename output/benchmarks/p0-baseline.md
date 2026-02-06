# P0 Baseline Benchmark

- generatedAt: 2026-02-06T02:08:29.716Z
- node: v25.5.0
- platform: darwin arm64

## Scenario Metrics

| Scenario | Components | Wires | Nodes | Import avg ms | Rebuild avg ms | Solve avg ms | Step avg ms | Solve invalid rate | Step invalid rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| series_20 | 21 | 21 | 21 | 0.1140 | 0.0653 | 0.0117 | 0.0852 | 0.00% | 0.00% |
| series_60 | 61 | 61 | 61 | 0.2378 | 0.1651 | 0.1295 | 0.1364 | 0.00% | 0.00% |
| series_120 | 121 | 121 | 121 | 0.4574 | 0.3174 | 0.8531 | 0.8625 | 0.00% | 0.00% |

## Adversarial

| Scenario | Iterations | Invalid rate | Solve avg ms |
|---|---:|---:|---:|
| conflicting_ideal_sources | 120 | 100.00% | 0.0024 |

## Summary

- normalScenarioMaxStepAvgMs: 0.8625
- normalScenarioMaxSolveAvgMs: 0.8531
- normalScenarioMaxInvalidRate: 0.00%
- adversarialInvalidRate: 100.00%
