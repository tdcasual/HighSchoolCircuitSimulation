# 独立第二审计 B-r6：当前课堂运行图

- 审计日期：2026-10-13（Asia/Shanghai）；依据架构审计 §11 的 10 分制。
- 分支：`execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`。
- HEAD：`5e7ecda765cdf906b679092aeeb987cd2d56076f`；包含当前未提交的循环服务及两份 backend 测试改动。
- 独立源码检查和现场执行；未读取其他审计员评分或 `score-ceiling-closeout.md`。

| 维度 | 分数 | 当前运行图依据 |
|---|---:|---|
| 架构整洁度 | 7.5 | Circuit 已为 502 行门面；课堂 V2 无需实例化 MNASolver，但仍持有文档、时钟、状态和多服务上下文。 |
| 健壮性 | 7.6 | 有效帧电气结果、失败不推进时间、历史续算及模式分发有定向验证；移除自动回退后，V2 无效帧直接失败，覆盖证据不足以支持更高分。 |
| 解耦程度 | 7.1 | 快照输入、V2 状态和 ViewMap 隔开主要求解/显示路径；有效帧 restoreStandby 仍回写活元件和旧 SimulationState。 |
| 可扩展性 | 7.4 | 共享 stamp 注册、节点构建和 canonical definition；初始化、动态更新、投影仍有多处 type 分支。 |
| 可维护性 | 7.4 | 共享 LU/stamps 降低重复维护；双编排、状态桥、交互原型集合和过期架构注释仍增加推理成本。 |
| 兼容性代价（越低越好） | 4.8 | V2 失败回退链已移除；V1、shadow、embed 钉 V1、历史桥和活字段读数后备仍需维护。 |
| 综合 | **7.4** | `(7.5 + 7.6 + 7.1 + 7.4 + 7.4) / 5 = 7.40`；兼容性代价不参与。 |

## 现场测量与指定路径

1. `wc -l src/core/runtime/Circuit.js`：**502**。
2. `CircuitSimulationLoopService.runStep` 的 V2 无效分支构造 `valid:false, backendUsed:'v2'` 并 `break`。
   不调用 `restoreStandby`、`context.solver.setCircuit` 或 `commitV1Substep`；四子步探针只执行一次 solveFrame。
3. 独立 Node 探针使用真实 3V / 内阻 2Ω / 负载 8Ω 夹具，注入 factory 并 wrap，未访问 solver getter。
   prepare 后及成功 step 后 `_solver === null`；电流 `0.29999999999952 A`，restoreStandby 调用一次。
   随后注入无效帧：`_solver === null`，`backendUsed:'v2'`，`valid:false`，时间仍为 `0.01s`，没有新增 restore 调用。
4. V1 与 shadow 都在 prepare 创建 V1 solver；标脏后三子步探针各记录 `setCircuit:1, solve:3, updateDynamicComponents:3`，时间推进 `0.01s`。
   V1 在自身分支直接提交；shadow 调用 `commitV1Substep`，本次比较计数为 1。
   可用 embed（`?embed=1&targetOrigin=https%3A%2F%2Flms.example`）未传 solver 时解析并 wrap 后均为 V1。
   首次探针只传 `?embed=1` 得到禁用 embed/undefined；补入必要 origin 后确认钉 V1，未将无效配置算作兼容失败。
5. `ComponentViewAdapter.wrapSolverBackend` 有效 V2 仍调用 `backend.restoreStandby(input.circuit)`；失败不调用。
   factory 的 restore 写入旧 SimulationState 和活元件历史/非线性状态；不复制 ViewMap 测量字段。
6. 共享基础仍在：两 registry 使用 `utils/registerDefaultStamps.js`；Matrix / LinearAlgebraV2 共用 LU、stamp 和 cache-key；
   NodeBuilder / NodeBuilderV2 共用 `utils/buildElectricalNodes.js`，但仍有两套 wrapper 与拓扑编排。
   RuntimeUiBridge 将有效 V2 ViewMap 交给 Renderer，Renderer 的值快照优先使用 view record。
   MeasurementReadoutController、PropertyPanelController 经 renderer 视图读取；ObservationSources、ObservationExportService、CircuitExplainer 保留视图覆盖路径及活字段后备。
7. `Interaction.js` 仍调用 `installInteractionMethodMaps(InteractionManager)`；安装器最终把集合写入同一个 class prototype。
   这是集中安装，不是按实例拆分交互职责。

## 验证及剩余负担

- 指定命令 `npx vitest run tests/app.solverBackend.spec.js tests/app.solverBackend.defaultOn.spec.js tests/simulation.sharedLinearAlgebra.spec.js tests/interaction.methodMaps.spec.js`：**4 文件、31 测试全部通过**；未更新 golden。
- 额外 Node 探针验证上述 solver 惰性实例化、restore 次数、V1/shadow 子步及 embed 行为；未修改测试文件。
- 两套 solver 的求解编排/动态状态仍存在；共享数学工具不等于统一完整求解核。
- Circuit 服务仍接收宽泛可变 context；V2 的 standby 桥使动态状态同时存在于 V2、旧状态和活元件。
- 交互仍为一个原型与共享上下文；类型定义未收口到同时拥有渲染、stamp、初始化、动态更新的单一扩展协议。
- 无效 V2 分支未加入 adaptiveDecisionResults，首个无效子步不会触发自适应缩步；这是仍在运行的恢复能力缺口。
- `SolveCircuitV2.js` 仍自称 tests-only，但注入 backend 经 SimulationCoordinatorV2 实际调用它；AGENTS.md 的失败回退说明及 adapter sunset 注释也未与当前循环一致。
- 本轮未执行全套电气、浏览器或完整 CI 门禁；31 项通过不代表全类型课堂可靠性。当前证据不支持综合超过 8.0。

本轮只覆盖两份 B-r6 记录，不修改生产、测试、依赖、golden 或 top30 状态格。
