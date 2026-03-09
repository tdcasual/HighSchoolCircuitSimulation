# 可维护性治理总方案设计（Maintainability Governance Design）

Date: 2026-03-08  
Project: `HighSchoolCircuitSimulation`

## 1. 背景与默认假设

本方案基于以下默认假设设计：

1. 目标是**提升长期可维护性**，而不是增加新功能。
2. 改造期间以**行为等价、用户体验不回退**为硬约束。
3. 允许做结构性重组、目录重排、公共能力抽离、CI 门禁增强。
4. 采用 **6-8 周渐进式治理**，而不是一次性推翻重写。

截至本次设计时，仓库已经具备较强的工程基础：

- 测试规模大且覆盖面广，`npm test` 当前可通过。
- 已存在架构门禁、core-size 门禁、bundle 预算、debt dashboard、E2E 工作流。
- `Circuit`、`MNASolver`、`ChartWindowController` 等热点文件已有服务化/模块化前置基础。

但当前也存在会持续拉高变更成本的问题：

- `lint` 当前非全绿，存在真实的分层越界。
- `ChartWindowController` 已超过现有体积预算。
- `Circuit.js` 接近体积上限，`MNASolver.js` 也已成为新的大文件热点。
- `ai -> app`、`app/ui -> components` 的公共能力放置位置不合理，导致边界规则和真实依赖不一致。

这意味着：项目已经不是“缺流程”，而是“需要把已有流程与代码结构重新对齐”。

---

## 2. 现状诊断

### 2.1 当前最关键的维护性症状

1. **边界规则与实现事实不一致**
   - `src/ai/OpenAIClientV2.js` 依赖 `src/app/AppStorage.js` 与 `src/app/RuntimeStorageRegistry.js`。
   - `src/app/RuntimeActionRouter.js` 依赖 `src/components/Component.js` 的 ID 计数器能力。
   - `src/ui/interaction/HistoryManager.js` 同样直接依赖 `src/components/Component.js` 的 ID 更新逻辑。
   - 这些都说明“共享基础设施”被放在了业务层或组件层，导致边界规则虽存在，但代码被迫越层。

2. **热点文件仍然承担过多职责**
   - `src/core/runtime/Circuit.js` 同时负责：拓扑批处理、探针管理、仿真编排、诊断、流向分析、序列化桥接、短路辅助逻辑。
   - `src/core/simulation/MNASolver.js` 同时负责：矩阵装配、非线性线性化、动态求解编排、求解器状态更新。
   - `src/ui/charts/ChartWindowController.js` 同时负责：DOM 创建、状态编辑、拖拽/缩放、绘制、绑定配置。

3. **治理指标存在，但没有形成“统一维护性回路”**
   - 目前已有 `lint`、`check:core-size`、`check:bundle-size`、`report:debt-dashboard`。
   - 但这些指标仍偏分散，缺少一个统一的“maintainability contract”。
   - 团队知道有哪些问题，但还没有一个把“热点下降 / 越界归零 / 预算收紧 / shim 删除”连成闭环的治理方案。

### 2.2 根因判断

根因不是“代码写得差”，而是以下三类结构性问题叠加：

1. **共享能力落层错误**：存储、ID 分配、局部 wrapper 等基础能力没有沉到 `utils` 或专用 infra 层。
2. **Facade 成功但收尾不足**：此前重构已经把部分职责抽出为 service / adapter，但 `Circuit`、`MNASolver`、`ChartWindowController` 仍保留过大编排体积。
3. **治理机制缺少阶段性目标**：已有 guard 更像“止血”，还没升级为“逐期收紧的维护性治理体系”。

---

## 3. 备选方案与推荐结论

### 方案 A：轻量卫生修复（不推荐）

做法：只修当前 lint 报错和超预算文件，不调整治理模型。

优点：

- 见效快。
- 对当前分支扰动最小。

缺点：

- 只能修“表层症状”，不能防止 2-4 周后再次回潮。
- 公共能力仍会继续游离在错误层级。
- 团队会持续陷入“修一个红灯、再冒出另一个红灯”的循环。

### 方案 B：渐进式维护性治理计划（推荐）

做法：把这次改造定义为**行为等价的结构治理项目**，分四条主线推进：

1. 公共基础设施归位（storage / id / shared helper）。
2. 热点文件服务化拆分（Chart / Circuit / Solver）。
3. 统一维护性门禁（dashboard + budget + CI contract）。
4. 删除临时 shim，逐期收紧预算。

优点：

- 与当前仓库已有的服务化、v2、CI guard 思路完全兼容。
- 风险可控，适合按 slice 推进。
- 既能修今天的问题，也能降低未来迭代成本。

缺点：

- 需要 6-8 周持续治理，不是一次性提交。
- 需要对“新功能插队”做一定约束。

### 方案 C：一次性大重写（不推荐）

做法：把 `src/` 目录重新分层，强行迁移到新目录树，并同时重命名大量模块。

优点：

- 理论上终态最整齐。

缺点：

- 风险最高。
- 与当前大量测试、文档、CI 绑定点冲突大。
- 极易把“可维护性改造”变成“长时间冻结业务迭代”。

### 推荐结论

采用 **方案 B：渐进式维护性治理计划**。

核心理由：这个仓库已经证明“拆服务 + 加 guard + 文档化决策”是有效路径，因此最优解不是另起炉灶，而是把这条路径走完整。

---

## 4. 推荐方案总览

本方案把可维护性定义为四个同时闭环的治理回路：

### 4.1 结构回路（Structure Loop）

目标：让依赖方向、职责边界、热点体积持续向好的方向收敛。

措施：

- 把共享存储与共享 ID 能力迁到 `src/utils/`。
- 把热点 façade 中仍然膨胀的职责继续下沉到 service / controller。
- 引入新的 hotspot 预算，逐期收紧，而不是长期停留在“warning 但允许”。

### 4.2 交付回路（Delivery Loop）

目标：确保每一次治理切片都可验证、可回退、可审计。

措施：

- 每个治理任务必须配套单测/回归/E2E 的最小验证集合。
- 每个阶段都要产出 debt dashboard 快照。
- 所有热点拆分都要求“行为等价 + 基线无漂移”。

### 4.3 可见性回路（Visibility Loop）

目标：让维护成本趋势可以被看见，而不是靠体感判断。

措施：

- 扩展 `report:debt-dashboard`：加入 lint 越界数、热点预算占用、bundle 趋势、shim 存量、重复 helper 数。
- 新增统一的 `check:maintainability` 门禁，作为 dashboard 的执行契约，而不是仅生成报告。

### 4.4 清债回路（Removal Loop）

目标：防止“抽离后永远保留兼容层”。

措施：

- 所有 compatibility re-export 必须附带删除阶段。
- 每一轮治理都要明确：哪些 shim 本轮引入、哪些 shim 下轮删除。
- Dashboard 增加“shim inventory”指标，用于追踪未收尾点。

---

## 5. 目标架构（Maintainability-Oriented Target Architecture）

### 5.1 目录层职责

保持当前目录大框架不推倒，但明确职责边界：

1. `src/ui/`
   - 只负责 DOM、SVG、用户交互、展示态。
   - 不承载存储协议、ID 分配、求解逻辑。

2. `src/app/`
   - 只负责工作流编排与运行时入口。
   - 不承载共享基础设施实现。

3. `src/core/`
   - 只负责拓扑、仿真、诊断、序列化、运行时 façade。
   - 不直接依赖 DOM 或浏览器视图细节。

4. `src/components/`
   - 只负责元器件静态定义、几何、渲染辅助、工厂。
   - 不向 `app`/`ui` 输出全局基础设施能力。

5. `src/ai/`
   - 只负责 AI 请求、知识检索、教学解释。
   - 允许依赖 `utils`，不允许再直接依赖 `app`。

6. `src/utils/`
   - 只放跨域共享且无业务归属的能力：存储访问、ID 分配、坐标/日志/安全包装等。

7. `src/v2/`
   - 作为严格路径与下一阶段演进试验田，继续承接“无 legacy fallback”的高约束实现。

### 5.2 新的共享基础设施归位

#### A. Storage seam

新建：

- `src/utils/storage/StorageRegistry.js`
- `src/utils/storage/SafeStorage.js`

迁移结果：

- `src/ai/OpenAIClientV2.js` 不再 import `src/app/*`。
- `src/app/AppStorage.js` / `src/app/RuntimeStorageRegistry.js` 仅保留短期 re-export，下一阶段删除。

#### B. ID seam

新建：

- `src/utils/id/EntityIdCounter.js`

迁移结果：

- `src/components/factory/ComponentFactory.js` 使用共享 ID counter。
- `src/app/RuntimeActionRouter.js` 与 `src/ui/interaction/HistoryManager.js` 直接依赖 `utils/id`，不再穿透到 `components`。

### 5.3 热点 façade 继续瘦身

#### ChartWindowController

目标：让根控制器只保留生命周期与编排。

拆分为：

- `ChartWindowPointerController`：拖拽、缩放、全局 pointer session
- `ChartWindowBindingController`：source/quantity/legend/series 绑定编辑
- `ChartWindowCanvasView`：canvas resize、redraw、最新值与坐标轴绘制

#### Circuit

在已有 `CircuitTopologyService` / `CircuitSimulationLoopService` / `CircuitShortCircuitDiagnosticsService` 基础上，继续拆出：

- `CircuitTopologyValidationService`：冲突电源、无阻电容回路、浮空子图验证
- `CircuitFlowAnalysisService`：terminal/wire flow 计算与缓存
- `CircuitObservationProbeService`：probe id、probe CRUD、wire remap

终态要求：`Circuit` 仅负责状态容器、服务装配、对外 façade API。

#### MNASolver

保留 `MNASolver` 作为求解入口，但继续提炼：

- `SolverMatrixAssembler`：矩阵与向量装配、voltage source indexing
- `SolverConvergenceController`：牛顿迭代/收敛决策/失败 metadata

终态要求：`MNASolver` 只做 solve orchestration，不再承载细碎的矩阵装配与收敛细节。

---

## 6. 数据流与状态流约束

维护性方案不只拆文件，还要统一数据流规则：

1. **编辑态数据流**
   - `ui` 产生事件。
   - `app` 路由动作。
   - `core/runtime/Circuit` 更新模型与 topology dirty state。

2. **求解态数据流**
   - `Circuit` 准备 topology / netlist。
   - `MNASolver` 只消费 solver input + runtime state。
   - `ResultPostprocessor` / flow services 生成展示所需读数。
   - `ui` 只消费投影结果。

3. **运行时状态写入规则**
   - 动态状态优先写 `SimulationState` / `SimulationStateV2`。
   - 组件对象只保留参数与必要展示投影。
   - 临时 dual-write 必须显式标记，并在下一阶段删除。

4. **持久化规则**
   - 任意模块需要 `localStorage/sessionStorage` 时，统一走 `utils/storage`。
   - 禁止再次在 `app`、`ai`、`ui` 内部重复实现 safe storage wrapper。

---

## 7. 错误处理与回退策略

### 7.1 运行时错误模型

- 结构治理不改变用户行为，但要改变错误呈现方式：
  - 架构/依赖违规：CI fail。
  - 预算逼近：dashboard warn。
  - 预算超线：hard fail。
  - 重构期临时 shim：dashboard track + deadline。

### 7.2 回退策略

- 所有结构改造按 slice 提交，不做跨 5+ 领域的大合并。
- 所有 façade 拆分都保留外部 API 不变，先“内部迁移”，后“调用点收缩”。
- 任何 चरण 若触发基线偏移，优先回退该 slice，不把多个重构耦合在一起定位。

### 7.3 兼容层策略

- compatibility re-export 允许存在，但必须：
  1. 文件头标记 `@deprecated`。
  2. 在 implementation plan 中写明删除阶段。
  3. 出现在 debt dashboard 的 shim 清单里。

---

## 8. 测试与治理门禁设计

### 8.1 必须保留的现有门禁

- `npm test`
- `npm run lint`
- `npm run check:core-size`
- `npm run check:bundle-size`
- `npm run check:v2:boundaries`
- `npm run check:e2e`
- `npm run baseline:p0`
- `npm run baseline:circuitjs`
- `npm run baseline:ai`

### 8.2 新增的维护性契约

新增：`npm run check:maintainability`

职责：

1. 读取 debt dashboard JSON。
2. 校验 hard budget：
   - lint errors = 0
   - protected warnings = 0
   - hard-size failures = 0
   - bundle hard budget = 0 超线
   - shim inventory 不得增长
3. 输出统一结果：`[maintainability] ok|fail`

### 8.3 建议补充的测试类型

1. **wiring contract tests**
   - 校验 `package.json`、CI workflow、guard script 三方一致。

2. **hotspot decomposition tests**
   - 在 controller/service 级测试 delegation，而不是只测 façade。

3. **shared seam tests**
   - storage/id 公共能力必须有独立 spec，防止再次漂移到错误层。

---

## 9. 分阶段路线图

### Phase 0：恢复绿色基线（1 周）

目标：把当前“测试绿但治理不全绿”的状态收敛到可推进的基线。

输出：

- lint 全绿
- core-size 重新通过
- debt dashboard 扩展字段上线

### Phase 1：共享 seam 归位（1-2 周）

目标：消除最直接的越层依赖。

范围：

- storage seam
- id seam
- safe helper 去重

### Phase 2：UI 热点拆分（1-2 周）

目标：优先处理 `ChartWindowController`，因为它已实际超预算，且风险低于 `Circuit` / `MNASolver`。

### Phase 3：Runtime façade 瘦身（2 周）

目标：继续下沉 `Circuit` 剩余职责，降低其作为“上帝对象”的趋势。

### Phase 4：Solver 结构瘦身（1-2 周）

目标：把 `MNASolver` 收敛为 orchestration 类，降低未来新增元件和数值方法时的变更面。

### Phase 5：治理收口（1 周）

目标：收紧预算、删除 shim、把 dashboard 从观察模式切到 hard gate 模式。

---

## 10. 成功判定标准

### 10.1 硬指标

1. `npm run check` 全绿。
2. `npm run check:full` 全绿。
3. `check:maintainability` 全绿。
4. `ChartWindowController.js < 450` 行。
5. `Circuit.js < 1400` 行。
6. `MNASolver.js < 650` 行。
7. `dist/src/main.js <= 400 KiB`（短期）并逐步收紧到 `<= 360 KiB`（中期）。

### 10.2 软指标

1. 新增一个共享能力时，不再出现“应该放哪一层”的争议。
2. 新增一个元器件或一条交互逻辑时，修改文件数减少。
3. 大多数结构性改动不再需要触碰 `Circuit.js` / `MNASolver.js` / `ChartWindowController.js`。

---

## 11. 最终结论

这个项目当前最缺的不是再做一轮“大重构”，而是把已经验证有效的拆分路径继续完成，并把它升级成一个**可量化、可收紧、可删除临时层的维护性治理系统**。

推荐执行顺序：

1. 先修共享 seam（storage / id）。
2. 再拆 UI 热点（Chart）。
3. 再拆 runtime façade（Circuit）。
4. 最后拆 solver orchestration。
5. 用统一 `check:maintainability` 把结果锁住。

这条路径的关键价值是：

- 不推翻现有架构成果。
- 不牺牲当前稳定性与测试资产。
- 能把“可维护性”从主观判断，变成持续执行的工程契约。
