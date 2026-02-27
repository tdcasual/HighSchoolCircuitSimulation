# Wire Interaction Top20

## Schema

Each finding entry must include:

- `id` (`WIR-###`)
- `title`
- `device`
- `viewport_state`
- `steps`
- `expected`
- `actual`
- `root_cause_class` (`coordinate-domain-mismatch | threshold-policy-mismatch | state-machine-race | commit-timing-error | visual-logic-desync`)
- `severity` (`P0|P1|P2|P3`)
- `score` (`Impact × Frequency × Unavoidable`)
- `impact_scope`
- `suggested_fix_location`
- `auto_test_status` (`none|planned|covered`)

## Summary

| id | title | device | viewport_state | severity | score | root_cause_class | auto_test_status |
|---|---|---|---|---|---|---|---|
| WIR-001 | 导线工具无法吸附导线中段 | mouse/touch/pen | all scales + all pans | P1 | 60 | threshold-policy-mismatch | covered |
| WIR-002 | 端点拖拽落在线段上不会自动分割并建结点 | mouse/touch/pen | all scales + all pans | P1 | 48 | commit-timing-error | covered |
| WIR-003 | 端子命中区与几何吸附阈值不一致 | mouse/pen | all scales + all pans | P1 | 45 | threshold-policy-mismatch | covered |
| WIR-004 | 默认端子点击进入“端子延长”而非拉线 | mouse/touch/pen | scale=1 baseline | P2 | 30 | state-machine-race | covered |
| WIR-005 | 线段吸附缺少视觉预览反馈 | mouse/touch/pen | all scales + all pans | P2 | 24 | visual-logic-desync | covered |
| WIR-006 | 非正交导线无法分割 | mouse/touch/pen | all scales + all pans | P2 | 27 | threshold-policy-mismatch | covered |

## Detailed Entries

### WIR-001

- `id`: WIR-001
- `title`: 导线工具无法吸附导线中段
- `device`: mouse/touch/pen
- `viewport_state`: all scales + all pans
- `steps`:
1. 进入导线模式并从一个端子起线。
2. 将终点移动到已有导线中段并释放。
3. 观察最终吸附结果与拓扑。
- `expected`: 终点可吸附在线段并形成结点（必要时自动分割）。
- `actual`: 主流程始终禁用线段吸附，只能吸附端子/端点/网格。
- `root_cause_class`: threshold-policy-mismatch
- `severity`: P1
- `score`: 60
- `impact_scope`: T 形接线效率显著下降，复杂电路连线步骤变多。
- `suggested_fix_location`:
1. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ui/interaction/WireInteractions.js:38`
2. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ui/interaction/WireInteractions.js:71`
3. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ui/interaction/WireInteractions.js:90`
4. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/app/interaction/InteractionOrchestrator.js:413`
5. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/app/interaction/InteractionOrchestrator.js:513`
- `auto_test_status`: covered

### WIR-002

- `id`: WIR-002
- `title`: 端点拖拽落在线段上不会自动分割并建结点
- `device`: mouse/touch/pen
- `viewport_state`: all scales + all pans
- `steps`:
1. 选中一条导线并拖动其端点。
2. 将端点落到另一条导线中段并释放。
3. 观察是否创建新结点与分割结果。
- `expected`: 释放时自动分割目标导线并形成稳定连接结点。
- `actual`: 不会触发分割，连接语义缺失。
- `root_cause_class`: commit-timing-error
- `severity`: P1
- `score`: 48
- `impact_scope`: 手动整理分支连接成本高，易出现“看起来连上但拓扑未连上”。
- `suggested_fix_location`:
1. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/app/interaction/InteractionOrchestrator.js:238`
2. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/app/interaction/InteractionOrchestrator.js:425`
3. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/tests/interaction.wireSegmentSnap.spec.js:158`
- `auto_test_status`: covered

### WIR-003

- `id`: WIR-003
- `title`: 端子命中区与几何吸附阈值不一致
- `device`: mouse/pen
- `viewport_state`: all scales + all pans
- `steps`:
1. 从空白处起线（避免直接命中端子 DOM 目标）。
2. 将光标放到端子外围命中区内但离中心较远的位置。
3. 点击结束连线。
- `expected`: 命中区内应稳定吸附到该端子。
- `actual`: 可能回落到网格吸附，产生“明明点到端子附近却没连上”。
- `root_cause_class`: threshold-policy-mismatch
- `severity`: P1
- `score`: 45
- `impact_scope`: 触发误连和重复操作，尤其在密集元件区。
- `suggested_fix_location`:
1. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/components/Component.js:224`
2. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/components/Component.js:1316`
3. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ui/interaction/SnapController.js:5`
- `auto_test_status`: covered

### WIR-004

- `id`: WIR-004
- `title`: 默认端子点击进入“端子延长”而非拉线
- `device`: mouse/touch/pen
- `viewport_state`: scale=1 baseline
- `steps`:
1. 非导线模式下直接点击元件端子。
2. 轻微拖动或按下释放。
3. 观察默认动作。
- `expected`: 新手常见预期是“从端子拉线”。
- `actual`: 默认进入 `startTerminalExtend`，需额外学习连线入口。
- `root_cause_class`: state-machine-race
- `severity`: P2
- `score`: 30
- `impact_scope`: 新用户学习成本高，教学演示连线路径不直观。
- `suggested_fix_location`:
1. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/app/interaction/InteractionOrchestrator.js:121`
- `auto_test_status`: covered

### WIR-005

- `id`: WIR-005
- `title`: 线段吸附缺少视觉预览反馈
- `device`: mouse/touch/pen
- `viewport_state`: all scales + all pans
- `steps`:
1. 在可触发线段吸附的场景移动光标（或未来启用后测试）。
2. 观察 UI 是否提示候选结点。
3. 对比端子吸附高亮体验。
- `expected`: 线段吸附应有明确结点高亮提示。
- `actual`: 仅有端子高亮，`highlightWireNode` 未接入交互链。
- `root_cause_class`: visual-logic-desync
- `severity`: P2
- `score`: 24
- `impact_scope`: 用户不确定是否会成功吸附，降低连线信心。
- `suggested_fix_location`:
1. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ui/Renderer.js:600`
2. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/app/interaction/InteractionOrchestrator.js:410`
- `auto_test_status`: covered

### WIR-006

- `id`: WIR-006
- `title`: 非正交导线无法分割
- `device`: mouse/touch/pen
- `viewport_state`: all scales + all pans
- `steps`:
1. 通过端点拖拽生成一条斜向导线。
2. 对该导线执行分割动作（Ctrl/Cmd 点击或菜单）。
3. 观察分割结果。
- `expected`: 所有可见导线均可按投影点分割。
- `actual`: 直接拒绝分割并提示“仅支持水平/垂直导线分割”。
- `root_cause_class`: threshold-policy-mismatch
- `severity`: P2
- `score`: 27
- `impact_scope`: 导线编辑能力不一致，复杂布局修正成本增加。
- `suggested_fix_location`:
1. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ui/interaction/WireInteractions.js:333`
2. `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ui/interaction/WireInteractions.js:352`
- `auto_test_status`: covered
