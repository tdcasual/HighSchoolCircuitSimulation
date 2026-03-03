# Tech Debt Dashboard

Generated at: 2026-03-03T06:36:57.228Z

## Headline

- Fail: 0
- Warn: 1
- OK: 7

## V2 Breaking Refactor Snapshot (Manual, 2026-03-03)

- Track: no-compatibility v2 refactor (`codex/v2-breaking-refactor`)
- Latest matrix result: `check`, `check:e2e`, `baseline:p0`, `baseline:circuitjs`, `baseline:ai` all PASS
- v2 strict guards: `check:v2:boundaries` and `check:v2:runtime-safety` PASS
- Scorecard lock: overall `9.4`, compatibility cost `1.4` (threshold met)
- Evidence report: `docs/reports/2026-03-03-v2-breaking-refactor-final-report.md`

## Runtime Safety Duplication

- Local `safeInvokeMethod` count: 15/15 (ok)
- Files:
  - src/app/AppSerialization.js: 1
  - src/ui/FirstRunGuideController.js: 1
  - src/ui/Renderer.js: 1
  - src/ui/ai/PanelLayoutController.js: 1
  - src/ui/ai/SettingsController.js: 1
  - src/ui/interaction/AlignmentGuideController.js: 1
  - src/ui/interaction/ContextMenuController.js: 1
  - src/ui/interaction/DragBehaviors.js: 1
  - src/ui/interaction/MeasurementReadoutController.js: 1
  - src/ui/interaction/PropertyDialogController.js: 1
  - src/ui/interaction/PropertyPanelController.js: 1
  - src/ui/interaction/QuickActionBarController.js: 1
  - src/ui/interaction/SelectionPanelController.js: 1
  - src/ui/interaction/ToolboxBindingsController.js: 1
  - src/ui/observation/ObservationExportService.js: 1

## V2 Runtime Safety Dedupe

- v2 local `safeInvokeMethod` count: 0/0 (ok)

## Core File Budgets

| File | Lines | Budget | Status |
|---|---:|---:|---|
| src/engine/Circuit.js | 1859 | 2000 | ok |
| src/components/Component.js | 1617 | 1700 | warn |
| src/ui/charts/ChartWindowController.js | 600 | 700 | ok |
| src/app/interaction/InteractionOrchestrator.js | 189 | 400 | ok |

## Bundle Budget

- Main bundle: 381.2 KiB / 400.0 KiB (ok)
- Total JS output: 503.4 KiB / 520.0 KiB (ok)

## Legacy Observation Contract

- observationPanel references in src + scripts/e2e: 0 (ok)
