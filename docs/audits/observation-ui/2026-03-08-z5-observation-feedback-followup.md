# Z5 Observation / Feedback Follow-up

- Date: 2026-03-08
- Area: `Z5`
- Scope: `PRJ-024`, `PRJ-025`
- Status: `covered`

## Closed Items

### PRJ-024
- Outcome: 手机端图表读数改为“按下可读、长按才冻结、释放即清 transient、冻结后保持锚定”，并补上 `pointercancel` 链路，桌面/手机的核心观测能力口径重新对齐。
- Root Cause: 图表交互最初沿用偏 hover 的读数语义，touch release / interrupt 后缺少显式收尾，导致手机端容易留下非预期 readout 或冻结点漂移。
- Fix Location:
  - `src/ui/observation/ObservationChartInteraction.js`
  - `src/ui/observation/ObservationInteractionController.js`
- Evidence:
  - `tests/observationChartInteraction.spec.js`
  - `tests/e2e.observationTouchContract.spec.js`

### PRJ-025
- Outcome: fatal diagnostics 即使没有单独 hint，也会进入 near-field action 区，不再只落到状态栏或 chart status；summary-only 错误现在同样可见、可回看。
- Root Cause: 近场反馈此前依赖“存在 primary hint”这一附加条件，导致只有 summary 的错误在本地操作区缺少承接。
- Fix Location:
  - `src/app/RuntimeUiBridge.js`
  - `src/app/AppRuntimeV2.js`
- Evidence:
  - `tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js`
  - `tests/runtimeUiBridge.spec.js`

## Verification

- `npm test -- tests/observationChartInteraction.spec.js tests/e2e.observationTouchContract.spec.js tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js`
