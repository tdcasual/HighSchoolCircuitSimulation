# Mobile Flow Baseline - Day 8 (2026-03-09 Plan Target)

## Scope

Baseline synthetic tap-cost collection for three canonical phone workflows:

1. `series-build`
2. `parallel-build`
3. `probe-measurement`

Collector output source:
- `output/e2e/responsive-touch/mobile-flow-baseline.json`

## Method

- Environment: Playwright mobile context (`390x844`, touch enabled).
- Script: `scripts/e2e/responsive-touch-regression.mjs`.
- Tap count definition: scripted high-level interaction actions (component add, wire connect, probe action, run/stop).
- Purpose: regression baseline for relative comparison in Week 2, not absolute user-study timing.

## Baseline Results

| Task | Tap Count | Duration (ms) | Success |
|---|---:|---:|---|
| `series-build` | 6 | 15 | true |
| `parallel-build` | 9 | 3 | true |
| `probe-measurement` | 8 | 3 | true |

Summary:
- Average tap count: `7.67`
- Max tap count: `9`
- Success rate: `100%`

## Notes

- Durations are scripted execution times, so they are useful for regression deltas but not human UX latency.
- Week 2 Day 9-12 should focus on reducing tap count and preserving success rate.
