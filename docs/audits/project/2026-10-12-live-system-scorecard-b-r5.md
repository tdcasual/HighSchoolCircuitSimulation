# 独立第二审计员 B — 当前工作树评分 r5

- 审计日期：2026-10-13（本机时区 Asia/Shanghai）。范围：当前工作树，包含已修改、删除及未跟踪文件。
- 分支：`execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`。
- HEAD：`5d691047f83b4229153f70392e1534995b47dd7c`；评分对象不是仅此提交。
- 标尺：`2026-10-10-architecture-audit.md` §11 的运行系统 10 分制；独立判断，未读取任何 `*scorecard-a*` 或 `score-ceiling-closeout.md`，未借用其他审计员数字。

| 维度 | 分数 | 当前运行图的依据 / 扣分 |
|---|---:|---|
| 架构整洁度 | 8.0 | Circuit 已是服务门面；共享节点、印记、结模型和线性代数。双核编排及 live 状态桥仍在。 |
| 健壮性 | 8.2 | 定向 33 测试全通过；成功 V2 与失败回退路径有覆盖。异常转 invalid、双拓扑包装差异仍增加诊断与验证负担。 |
| 解耦程度 | 7.7 | V2 使用 snapshot / ViewMap，正常课堂步进不创建 V1；standby 仍写活元件和 V1 状态，UI 仍依赖共享 InteractionManager。 |
| 可扩展性 | 7.8 | 两核使用同一 handler 对象，避免印记分叉；类型定义、IO 校正、动态初始化及缓存键仍需多点维护。 |
| 可维护性 | 7.9 | 入口与重复算法明显收口；方法 map 仍共享 this / prototype，较大服务和双核生命周期仍需并行理解。 |
| 兼容性代价（越低越好） | 4.5 | V1 延迟创建降低正常路径成本，但 fallback / shadow、两套状态及读值退路仍是持续维护成本。 |
| 综合 | **7.9** | `(8.0 + 8.2 + 7.7 + 7.8 + 7.9) / 5 = 7.92`，保留一位小数；兼容性代价不参与。 |

## 必做实时测量

1. `wc -l src/core/runtime/Circuit.js`：**502 行**。
2. 在 `src/ui/interaction` 精确查找 `Object.assign(InteractionManagerClass.prototype`：**0 次**。
   这不表示 prototype 安装消失：`assignInteractionMethods.js:2–6` 仍以 `proto[name] = map[name]` 安装。
3. 除 helper 自身，仅 `interactionMethodMaps.js:2` 导入 `assignInteractionMethods.js`。
   `Interaction.js:7,27` 是生产唯一 `installInteractionMethodMaps` 装配点；33 个叶子方法 map 聚合到同一 prototype。
4. Node 直接导入实测：`DefaultComponentRegistry.get('Resistor') === DefaultStampRegistryV2.get('Resistor')` 为 **true**；
   与 `DefaultStampHandlers.get('Resistor')` 也相同。两 registry 都调用 `src/utils/registerDefaultStamps.js`。
   `src/core/simulation/JunctionModel.js` 与 `src/v2/simulation/JunctionModelV2.js` 均重导出 `src/utils/JunctionModel.js`。
5. `NodeBuilder` 与 `NodeBuilderV2` 都调用 `src/utils/buildElectricalNodes.js`。
   V1 写 `wire.nodeIndex`，使用 Component terminal count 和注入坐标；V2 不写 wire index，使用 definition terminal count，
   并对终端及导线端点做 `normalizeCanvasPoint`，没有注入坐标函数时使用几何回退。包装差异仍真实存在。
6. `CircuitSimulationLoopService.runStep:172–182` 与 `prepareSimulation:441–447` 的 V2 分支跳过 `ensureSolverPrepared`，
   成功 V2 不调用 V1 `setCircuit`。失败分支 `235–248` 仍先 `restoreStandby`，再取 V1、`setCircuit`、解相同 `substepDt`，
   成功 V1 回退后 `commitStandbyFromCircuit`，没有把持久化 mode 改为 V1。
7. `Circuit` 构造时 `_solver = null`，getter 才创建 `MNASolver`。
   直接 Node probe：3 V / 2 Ω 内阻 + 8 Ω 负载，注入真实 V2 + `wrapSolverBackend` + prepare + `circuit.step()`；
   构造、prepare 后和成功 step 后 `_solver === null` 均为 **true**，`valid=true`、`backendUsed=v2`、fallbackCount=0、
   `simTime=0.01`、电流 `0.29999999999952 A`、ViewMap 负载电压 `2.39999999999616 V`。
   V1 仍保留为 fallback / shadow 核；debugRuntimeCircuit 也会主动访问 solver getter。
8. `ComponentViewAdapter.js` 不再导出或调用 `applyViewMapToComponents`（仅测试 helper 保留该名称）。
   `wrapSolverBackend` 在 mode=v2 且结果 valid 时调用 `restoreStandby(input.circuit)`；没有把 ViewMap 读数复制到组件。
   注意 standby 恢复仍写组件的动态历史 / speed / backEmf / conducting / energized / fuse 字段，不是零写回架构。
9. V1 `Matrix.js` 和 V2 `LinearAlgebraV2.js` 共用 `src/utils/linearAlgebra.js` 的 LU / 解向量 / 零矩阵；
   V1 `SolverMatrixAssembler` 也复用共享 stamp 函数。
   `buildSystemMatrixCacheKey.js` 经 V1 `SolverMatrixCacheKeyBuilder` 和 V2 `LinearAlgebraV2` 重导出，被两核求解路径使用。
10. 课堂 Renderer 的 `resolveValueDisplayRecord` 调用共享 `resolveComponentViewRecord`；MeasurementReadoutController、
    PropertyPanelController 优先调用该 Renderer 入口。ObservationSources / ObservationExportService 与 AI CircuitExplainer
    直接调用共享 helper，优先 ViewMap；缺失记录仍退回 live component。RuntimeUiBridge 对有效 V2 安装 ViewMap。

## 验证与剩余负担

- 执行：`npx vitest run tests/interaction.methodMaps.spec.js tests/app.componentViewAdapter.spec.js tests/app.solverBackend.spec.js tests/app.solverBackend.defaultOn.spec.js tests/simulation.sharedLinearAlgebra.spec.js`。
- 结果：**5 文件 / 33 测试通过**；没有更新 goldens。另做上述真实 Node registry / runtime probe。
- 综合没有诚实超过 8.0：V1/V2 两套 orchestration、standby 与 SimulationState/活元件同步、prototype 上的共享 this、
  分散的 type 分支、ViewMap 缺失回退，以及两种节点包装约定仍在生产图中。
- 规模证据：SimulationLoopService 522 行、TopologyService 436 行、Component 797 行、V1 MNASolver 485 行、V2 SolveCircuitV2 516 行。
- 本轮是源码 + 定向运行审计，未做浏览器课堂走查或全量电气/性能回归；33 测试不能替代这些验证，未据此声称全系统无缺陷。
- 记录模式：仅覆盖写入本报告的两个指定副本；未修改生产、测试、包/锁文件、goldens 或 top30 状态格。
