# Day 17 Observation Audit - Linked Cursor Across Plots

Date: 2026-03-18
Scope: Week 3 Day 17 (synchronized crosshair readout)

## Goal

Implement linked cursor behavior so touching/hovering one plot synchronizes crosshair readout across other active plot cards.

## Implementation Summary

1. Linked cursor snapshot model
- `src/ui/observation/ObservationChartInteraction.js`
- Added shared snapshot helpers:
  - `toLinkedSnapshot(bounds)`
  - `resolvePointFromLinkedSnapshot(snapshot, bounds)`
- Ensures cross-plot cursor projection can be normalized by ratio and clamped.

2. Cross-plot synchronization in panel
- `src/ui/ObservationPanel.js`
- Added panel-level linked cursor state: `linkedCursorSnapshot`.
- Added pointer-flow synchronization:
  - `syncLinkedCursorSnapshot(plot)` on pointer down/move/up/leave.
- Added linked overlay resolution:
  - `resolveLinkedOverlayPoint(plot, frame, dpr)`
  - `findNearestPlotSampleByX(plot, targetX)`
- Overlay behavior:
  - source plot shows local cursor,
  - other plots show linked cursor projected by shared x ratio,
  - y uses nearest sample by target x when available,
  - chip text distinguishes `游标` / `联动游标` / `联动冻结`.
- Added cleanup when source plot is deleted or plot list resets.

3. Rendering integration
- `src/ui/ObservationPanel.js`
- Plot frame is cached as `_lastFrame` for accurate inner-plot coordinate mapping.
- Interaction overlay now uses data-domain readout (`x`,`y`) rather than raw pixel offsets.

## Test Coverage

1. `tests/observationChartInteraction.spec.js`
- Added linked snapshot round-trip test across different canvas sizes.
- Added ratio clamp test for out-of-range snapshot values.

## Verification Evidence

1. `npm test -- tests/observationChartInteraction.spec.js tests/observationPlotCardController.spec.js`
- Result: pass
- Test files: 2 passed
- Tests: 4 passed

2. Observation regression subset
- `npm test -- tests/observationPanel.uxMode.spec.js tests/observationPanel.quickBind.spec.js tests/observationPanel.mobileUx.spec.js tests/observationPanel.renderLifecycle.spec.js tests/observationPanel.sampleCache.spec.js tests/observationPanel.presetFactory.spec.js tests/observationChartInteraction.spec.js tests/observationState.spec.js`
- Result: pass
- Test files: 8 passed
- Tests: 30 passed

## Outcome

- Cursor interaction now supports multi-plot linked readout behavior.
- Linked overlay is resilient to varying plot sizes and coordinate ranges.
