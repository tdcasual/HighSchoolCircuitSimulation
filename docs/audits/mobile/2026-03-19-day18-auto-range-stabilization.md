# Day 18 Observation Audit - Auto-Range Stabilization Upgrade

Date: 2026-03-19
Scope: Week 3 Day 18 (anti-jitter + hysteresis auto-range)

## Goal

Upgrade observation auto-range strategy to reduce jitter under noisy signals while still expanding quickly on meaningful range growth.

## Implementation Summary

1. Auto-range stabilization primitive
- `src/ui/observation/ObservationMath.js`
- Added `stabilizeAutoRangeWindow(currentRange, previousWindow, options)`.
- Includes:
  - normalization of degenerate ranges,
  - configurable padding ratio,
  - fast-expand behavior near boundaries,
  - deadband + smoothing for shrink hysteresis.

2. Plot frame integration
- `src/ui/ObservationPanel.js`
- `computePlotFrame(...)` now tracks per-plot auto-range window state (`plot._autoRangeWindow`).
- X/Y axes each use independent stabilization parameters.
- Auto-range axes use stabilized windows directly; manual axes keep existing fixed-range padding behavior.

3. Regression tests
- `tests/observationMath.spec.js`
  - added hysteresis/jitter suppression test,
  - added rapid expansion test.
- `tests/observationPanel.renderLifecycle.spec.js`
  - added frame-level test to confirm:
    - small range jitter keeps window stable,
    - large range change triggers expansion.

## Verification Evidence

1. `npm test -- tests/observationMath.spec.js tests/observationPanel.renderLifecycle.spec.js`
- Result: pass
- Test files: 2 passed
- Tests: 13 passed

2. Observation regression subset
- `npm test -- tests/observationState.spec.js tests/observationMath.spec.js tests/observationChartInteraction.spec.js tests/observationPanel.quickBind.spec.js tests/observationPanel.uxMode.spec.js tests/observationPanel.renderLifecycle.spec.js tests/observationPanel.mobileUx.spec.js tests/observationPanel.sampleCache.spec.js tests/observationPanel.presetFactory.spec.js`
- Result: pass
- Test files: 9 passed
- Tests: 40 passed

## Outcome

- Auto-range behavior is significantly less sensitive to small jitter/noise.
- Range expansion remains responsive when signal envelope grows.
