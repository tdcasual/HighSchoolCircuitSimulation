# Wire Interaction Automation Mapping

## Schema

- `wir_id`
- `test_level` (`unit|integration|e2e`)
- `test_file`
- `status` (`none|planned|covered`)
- `notes`

## Mapping Table

| wir_id | test_level | test_file | status | notes |
|---|---|---|---|---|
| WIR-001 | integration | tests/interaction.wireSegmentSnap.spec.js | covered | 已覆盖起线/收线线段吸附与分割建结点路径。 |
| WIR-001 | e2e | scripts/e2e/wire-interaction-regression.mjs | covered | 已覆盖线段吸附主流程（含缩放与指针类型矩阵中的连线链路）。 |
| WIR-002 | integration | tests/interaction.wireSegmentSnap.spec.js | covered | 已覆盖端点拖拽落在线段时自动分割目标导线并纳入压缩范围。 |
| WIR-002 | e2e | scripts/e2e/wire-interaction-regression.mjs | covered | 已覆盖端点拖拽落在线段后自动分割并建结点。 |
| WIR-003 | unit | tests/interaction.snapController.spec.js | covered | 已覆盖端子吸附阈值下限与端子命中半径一致性。 |
| WIR-003 | e2e | scripts/e2e/wire-interaction-regression.mjs | covered | 已覆盖 scale=0.5/1/2/4 × mouse/pen/touch 端子吸附矩阵。 |
| WIR-004 | integration | tests/interaction.orchestrator.spec.js | covered | 已覆盖默认端子点击起线与 Alt+端子延长分流行为。 |
| WIR-004 | e2e | scripts/e2e/wire-interaction-regression.mjs | covered | 已覆盖默认端子起线与 Alt+端子延长真实交互入口。 |
| WIR-005 | integration | tests/interaction.orchestrator.spec.js | covered | 已覆盖线段吸附预览高亮（连线预览与端点拖拽）。 |
| WIR-005 | e2e | scripts/e2e/wire-interaction-regression.mjs | covered | 已覆盖连线预览与端点拖拽两条链路的线段高亮。 |
| WIR-006 | unit | tests/interaction.wireSegmentSnap.spec.js | covered | 已覆盖非正交导线分割与非正交线段吸附投影。 |
| WIR-006 | e2e | scripts/e2e/wire-interaction-regression.mjs | covered | 已覆盖斜线端点拖拽吸附与自动分割结果。 |
| WIR-B001 | unit | tests/interaction.snapController.spec.js | covered | 已覆盖缩放阈值归一化。 |
| WIR-B001 | e2e | scripts/e2e/wire-interaction-regression.mjs | covered | 已覆盖缩放下固定屏幕距离端点吸附一致性。 |
| WIR-B002 | unit | tests/interaction.snapController.spec.js | covered | 已覆盖 `excludeWireIds` 透传。 |
| WIR-B003 | integration | tests/interaction.orchestrator.spec.js | covered | 已覆盖 pending wire 命中端子/端点坐标优先。 |
