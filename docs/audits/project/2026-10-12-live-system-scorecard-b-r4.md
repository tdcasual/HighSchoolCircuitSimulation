# Live System Scorecard B R4

Date: 2026-10-12. Current working tree, including uncommitted files.

| Dimension | Score |
|---|---:|
| 架构整洁度 | 8.1 |
| 健壮性 | 7.9 |
| 解耦程度 | 7.8 |
| 可扩展性 | 8.0 |
| 可维护性 | 7.9 |
| 兼容性代价（越低越好） | 4.8 |
| **综合** | **7.9** |

综合为前五项算术平均：(8.1 + 7.9 + 7.8 + 8.0 + 7.9) / 5 = 7.94，四舍五入 7.9；兼容性代价不计入。

现场证据：`Circuit.js` 为 502 行；交互目录中精确字符串 `Object.assign(InteractionManagerClass.prototype` 为 0；交互通过 `Interaction.js` 的单一 `installInteractionMethodMaps` 安装。两个默认注册表的 Resistor handler 是同一对象，均由 `src/utils/registerDefaultStamps.js` 填充。两个 NodeBuilder 共用 `src/utils/buildElectricalNodes.js`，差异是 V1 写入 `wire.nodeIndex`、V2 不写且规范化 canvas 点；两个 JunctionModel 重新导出 `src/utils/JunctionModel.js`。共享线性代数与 cache-key 工具已被 V1/V2 复用。

构造函数将 `_solver` 初始化为 null；注入并包装 V2 backend 后，`prepareSimulation` 和一次成功 `step` 后仍为 null。V2 正常路径跳过 `ensureSolverPrepared`/`setCircuit`；失败路径仍是 `restoreStandby` 后 V1 `setCircuit` + `commitV1Substep`。有效 V2 不再把 ViewMap 复制回 live component，但 `applyViewMapToComponents` 仍保留。课堂读数、属性面板、ObservationSources、ObservationExportService、CircuitExplainer 均优先 ViewMap（renderer resolver 或 `resolveComponentViewRecord`），无 ViewMap 时回退 live 字段。

验证：指定五个 vitest 文件全部通过，5 files / 35 tests。综合保持 7.9 的原因是双内核及 standby/V1 fallback 仍是当前热路径的真实复杂度，另有 topology wrapper 差异、兼容性 adapter 与交互 assign helper 遗留。
