# P0 Baseline Benchmark

- generatedAt: 2026-02-06T12:09:24.153Z
- node: v25.5.0
- platform: darwin arm64

## Scenario Metrics

| Scenario | Components | Wires | Nodes | Import avg ms | Rebuild avg ms | Solve avg ms | Step avg ms | Solve invalid rate | Step invalid rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| series_20 | 21 | 21 | 21 | 0.1866 | 0.0924 | 0.0179 | 0.1010 | 0.00% | 0.00% |
| series_60 | 61 | 61 | 61 | 0.2970 | 0.1964 | 0.1469 | 0.1490 | 0.00% | 0.00% |
| series_120 | 121 | 121 | 121 | 0.5677 | 0.3763 | 0.9384 | 1.0292 | 0.00% | 0.00% |

## Adversarial

| Scenario | Iterations | Invalid rate | Solve avg ms |
|---|---:|---:|---:|
| conflicting_ideal_sources | 120 | 100.00% | 0.0077 |

## Summary

- normalScenarioMaxStepAvgMs: 1.0292
- normalScenarioMaxSolveAvgMs: 0.9384
- normalScenarioMaxInvalidRate: 0.00%
- adversarialInvalidRate: 100.00%
