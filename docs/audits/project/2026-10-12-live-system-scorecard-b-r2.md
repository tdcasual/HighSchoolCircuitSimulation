# Live system scorecard B — R2 (independent Codex audit)

- 日期：2026-10-12；对象：CURRENT working tree（包含未提交修改），不是仅 HEAD。
- 分支：`execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`。
- HEAD：`5d691047f83b4229153f70392e1534995b47dd7c`。
- 口径：`2026-10-10-architecture-audit.md` §11，10 分制，衡量课堂实际运行图。
- 独立性：未读取 `*scorecard-a*`、`score-ceiling-closeout.md`，也未读取先前 B 分数。
- Record-only：仅覆盖指定两份 B-R2 记录；未修改生产、测试、依赖、goldens 或 top30 状态。

| 维度 | 分数 | 当前证据与扣分理由 |
|---|---:|---|
| 架构整洁度 | 7.5 | Circuit 主体服务化，app 持有 SimulationDriver，schema 收口；仍集中装配可变上下文与双求解路径。 |
| 健壮性 | 8.0 | 子步回退、standby 恢复及再同步有实现与测试；定向验证有 1 项失败，未验证完整浏览器课堂流程。 |
| 解耦程度 | 7.0 | V2 正常路径不再准备 V1，读数优先 ViewMap；适配器仍回写活元件，交互仍共享一个原型和状态。 |
| 可扩展性 | 7.3 | V2 以 DTO/state/projection 组织求解，拓扑支持 wires；reset、动态同步、投影仍散落类型分支。 |
| 可维护性 | 7.6 | 491 行门面、集中交互装配改善追踪；双 NodeBuilder/求解状态及大服务仍需同步维护，注释契约测试失败。 |
| 兼容性代价（越低越好） | 5.5 | schema 键表已单源；V1/V2/shadow、standby 转换、显示回写与 live-field fallback 仍付维护成本。 |
| 综合 | **7.5** | (7.5 + 8.0 + 7.0 + 7.3 + 7.6) / 5 = 7.48 → 7.5；排除兼容性代价。 |

## 实测与运行路径

1. `src/core/runtime/Circuit.js`：`wc -l` = **491**（尺寸脚本按 split 换行计 492）。
   79 个非构造方法中 70 个为单行主体；拓扑、步进循环、流分析与验证多数委托服务。
   仍内联：构造装配、读快照、诊断编排、step、装载替换、clear、日志/调试设置及反序列化编排。
   `CircuitTopologyService.js` 436 行，`CircuitSimulationLoopService.js` 519 行；服务仍接收整个 Circuit context。
2. `src/ui/interaction` 中精确 `Object.assign(InteractionManagerClass.prototype`：**0 处 / 0 文件**。
   `Interaction.js` 单点 install → `interactionMethodMaps.js` 汇合 33 个方法表 → `assignInteractionMethods.js` 写 `proto[name]`。
   装配点收口成立；仍是共享 this 的原型混入，且对象展开/赋值可覆盖同名方法，不能记作子系统实例解耦完成。
3. `CircuitSimulationLoopService.js:171,402`：V2 正常 runStep/prepare 不调用 `ensureSolverPrepared` 或 `solver.setCircuit`。
   V1/shadow 仍准备 V1；V2 失败分支（235–250）restoreStandby → setCircuit → V1 solve 同一 substepDt → commitStandbyFromCircuit。
   `createInjectedSolverBackend.js` 默认 v2，真实调用 `runSimulationStepV2`；Circuit 仍构造 MNASolver 供回退。
4. ViewMap 优先级成立，真实 0 不退回过时 live 数值：
   - MeasurementReadoutController:83 与 PropertyPanelController:447/459/539 使用 `resolveValueDisplayRecord`。
   - ObservationSources:237 从 `lastResults.viewMap` 经 `resolveComponentViewRecord` 读取 I/U/P。
   - ObservationExportService:113–123 优先 renderer.viewMap，否则 lastResults.viewMap，读取自主仪表值。
   - Renderer:51 直接覆盖 I/U/P 字段，零值保留；无 view record 时才回退组件。
   特殊动态字段仍有 live 读取；ComponentViewAdapter 成功 V2 帧仍复制显示字段并恢复动态状态，迁移未完结。
5. 双 NodeBuilder **仍存在且两者参与实际路径**：core NodeBuilder 维护 live nodes；V2 TopologyCoordinator 调 NodeBuilderV2 重建快照拓扑。
   V2 已处理 wires，旧“丢弃 wires”问题不再成立；两份并查集、接线语义与节点编号仍有漂移风险。
6. schema 已收口：`CircuitSchemaV3.js` 调 `CircuitSchemaGateway.validate`，不再重复键表；V1 NetlistBuilder 也已无 source 元件引用。
   但 V1 setCircuit 仍接收 live components，且显示/动态状态桥接保留，不能据 DTO 文件存在断言全系统纯化。

## 验证与限制

- 定向 Vitest：10 文件、72 项，**71 通过 / 1 失败**；覆盖 facade、method maps、四类读数/导出、adapter、后端及 V2 wires。
- 唯一失败：`tests/app.componentViewAdapter.spec.js:14`，注释缺少 `MeasurementReadoutController` 全名（后续 PropertyPanel 全名断言也未满足）；属于源码文字契约失败，不是已证实的数值错误。
- MeasurementReadout/ObservationSources 的真实零优先测试通过；另以 Node 实际调用 Renderer resolver 与 export metadata，过时 9A 被 ViewMap 0A 覆盖并导出 0A。
- PropertyPanel 零值结论来自源码与公共 resolver；该文件现有 3 项测试不专门覆盖 ViewMap 零值，未冒充浏览器验证。
- architecture-boundaries、runtime-exclusive、core-size 检查通过；core-size 对 ExerciseBoard/ChatController 发出目标尺寸警告。
- 未运行完整测试套件、性能基线或浏览器 E2E；这些定向结果不代表全项目绿灯。
- 判定：改进实质存在，但共享原型、活对象桥接与双拓扑/求解核不足以支持综合 > 8.0；独立评分为 **7.5**。
