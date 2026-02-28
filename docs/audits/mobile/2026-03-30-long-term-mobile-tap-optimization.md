# Long-Term Optimization - Mobile Tap Reduction (Probe Workflow)

Date: 2026-03-30
Scope: post-RC long-term UX optimization (touch operation efficiency)

## Goal

Reduce mobile measurement workflow tap cost without lowering success rate.

## Changes

1. Added one-tap probe + chart behavior for quick wire actions
- `src/ui/interaction/QuickActionBarController.js`
- Wire quick actions (`电压探针` / `电流探针`) now call:
  - `addObservationProbeForWire(..., { autoAddPlot: true })`

2. Extended probe action API with optional auto-plot
- `src/ui/interaction/ProbeActions.js`
- `addObservationProbeForWire(wireId, probeType, options)` now supports:
  - `options.autoAddPlot`
- When enabled, a newly created probe is immediately added to observation plots.
- Returns created probe id for follow-up automation.

3. Updated tail delegate signature for option passthrough
- `src/ui/interaction/InteractionTailProbeDelegates.js`

4. Updated responsive-touch baseline collector
- `scripts/e2e/responsive-touch-regression.mjs`
- Probe task now validates auto-plot in one action and records reduced tap count.
- Also sets first-run guide dismissed flag in E2E init storage to avoid overlay interference.

## Test & Verification

1. Unit tests
- `npm test -- tests/interaction.probeActions.spec.js tests/quickActionBarController.spec.js tests/interaction.tailDelegatesInstaller.spec.js`
- Result: pass

2. Responsive touch regression
- `npm run test:e2e:responsive`
- Result: pass

3. Lint
- `npm run lint`
- Result: pass

## Metric Delta (from mobile-flow-baseline artifact)

- Before:
  - `probe-measurement`: 8 taps
  - average tap count: 7.67
- After:
  - `probe-measurement`: 7 taps
  - average tap count: 7.33

Delta:
- Probe workflow: **-12.5%** taps
- Overall three-task average: **-4.4%** taps

## Notes

- This is an incremental optimization; Week2 target (`-20%` overall) is still not met.
- Next high-impact direction should focus on `parallel-build` (currently still 9 taps).
