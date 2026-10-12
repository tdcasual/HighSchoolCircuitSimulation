# 当前运行系统独立评分 B-r3（2026-10-12）

审计者：Codex，独立第二审计；record-only。
对象：`execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs` 当前工作树，包含未提交及未跟踪实现与测试。
HEAD：`5d691047f83b4229153f70392e1534995b47dd7c`；评分依据为本次实测源码，不是仅 HEAD 或 v2 目录。
口径：2026-10-10 architecture audit §11，10 分制；兼容性代价越低越好，不纳入综合。
未读取 `*scorecard-a*`、`score-ceiling-closeout.md` 或此前 B 评分；未修改生产、测试、依赖、goldens 或 top30 状态。

| 维度 | 分数 | 当前运行图依据与扣分 |
|---|---:|---|
| 架构整洁度 | 7.8 | Circuit 已将拓扑、步进、投影、诊断交给服务；共享印记、节点构建与读数解析消除重复。但门面仍拥有大量可变状态，服务依赖整份 context。 |
| 健壮性 | 8.0 | 有子步失败恢复及 V1 回退；本次 36 项定向测试通过，真实零值优先级正确。未做完整回归或浏览器课堂验证，不能据此宣称全链路可靠性。 |
| 解耦程度 | 7.2 | V2 正常路径跳过 V1 准备，读者优先 ViewMap；仍有 live 对象写回、缺记录回读、服务互调 context 方法，以及双求解核。 |
| 可扩展性 | 7.8 | 两注册表共用同一 handler 对象，节点算法共用，V2 coordinator 支持注入 solve；器件 type 分发仍见步进初始化、拓扑与 AI 描述，新增器件尚非单点扩展。 |
| 可维护性 | 7.7 | Circuit 491 行，交互方法集中安装，共享算法只维护一份；但方法表仍聚合到一个原型，隐式 this 依赖与多状态通道仍需跨文件追踪。 |
| 兼容性代价（越低越好） | 5.5 | V1 仍实例化且实际承接回退，shadow 与 ViewMap→live 适配并存；共享实现降低重复维护，尚未消除双核运行与状态同步成本。 |
| 综合 | **7.7** | (7.8 + 8.0 + 7.2 + 7.8 + 7.7) / 5 = 7.7；不含兼容性代价。 |

本次实时核查：

1. `wc -l src/core/runtime/Circuit.js`：**491**。
2. 对 `src/ui/interaction` 逐文件计数精确子串 `Object.assign(InteractionManagerClass.prototype`：**0**。这只是旧写法消失，不能视为交互对象已解耦。
3. Node 实际导入验证：`DefaultComponentRegistry.get('Resistor') === DefaultStampRegistryV2.get('Resistor')` 为 **true**；V1 handler 与 `DefaultStampHandlers.get('Resistor')` 也为 **true**。
   两表均调用 `src/utils/registerDefaultStamps.js` 的 `registerDefaultStamps`；`JunctionModel.js` 与 `JunctionModelV2.js` 均重导出 `src/utils/JunctionModel.js`。
4. `NodeBuilder` 与 `NodeBuilderV2` 均调用 `src/utils/buildElectricalNodes.js`。
   V1 设置 `writeWireNodeIndex: true`，V2 为 false；V2 显式使用 `normalizeCanvasPoint` 做 canvas snap，并提供几何位置兜底。
   终端数入口也不同：V1 用 `getComponentTerminalCount`，V2 用 definition；共享算法仍写入传入组件的 `nodes`。
5. `CircuitSimulationLoopService.runStep`（172 起）在 V2 模式跳过 `ensureSolverPrepared`；`prepareSimulation`（401 起）亦跳过，V1/shadow 仍准备。
   V2 正常路径不调用 V1 `setCircuit`；失败路径（235–237）仍按 `restoreStandby` → V1 `setCircuit` → `commitV1Substep(substepDt)` 执行。
6. 读数解析已统一到 `src/utils/componentViewRecord.js`：MeasurementReadoutController、PropertyPanelController 通过 Renderer 的 `resolveValueDisplayRecord` 间接使用；ObservationSources、ObservationExportService、CircuitExplainer 直接使用。
   存在 ViewMap 记录时 I/U/P 显式覆盖 live 字段，**0 不会被旧值替代**；不存在有效记录时仍返回 live 组件。
   helper 对缺失的 I/U/P 字段不按字段回读旧值；brightness 则仍有 live 兜底。AI 非简洁输出仍假设记录中的数值字段完整，不能把统一 helper 等同于完整输入加固。
7. `Circuit.js:37` 仍有 **`new MNASolver()`**；`CircuitSimulationLoopService` 仍保留 V1 正常步、shadow 及失败回退路径。
   `ComponentViewAdapter` 仍向 live 组件复制显示与动态字段，并在有效 V2 帧后调用备用状态恢复；双核与桥接成本已计入评分。
8. `Interaction.js:27` 通过 **`installInteractionMethodMaps(InteractionManager)`** 安装一次；底层 `assignInteractionMethods` 仍逐项写同一个 `InteractionManagerClass.prototype`。
   方法集中组合改善安装可追踪性，但仍共享可变 this；不是独立控制器边界已经完成。

验证（未使用 `--update`）：

`npx vitest run tests/simulation.sharedStamps.spec.js tests/ai.circuitExplainer.spec.js tests/observationSources.spec.js tests/topology.coordinatorV2.wires.spec.js tests/app.solverBackend.defaultOn.spec.js`

结果：**5 个文件、36 项测试全部通过**（sharedStamps 2、AI 1、observationSources 12、topology wires 13、defaultOn 8）。
测试证实共享 handler 身份、AI/观察源零值读取及指定拓扑/默认后端行为；此次未单独运行属性面板或导出测试，其结论限于源码核查。

结论：当前改进已接入运行图；服务抽取、共享算法和读数优先级值得加分，但单一交互原型、live 状态桥接、双核回退仍是实际负担。现有证据不支持综合 > 8.0。
