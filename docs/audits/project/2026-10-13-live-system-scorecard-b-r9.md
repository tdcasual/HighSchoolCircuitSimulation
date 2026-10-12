# 独立第二审计：当前课堂运行系统 B-r9

日期：2026-10-13；对象：当前工作树（含未提交修改）。
分支：`execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`。
依据：`docs/audits/project/2026-10-10-architecture-audit.md` §11；未读取任何 `*scorecard-a*` 或 `score-ceiling-closeout.md`，未复制其他审计分数。

| 维度 | 分数 | 现场依据与扣分 |
|---|---:|---|
| 架构整洁度 | 8.3 | 课堂 tick 已收敛为 backend.solveFrame→V2；Circuit 480 行门面且不再直接组装 V1。仍保留旧 SimulationState、NodeBuilder 与 legacy 求解文件。 |
| 健壮性 | 8.4 | invalid 子步保持 `valid:false/backendUsed:v2` 并停止，不回退；reset 调 backend.reset；V2 成功、奇异/不收敛结果都有 meta。异常仍被吞为泛化 invalid，未做全量/浏览器回归。 |
| 解耦程度 | 8.2 | V2 snapshot、SimulationStateV2、ViewMap 与 live 元件分离；wrapSolverBackend 是 identity。服务仍接收完整 Circuit context，交互方法仍安装到实例并共享宿主。 |
| 可扩展性 | 8.3 | V2 factory/duck 与 kernel 边界清楚，组件 registry 路径可扩展；双 NodeBuilder、类型分支及 V1/V2 模型漂移仍增加新增器件成本。 |
| 可维护性 | 8.2 | 单求解路径、实例级交互安装、meta 契约和 58 项焦点测试降低维护成本；MNASolver/NetlistBuilder/ResultProjection 等遗留资产和跨服务缓存仍需追踪。 |
| 兼容性代价（越低越好） | 2.8 | 课堂不再支付 V1/V2 运行时回退税；仍维护 legacy MNASolver、双 NodeBuilder、旧 Circuit 状态/API 与兼容状态栏字段。 |
| 综合 | **8.3** | (8.3 + 8.4 + 8.2 + 8.3 + 8.2) / 5 = 8.28，四舍五入一位。 |

## 现场测量

1. `wc -l src/core/runtime/Circuit.js` = **480**。
2. Circuit 不 import MNASolver；无 solver getter/setter、无 `_solver` 字段；运行时使用注入的 `solverBackend`。
3. `rg MNASolver src --glob '*.js'`：仅 `src/core/simulation/MNASolver.js` 生产目录仍命名它（定义文件）。
4. `CircuitSimulationLoopService.runStep` 仅调用 `solveFrame`；invalid arm 调 `noteAdaptive`，结果钉 `backendUsed:'v2'` 后停止；无 `restoreStandby/setCircuit/commitV1Substep`。
5. `createInjectedSolverBackend` 是 v2-only duck，无 v1 arm；`solveFrame` 将 `solveResult.meta` 复制到返回 frame。
6. `wrapSolverBackend` 为 identity；无 wrap/copy/restoreStandby。
7. Embed 未显式 `solver=` 时钉 `'v2'`；显式 v2 亦为 v2。
8. Circuit.step 不调用 `updateComponentDisplayValues/applyStepResults`，只保存 frame、诊断并通知。
9. `resetRuntimeCaches` 经服务调用 `solverBackend.reset()`。
10. `installInteractionMethodMaps(this)` 把方法写入实例；未发现写入 `InteractionManager.prototype` 的剩余 `Object.assign`。
11. 双 NodeBuilder wrapper 仍在：core `NodeBuilder` 与 v2 `NodeBuilderV2`，共享 `buildElectricalNodes` 但几何/写回契约不同。
12. SolveCircuitV2 头部明确 classroom-reachable（非 tests-only）；成功及 singular/invalid/non-converged 路径均返回 `meta:{converged,iterations,maxIterations}`。
13. Circuit 不 import/construct `CircuitResultProjectionService` 或 `NetlistBuilder`；仍 import/construct legacy `SimulationState`。
14. adaptive 读取 `results.meta.iterations/maxIterations/converged`；指定 shipped-factory adaptive 测试（含由 iteration meta 增长 dt）通过。

## 验证

执行：
`npx vitest run tests/app.solverBackend.spec.js tests/app.solverBackend.defaultOn.spec.js tests/circuit.facadeDelegation.spec.js tests/interaction.methodMaps.spec.js tests/embedRuntimeBridge.spec.js tests/circuit.adaptiveTimestep.spec.js tests/circuit.resultProjectionDelegation.spec.js tests/solver.netlistPath.spec.js`

结果：**8 files / 58 tests passed**。未运行全量测试、浏览器 E2E 或 golden 电气基线。剩余 live-graph burdens 是双拓扑包装、legacy 状态/solver 文件、完整 Circuit context 耦合及异常信息泛化。
