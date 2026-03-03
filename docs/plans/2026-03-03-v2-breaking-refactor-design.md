# V2 Breaking Refactor Design (No Compatibility Mode)

Date: 2026-03-03  
Project: `HighSchoolCircuitSimulation`  
Decision: 执行一次不保留兼容路径的 v2 破坏性重构，目标是最大化清债并建立长期可维护架构。

## 1. 目标与边界

本次重构目标不是平滑升级，而是结构性清债。核心目标：

1. 干净整洁：删除历史兼容桥接、fallback 双轨、遗留镜像写回。
2. 健壮：建立可验证的错误模型、边界规则和稳定求解链。
3. 解耦：参数模型、运行态、求解器、UI 完全分层。
4. 易扩展：新增器件只改 manifest/registry，不改核心 orchestrator。

明确边界：

1. 不保留旧存档兼容，不提供自动迁移器。
2. 不保留旧 runtime mode 字段兼容路径。
3. 不保留 Observation legacy contract 兜底访问。
4. 不保留多协议 AI 兼容分支（收敛到单协议）。

## 2. 破坏性变更声明（Breaking Contract）

v2 发布后立即生效：

1. 存档协议升级为 `schema v3`，拒绝 `v2 及以下` 存档。
2. 删除所有 legacy alias、deprecated schema 字段读取分支。
3. 交互模式唯一真相保持为 `interactionModeStore.context`，禁止 root 字段回退读取。
4. AI API 仅支持单协议（Responses API）与单端点规范。

非目标（Out of Scope）：

1. 新增教学功能。
2. 新物理模型。
3. UI 风格重设计。

## 3. 目标架构

采用五层架构，严格单向依赖：

1. `ui`：纯渲染和事件采集。
2. `app`：use-case 编排层。
3. `domain`：电路语义、组件定义、拓扑规则。
4. `simulation`：纯求解内核（MNA + 动态积分）。
5. `infra`：存储、序列化、AI 接口、日志。

约束规则：

1. `ui -> app -> domain/simulation -> infra` 单向依赖。
2. `simulation` 禁止引用 DOM、浏览器 API 和 UI 类型。
3. type 分发仅允许出现在 registry/manifest 层。

## 4. 核心模块重组

### 4.1 Circuit 重组

将当前 `Circuit` 职责拆为：

1. `CircuitAggregate`：静态电路模型（组件、导线、探针）。
2. `TopologyCoordinator`：节点构建、连通性、拓扑校验。
3. `SimulationCoordinator`：步进执行、状态推进、结果快照。
4. `DiagnosticsService`：运行时诊断聚合。
5. `PersistenceFacade`：导入导出流程门面。

`Circuit` 仅保留薄门面，过渡期后可直接删去。

### 4.2 Component 重组

拆分 `src/components/Component.js`：

1. `component-manifest/`：默认参数、端子定义、显示名称。
2. `component-factory/`：实例创建（不含渲染逻辑）。
3. `component-renderers/`：每类器件单文件 renderer。
4. `component-display/`：读数显示策略和格式化策略。

### 4.3 Solver 重组

建立纯函数求解边界：

```txt
solve(netlistDTO, simulationState, options) -> solveResultDTO
```

禁止：

1. 求解器改写组件对象。
2. 求解器读取 UI 几何对象。
3. netlist 内携带原始组件引用。

## 5. 数据流与状态模型

采用双状态容器：

1. `CircuitModel`：静态参数状态（可持久化）。
2. `SimulationState`：动态历史状态（运行时）。

标准数据流：

1. UI 触发 use-case。
2. app 读取 `CircuitModel`，构建 `NetlistDTO`。
3. simulation 执行 `solve(...)`。
4. 产出 `SolveResultDTO` + `nextSimulationState`。
5. `ResultProjector` 生成只读 `ViewModel`。
6. UI 渲染 ViewModel（禁止反写 domain）。

强约束：

1. `SimulationState` 是唯一运行态可变对象。
2. 组件参数对象在运行期间只读。
3. 显示值（I/V/P）归属 ViewModel，不写回参数实体。

## 6. 错误模型与诊断

统一结构化错误对象：

```txt
{
  code: string,
  severity: "info" | "warn" | "error" | "fatal",
  message: string,
  hints: string[],
  context: Record<string, unknown>
}
```

错误码分层：

1. `TOPO_*`：拓扑和连接问题。
2. `SIM_*`：求解、收敛、参数非法问题。
3. `IO_*`：导入导出与 schema 校验问题。
4. `AI_*`：AI 请求与响应问题。

UI 只消费结构化错误，不拼接业务语句。

## 7. 质量门禁（V2）

### 7.1 Architecture Gates

1. 边界规则 lint（违规即 fail）。
2. `simulation` 禁止 `window/document/localStorage`。
3. 单文件上限 `<= 800` 行。
4. 禁止本地 `safeInvokeMethod` 重复实现（统一 RuntimeSafety）。

### 7.2 Domain/Simulation Gates

1. registry 覆盖率 100%（所有组件类型）。
2. 求解守恒性质测试（KCL/KVL 容差）。
3. 动态元件稳定性测试（RC/RL/二极管/继电器）。

### 7.3 Contract Gates

1. `schema v3` 严格校验（无 legacy alias）。
2. use-case 输入输出契约快照测试。

### 7.4 E2E Gates

1. 保留关键教学主路径 E2E。
2. 删除所有 legacy 行为 E2E 断言。

## 8. 评分卡（当前 vs v2目标）

评分标准：10 分制；`兼容性代价`越高越差。

| 维度 | 当前基线 | v2 目标 |
|---|---:|---:|
| 架构整洁度 | 7.2 | 9.4 |
| 健壮性 | 8.6 | 9.2 |
| 解耦程度 | 6.8 | 9.5 |
| 可扩展性 | 7.1 | 9.6 |
| 可维护性 | 7.0 | 9.3 |
| 兼容性代价（越低越好） | 7.8 | 1.5 |
| 综合评分 | 7.3 | 9.4 |

v2 达标阈值（发布前必须满足）：

1. 架构整洁度 >= 9.2
2. 解耦程度 >= 9.3
3. 可扩展性 >= 9.5
4. 健壮性 >= 9.0
5. 兼容性代价 <= 2.0
6. 综合 >= 9.3

## 9. 8周实施路线图

### Week 1-2: 架构骨架与门禁先行

1. 建立 v2 分层目录与依赖规则。
2. 接入 Architecture Gates（边界、文件体积、禁用 API）。
3. 清理 legacy 文档与脚本入口。

### Week 3-4: 核心数据边界重建

1. 纯 `NetlistDTO` 与 `SolveResultDTO` 落地。
2. `SimulationState` 独立化，禁止组件回写。
3. `Circuit` 拆分为协调器群组。

### Week 5: 组件系统拆分

1. `Component.js` 拆分为 manifest/factory/renderers/display。
2. 新增组件接入改为 registry 驱动。

### Week 6: app 层重编排

1. `main.js` 收敛为 composition root。
2. use-case 编排替代直接跨层调用。

### Week 7: AI 路径收敛

1. OpenAI 客户端协议单一化。
2. 删除多端点兼容 fallback 分支。

### Week 8: 收口与发布候选

1. 全量门禁与基准回归。
2. 修复尾部缺陷，冻结发布候选。
3. 生成 v2 发布说明（明确不兼容声明）。

## 10. 风险与控制

主要风险：

1. 破坏性重构导致短期开发停滞。
2. 测试语义从“兼容行为”切到“新契约行为”时出现盲区。
3. 拆分过程引入隐藏性能回退。

控制措施：

1. 阶段性冻结（每周设 Cutline）。
2. 每阶段必跑门禁 + 基准命令。
3. 以 DTO 契约测试锁住边界行为。
4. 每周输出一次债务与评分复盘。

## 11. Definition of Done

v2 完成定义：

1. 无 legacy/fallback 兼容路径。
2. `CircuitModel` 与 `SimulationState` 清晰分离。
3. 求解器为纯 netlist/state 输入输出。
4. 核心文件无超预算，架构门禁全绿。
5. 综合评分达到 9.3+，可扩展性达到 9.5+。

## 12. 下一步

基于本设计，后续执行顺序：

1. 生成 `v2` 详细实施计划（任务粒度到文件级）。
2. 创建隔离分支并开启 Week 1-2 实施。
3. 首轮落地后进行评分复盘并更新本设计文档。

## 13. 执行状态（Execution Tracking）

执行记录统一写入：

1. `docs/plans/2026-03-03-v2-breaking-refactor-execution-log.md`

执行原则：

1. 每完成一个 Task，更新一次状态、验证命令、结论与下一步。
2. 若出现阻塞，记录阻塞原因、影响范围、临时决策。
3. 所有“已完成”结论必须附带可复现验证命令。
