# Z5 Property/Selection Follow-up

- Date: 2026-03-08
- Area: `Z5`
- Scope: `PRJ-022`, `PRJ-023`
- Status: `covered`

## Closed Items

### PRJ-022
- Outcome: 属性弹窗的部分核心字段已统一到共享 `ComponentPropertySchema`，快捷入口继续复用同一选择快照与反馈口径。
- Root Cause: 弹窗字段定义和属性应用逻辑分别散落，默认值/边界存在分叉风险。
- Fix Location:
  - `src/ui/interaction/ComponentPropertySchema.js`
  - `src/ui/interaction/PropertyDialogController.js`
  - `src/ui/interaction/PropertyDialogActions.js`
  - `src/ui/interaction/QuickActionBarController.js`
- Evidence:
  - `tests/interaction.propertyDialogController.spec.js`
  - `tests/interaction.propertyDialogActions.spec.js`
  - `tests/quickActionBarController.spec.js`

### PRJ-023
- Outcome: 缺失组件/导线不会再残留为已选中态；shared selection snapshot 会在实体失效时归一到 `none`。
- Root Cause: selection raw fields 和 shared snapshot 都可能保留已经不存在的实体 id。
- Fix Location:
  - `src/ui/interaction/SelectionPanelController.js`
  - `src/ui/interaction/UIStateController.js`
- Evidence:
  - `tests/interaction.selectionPanelController.spec.js`
  - `tests/interaction.uiStateController.spec.js`
  - `tests/quickActionBarController.spec.js`

## Verification

- `npm test -- tests/interaction.propertyDialogActions.spec.js tests/interaction.propertyDialogController.spec.js tests/quickActionBarController.spec.js tests/interaction.selectionPanelController.spec.js tests/interaction.uiStateController.spec.js`
