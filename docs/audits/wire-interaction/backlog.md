# Wire Interaction Backlog

Use the same schema as `top20.md` for findings that do not enter Top20.

| id | title | device | viewport_state | severity | score | root_cause_class | auto_test_status | notes |
|---|---|---|---|---|---|---|---|---|
| WIR-B001 | 缩放吸附阈值回归监控项 | mouse/touch/pen | scale 0.5/1/2/4 | P3 | 18 | coordinate-domain-mismatch | covered | 已在 `tests/interaction.snapController.spec.js` 加入缩放阈值归一化测试，持续监控即可。 |
| WIR-B002 | 排除拖拽导线集合回归监控项 | mouse/touch/pen | all scales + all pans | P3 | 16 | state-machine-race | covered | `excludeWireIds` 透传已修复，需防止后续重构遗漏。 |
| WIR-B003 | 导线工具点中端子坐标回归监控项 | mouse/touch/pen | all scales + all pans | P3 | 20 | coordinate-domain-mismatch | covered | `pendingToolType=Wire` 已改为优先使用目标端子/端点真实坐标。 |
