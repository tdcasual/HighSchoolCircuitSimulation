# Z7 Gesture Arbitration Follow-up

- Date: 2026-03-08
- Area: `Z7`
- Scope: `PRJ-018`, `PRJ-029`
- Status: `covered`

## Closed Items

### PRJ-018
- Outcome: 长按、`contextmenu`、pinch 现在都会稳定结束或恢复 pointer session；长按打开菜单后会立即清空 transient pointer tracking，pinch 结束后只恢复显式保留的连线上下文。
- Root Cause: pointer tracking、touch long-press timer、suspended wiring session 分别维护局部状态，缺少统一的 `cancel / suspend / resume` 语义，导致移动端在系统接管手势后容易残留卡死态。
- Fix Location:
  - `src/ui/interaction/PointerSessionManager.js`
  - `src/ui/interaction/TouchActionController.js`
  - `src/app/interaction/InteractionOrchestratorTailHandlers.js`
- Evidence:
  - `tests/interaction.pointerSessionManager.spec.js`
  - `tests/touchActionController.spec.js`
  - `tests/interaction.orchestrator.spec.js`

### PRJ-029
- Outcome: 手机端顶栏更多菜单、侧栏抽屉与画布手势现在按显式 `canvas / drawer / top-action-menu` 仲裁；新 surface 打开时会先关闭竞争 surface，避免互相抢事件。
- Root Cause: 顶栏菜单、抽屉和画布交互此前各自只维护本地开关，没有共享优先级表与接管协议。
- Fix Location:
  - `src/ui/ResponsiveLayoutController.js`
  - `src/ui/TopActionMenuController.js`
  - `src/ui/interaction/PointerSessionManager.js`
- Evidence:
  - `tests/responsiveLayoutController.spec.js`
  - `tests/topActionMenuController.spec.js`
  - `tests/interaction.pointerSessionManager.spec.js`

## Verification

- `npm test -- tests/interaction.pointerSessionManager.spec.js tests/touchActionController.spec.js tests/responsiveLayoutController.spec.js tests/topActionMenuController.spec.js`
