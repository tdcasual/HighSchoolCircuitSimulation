# 独立第二审计：当前课堂运行系统 B-r8

日期：2026-10-13；对象：包含未提交修改的当前工作树。
分支：`execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`
HEAD：`28f36e50e5d66bd64daa104154c6fe06171c2e47`（评分对象并非仅此提交）。
依据：`2026-10-10-architecture-audit.md` §11，10 分制；独立读取源码与执行测试。
未读取任何 `*scorecard-a*` 或 `score-ceiling-closeout.md`，未使用其他审计者分数。

| 维度 | 分数 | 当前运行证据及扣分依据 |
|---|---:|---|
| 架构整洁度 | 8.1 | Circuit 已成为 484 行服务门面，课堂求解单路径；仍持有大量跨服务缓存、旧状态与投影服务。 |
| 健壮性 | 7.5 | V2 无效子步停止、不切换求解核；重置清理 backend；指定 50 项测试通过。但异常被吞为泛化 invalid，成功步自适应所需 meta 未贯通。 |
| 解耦程度 | 7.7 | 快照、独立 V2 状态、ViewMap 避免求解结果写回活元件；服务仍接收整个 Circuit，交互仍共享宿主 this。 |
| 可扩展性 | 7.8 | 元件定义与 stamp registry 可扩展；动态更新、拓扑连接模式、导线流分析仍有 type 分支。 |
| 可维护性 | 7.8 | 门面缩减、单点实例安装、单求解路径降低维护负担；委托层较多，双拓扑包装及旧 API 残留增加追踪成本。 |
| 兼容性代价（越低越好） | 3.0 | 课堂不再承受 V1/V2 回退双核税；仍维护双 NodeBuilder 包装、旧核心状态/投影接口、回退计数与状态栏兼容结构。 |
| 综合 | **7.8** | (8.1 + 7.5 + 7.7 + 7.8 + 7.8) / 5 = 7.78，保留一位小数；兼容性代价不计入。 |

## 12 项实时测量

1. `wc -l src/core/runtime/Circuit.js`：**484**。
2. Circuit 无 `MNASolver` import；无 solver getter/setter，无 `_solver` 字段。应用注入的是 `solverBackend`。
3. 使用支持 glob 的等价命令 `rg -n MNASolver src --glob '*.js'`：唯一命中为
   `src/core/simulation/MNASolver.js:20:export class MNASolver {`。
   仍命名它的生产目录仅 `src/core/simulation`；这是保留定义，不能据此认定课堂仍调用 V1。
4. `CircuitSimulationLoopService.runStep` 仅通过 `backend.solveFrame` 求解。
   invalid 分支构造 `valid:false / backendUsed:'v2'`，调用 `noteAdaptive` 后 break；
   无 `restoreStandby`、`setCircuit`、`commitV1Substep`。成功子步推进时钟，失败子步不推进。
5. `createInjectedSolverBackend` 是 V2-only duck：默认/模式均为 `'v2'`；
   `solveFrame → runSimulationStepV2`，独立持有 SimulationStateV2；无 V1 分支，options 当前被忽略。
6. `wrapSolverBackend` 原样返回 backend（identity）；不包装求解函数，不复制结果，不恢复 standby。
7. `EmbedRuntimeOptions.js:148–155`：没有 `solver=` 时明确钉 `'v2'`，显式 v2 也为 v2。
8. `Circuit.step` 不调用 `updateComponentDisplayValues` / `applyStepResults`；
   保存结果、增加 stepId、附诊断、通知 onUpdate。UI 使用 ViewMap overlay。
9. Circuit 的 `resetRuntimeCaches` 委托服务；服务末尾确实调用 `context.solverBackend?.reset?.()`。
10. Interaction 构造器调用 `installInteractionMethodMaps(this)`；assign 工具将方法写到 host 实例。
    `controllers` 为分组方法对象；不是写到 `InteractionManager.prototype`。
    对 src 的跨行 `Object.assign(... .prototype)` 搜索无命中。
11. 两个 NodeBuilder 包装仍存在且均课堂可达：编辑侧 `CircuitTopologyService → NodeBuilder`，
    求解侧 `TopologyCoordinatorV2 → NodeBuilderV2`；共同使用 `buildElectricalNodes`。
    前者写 wire nodeIndex，后者不写；终端数/几何适配不同，不应称为两套独立底层算法。
12. `SolveCircuitV2.js` 文件头明确承认课堂默认 tick 可达，未声称 tests-only。
    已核实 `bootstrapV2 → factory → runSimulationStepV2 → SimulationCoordinatorV2 → solveCircuitV2`。

## 尚未清除的运行图负担

- 交互实例安装消除了全局原型写入，但委托仍以 `.call(this)` 共享宿主；分组 controllers 尚不是隔离依赖的控制器边界。
- 编辑拓扑与快照求解拓扑仍分别构建；滑动变阻器连接模式在核心服务和 V2 coordinator 均有分支，需要保持语义一致。
- Circuit 服务通过完整 context 读写缓存和状态；Circuit 仍构造旧 SimulationState、NetlistBuilder、ResultProjectionService。
  旧投影/同步方法保留不等于当前 tick 调用它们，但增加接口与维护成本。
- 自适应服务读取 `results.meta.iterations/maxIterations/converged`；真实 V2 kernel 返回值没有 meta，factory 也没有输出 meta。
  因而 invalid 可触发缩步，但成功步的近迭代上限与 easy-streak 增步缺少真实迭代依据。
- factory 与 loop 捕获异常后返回通用 invalid，缺少异常原因；仅指定测试通过不足以证明完整课堂、浏览器和电气回归均无风险。

## 验证与范围

执行：`npx vitest run tests/app.solverBackend.spec.js tests/app.solverBackend.defaultOn.spec.js tests/circuit.facadeDelegation.spec.js tests/interaction.methodMaps.spec.js tests/embedRuntimeBridge.spec.js`
结果：**5 个文件、50 项测试全部通过**（约 0.99 秒）。未运行全量测试、浏览器 E2E 或 golden 电气基线。
结论：综合 **7.8**，当前证据不足以给出 >8.0；主要限制是共享宿主耦合、双拓扑适配与结果元数据契约。
仅覆盖两份指定 B-r8 记录；未修改生产代码、测试、依赖、goldens 或 top30 状态单元格。
