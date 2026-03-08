# Z0 Runtime Source-of-Truth Follow-up

- Date: 2026-03-08
- Area: `Z0`
- Scope: `PRJ-002`, `PRJ-003`
- Status: `covered`

## Closed Items

### PRJ-002
- Outcome: `AppRuntimeV2` 现在显式声明 `runtimeVersion = 2`，并在交互层启动前创建 app 级共享 `interactionModeStore`。
- Root Cause: v2 外层入口虽然已切换，但交互模式真相源仍只挂在交互实例，运行时边界没有统一暴露。
- Fix Location:
  - `src/app/AppRuntimeV2.js`
  - `src/ui/Interaction.js`
  - `src/app/interaction/InteractionModeStateMachine.js`
- Evidence:
  - `tests/app.bootstrapV2.spec.js`
  - `tests/interaction.modeStore.spec.js`

### PRJ-003
- Outcome: mode store 读取已支持 app 级共享 store / snapshot，legacy flags 继续只读，不再参与 v2 写路径。
- Root Cause: 交互 store、snapshot、legacy raw fields 没有统一到单一可写真相源。
- Fix Location:
  - `src/app/interaction/InteractionModeBridge.js`
  - `src/app/interaction/InteractionModeStateMachine.js`
  - `src/ui/interaction/ToolPlacementController.js`
- Evidence:
  - `tests/interaction.modeStore.spec.js`
  - `tests/interaction.modeBridge.spec.js`
  - `tests/app.bootstrapV2.spec.js`

## Verification

- `npm test -- tests/interaction.modeStore.spec.js tests/interaction.modeBridge.spec.js tests/interaction.modeMatrix.spec.js tests/app.bootstrapV2.spec.js`
