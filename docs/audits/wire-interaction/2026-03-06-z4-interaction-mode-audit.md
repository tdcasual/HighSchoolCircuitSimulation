# Z4 Interaction Mode Audit

- Date: 2026-03-06
- Area: `Z4`
- Scope: 交互模式互斥、指针会话、导线编辑状态
- Related PRJs: `PRJ-001`, `PRJ-018`

## Findings

### PRJ-001
- 现象：`wire` 与 `endpoint-edit` 在部分链路下可同时激活。
- 风险：一次输入被两个模式解释。
- 证据入口：`tests/interaction.modeMatrix.spec.js`

### PRJ-018
- 现象：长按 / pinch / context menu 后 pointer session 可能卡住。
- 风险：后续拖拽、连线、菜单交互无法稳定恢复。
- 证据入口：`tests/interaction.pointerSessionManager.spec.js`, `tests/touchActionController.spec.js`

## Current Status
- 审计完成，待按交互状态机与 pointer session 仲裁方案整改。
