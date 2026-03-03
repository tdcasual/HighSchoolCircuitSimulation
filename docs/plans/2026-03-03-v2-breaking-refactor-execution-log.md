# V2 Breaking Refactor Execution Log

Date: 2026-03-03  
Plan: `docs/plans/2026-03-03-v2-breaking-refactor-implementation.md`

## Execution Assumptions

1. v2 为破坏性重构，不提供兼容迁移器。
2. v2 拒绝加载旧存档（schema v2 及以下）。
3. v2 运行时路径不保留 legacy/fallback 兼容分支。
4. 执行策略采用 task-by-task，单任务单提交，可回滚。

## Task Progress

### Task 0: Execution Workspace + Guardrails

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 已创建 execution log。
  - 已在 design 文档加入 execution tracking 入口。
  - Day 0 baseline 命令全部通过。

**Verification Commands**

```bash
npm run lint && npm test && npm run check:full
```

**Verification Summary**

1. `lint` 通过。
2. `test` 通过（180 files / 982 tests）。
3. `check:full` 通过：
   - `check` 通过（含 contract/registry/ci-workflow/core-size/lint/format/test）。
   - `check:e2e` 通过（wire/responsive/observation/ai-mobile）。
   - `baseline:p0` 通过（20 scenarios）。
   - `baseline:circuitjs` 通过（10 scenarios）。
   - `baseline:ai` 通过（3 scenarios）。

### Task 1: Add v2 architecture boundary guard

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `scripts/ci/assert-v2-architecture-boundaries.mjs`，用于扫描 `src/v2` 分层依赖方向。
  - 新增 `tests/ci.v2ArchitectureBoundaries.spec.js`，覆盖 package script、CI wiring 与脚本可执行性。
  - `package.json` 已注册 `check:v2:boundaries`，并接入 `check` 流水线。
  - `.github/workflows/ci.yml` 的 `quality` job 已增加 `Check v2 architecture boundaries` 步骤。

**Verification Commands**

```bash
npm test -- tests/ci.v2ArchitectureBoundaries.spec.js && npm run check:v2:boundaries
npm run check:ci-workflow
```

**Verification Summary**

1. `tests/ci.v2ArchitectureBoundaries.spec.js` 通过（3 tests）。
2. `check:v2:boundaries` 通过（当前 `src/v2` 尚不存在，输出 `ok (src/v2 not present yet)`）。
3. `check:ci-workflow` 通过（`[ci-workflow] ok`）。

### Task 2: Introduce v2 core-size budgets (<= 800 lines)

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/ci.v2CoreSizeBudget.spec.js`，先红灯验证预算脚本缺少 v2 条目。
  - `scripts/ci/assert-core-file-size-budget.mjs` 增加两类预算：
    - legacy transitional：保留 v1 核心文件预算；
    - v2 core：新增 `src/v2/**` 关键文件预算，统一 `<= 800`。
  - v2 预算条目在文件尚未落地时采用 `skip`，避免当前阶段误报失败。

**Verification Commands**

```bash
npm test -- tests/ci.v2CoreSizeBudget.spec.js && npm run check:core-size
npm test -- tests/observation.runtimeContractGuard.spec.js
```

**Verification Summary**

1. `tests/ci.v2CoreSizeBudget.spec.js` 通过（1 test）。
2. `check:core-size` 通过：
   - legacy transitional 预算正常；
   - `src/components/Component.js` 95%（warning）；
   - v2 预算条目当前均为 `skip (pending v2 core)`。
3. `tests/observation.runtimeContractGuard.spec.js` 通过（6 tests），确认未回退到 ObservationPanel 旧路径。

### Task 3: Enforce no local safeInvokeMethod in v2 scope

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/ci.v2RuntimeSafetyDedupe.spec.js`，先验证脚本 wiring 与 guard 约束（fail-first）。
  - 新增 `scripts/ci/assert-v2-runtime-safety-dedupe.mjs`：
    - 扫描 `src/v2/**` 中的 JS 文件；
    - 禁止本地 `function safeInvokeMethod(` 定义；
    - `src/v2` 尚未落地时输出 `ok (src/v2 not present yet)`。
  - `package.json` 已增加 `check:v2:runtime-safety` 并接入 `check` 流水线。
  - `scripts/ci/generate-debt-dashboard.mjs` 新增 `v2RuntimeSafety` 指标，单独统计 v2 域内重复定义债务。

**Verification Commands**

```bash
npm test -- tests/ci.v2RuntimeSafetyDedupe.spec.js && npm run check:v2:runtime-safety
npm test -- tests/debtDashboard.spec.js tests/runtimeSafety.dedupe.spec.js
```

**Verification Summary**

1. `tests/ci.v2RuntimeSafetyDedupe.spec.js` 通过（2 tests）。
2. `check:v2:runtime-safety` 通过（当前 `src/v2` 不存在，输出 `ok (src/v2 not present yet)`）。
3. `tests/debtDashboard.spec.js` 与 `tests/runtimeSafety.dedupe.spec.js` 全部通过（3 tests）。

### Task 4: Build pure NetlistDTO (remove source object references)

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/simulation.netlistBuilderV2.spec.js`（fail-first），锁定纯 DTO 契约：
    - `meta.version = 2`
    - `nodes` 统一输出 `{ id }`
    - `components` 仅含 `id/type/nodes/params`
    - 不允许 `source` 引用与函数值进入 DTO
  - 新增 `src/v2/simulation/NetlistBuilderV2.js`，实现纯对象深度规整（仅 primitive/plain object）。
  - `src/core/simulation/NetlistBuilder.js` 增加 `@deprecated` 注释，标明 v1 为 legacy path。

**Verification Commands**

```bash
npm test -- tests/simulation.netlistBuilderV2.spec.js
npm run check:v2:boundaries
npm run check:v2:runtime-safety
```

**Verification Summary**

1. `tests/simulation.netlistBuilderV2.spec.js` 通过（2 tests）。
2. `check:v2:boundaries` 通过（`[v2-architecture] ok`）。
3. `check:v2:runtime-safety` 通过（`[v2-runtime-safety] ok`）。

### Task 5: Introduce immutable CircuitModel APIs

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/domain.circuitModelV2.spec.js`（fail-first），覆盖：
    - `addComponent/removeComponent/addWire/removeWire` 返回新模型并递增 `version`；
    - 外部不可直接改写内部 `Map` 与实体对象。
  - 新增 `src/v2/domain/CircuitModel.js`：
    - 封装 `components/wires/version`；
    - 提供只读快照 getter 与 `withState` 复制更新入口；
    - 内部对对象/Map 做深拷贝规整。
  - 新增 `src/v2/domain/CircuitModelCommands.js`：
    - 实现 v2 命令式更新 API（返回新 `CircuitModel`）；
    - `removeComponent` 同步清理关联导线。

**Verification Commands**

```bash
npm test -- tests/domain.circuitModelV2.spec.js
npm run check:v2:boundaries
npm run check:v2:runtime-safety
```

**Verification Summary**

1. `tests/domain.circuitModelV2.spec.js` 通过（2 tests）。
2. `check:v2:boundaries` 通过（`[v2-architecture] ok`）。
3. `check:v2:runtime-safety` 通过（`[v2-runtime-safety] ok`）。

### Task 6: Add schema v3 strict validator (no legacy aliases)

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/circuitSchema.v3.spec.js`（fail-first）：
    - 接受 canonical schema v3；
    - 拒绝 legacy 字段 `templateName / bindingMap / pendingToolType`；
    - 拒绝 legacy wire alias（`start/end`）与未知顶层字段。
  - 新增 `src/v2/infra/io/CircuitSchemaV3.js`，实现 `validateCircuitV3(payload)` 严格校验：
    - 顶层/子对象白名单键约束；
    - 版本必须为 v3；
    - 全量 legacy alias 递归禁用。
  - 新增 `src/v2/infra/io/CircuitDeserializerV3.js`：
    - 反序列化前强制走 `validateCircuitV3`；
    - 仅接受 canonical 字段并输出规范化 DTO。

**Verification Commands**

```bash
npm test -- tests/circuitSchema.v3.spec.js
npm run check:v2:boundaries
npm run check:v2:runtime-safety
```

**Verification Summary**

1. `tests/circuitSchema.v3.spec.js` 通过（3 tests）。
2. `check:v2:boundaries` 通过（`[v2-architecture] ok`）。
3. `check:v2:runtime-safety` 通过（`[v2-runtime-safety] ok`）。

### Task 7: Add SimulationStateV2 as sole runtime mutable state

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/simulation.stateV2.spec.js`（fail-first），覆盖：
    - `ensure/applyPatch` 行为可预测；
    - `reset` 支持按组件描述重建状态与清空状态；
    - 不回写传入组件对象字段。
  - 新增 `src/v2/simulation/SimulationStateV2.js`：
    - Map-based 状态容器（`byId`）；
    - 组件类型默认状态工厂；
    - 提供 `ensure/get/applyPatch/reset` 运行态 API。

**Verification Commands**

```bash
npm test -- tests/simulation.stateV2.spec.js
npm run check:v2:boundaries
npm run check:v2:runtime-safety
```

**Verification Summary**

1. `tests/simulation.stateV2.spec.js` 通过（3 tests）。
2. `check:v2:boundaries` 通过（`[v2-architecture] ok`）。
3. `check:v2:runtime-safety` 通过（`[v2-runtime-safety] ok`）。

### Task 8: Implement pure solve entrypoint

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/solver.v2.purity.spec.js`（fail-first）：
    - `solveCircuitV2` 仅接受 DTO + state + options；
    - 不改写输入 DTO（含潜在 `source` 泄漏字段）。
  - 新增 `tests/solver.v2.commonCases.spec.js`（fail-first）：
    - 验证基准算例（3V + 2Ω 内阻电源串 8Ω 负载）输出稳定。
  - 新增 `src/v2/simulation/SolveCircuitV2.js`：
    - 纯函数求解入口，输入 DTO，内部深拷贝后构建 MNA 线性系统；
    - 支持线性电阻 + 电源（含内阻诺顿等效与理想电压源）；
    - 输出 `{valid, voltages, currents, nextState, diagnostics}`。
  - 新增 `src/v2/simulation/ResultPostprocessorV2.js`：
    - 独立计算分支电流映射，避免依赖 legacy component source。

**Verification Commands**

```bash
npm test -- tests/solver.v2.purity.spec.js tests/solver.v2.commonCases.spec.js
npm run check:v2:boundaries
npm run check:v2:runtime-safety
```

**Verification Summary**

1. `tests/solver.v2.purity.spec.js` 与 `tests/solver.v2.commonCases.spec.js` 全通过（2 tests）。
2. `check:v2:boundaries` 通过（`[v2-architecture] ok`）。
3. `check:v2:runtime-safety` 通过（`[v2-runtime-safety] ok`）。

### Task 9: Add ResultProjector (ViewModel-only display values)

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/app.resultProjectorV2.spec.js`（fail-first）：
    - 输入 solve result + circuit model，输出只读 `ViewModel`；
    - 缺失电流时标记 `disconnected`；
    - 不允许回写 component 参数对象。
  - 新增 `src/v2/app/ResultProjector.js`：
    - 投影 `voltage/current/power/status`；
    - 将诊断统一映射为 UI 只读结构；
    - 不改写 domain model。

**Verification Commands**

```bash
npm test -- tests/app.resultProjectorV2.spec.js
npm run check:v2:boundaries
npm run check:v2:runtime-safety
```

**Verification Summary**

1. `tests/app.resultProjectorV2.spec.js` 通过（2 tests）。
2. `check:v2:boundaries` 通过（`[v2-architecture] ok`）。
3. `check:v2:runtime-safety` 通过（`[v2-runtime-safety] ok`）。

### Task 10: Add v2 coordinators and one-step use case

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/app.runSimulationStepV2.spec.js`（fail-first），覆盖：
    - 单步仿真链路返回 `solveResult + projection + diagnostics + nextState`；
    - 基准串联算例输出电流结果可用。
  - 新增 `src/v2/app/coordinators/TopologyCoordinatorV2.js`：
    - 从 `CircuitModel` 收敛组件集合并构建 `NetlistDTO`。
  - 新增 `src/v2/app/coordinators/SimulationCoordinatorV2.js`：
    - 封装 `solveCircuitV2` 调用与 state 透传。
  - 新增 `src/v2/app/usecases/RunSimulationStepV2.js`：
    - 串联 `CircuitModel -> NetlistBuilderV2 -> SolveCircuitV2 -> ResultProjector`。

**Verification Commands**

```bash
npm test -- tests/app.runSimulationStepV2.spec.js
npm run check:v2:boundaries
npm run check:v2:runtime-safety
```

**Verification Summary**

1. `tests/app.runSimulationStepV2.spec.js` 通过（1 test）。
2. `check:v2:boundaries` 通过（`[v2-architecture] ok`）。
3. `check:v2:runtime-safety` 通过（`[v2-runtime-safety] ok`）。

### Task 11: Extract component manifest and factory v2

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/components.manifestV2.spec.js`（fail-first），覆盖：
    - v2 manifest 覆盖全量组件类型；
    - terminal count / default params 可读；
    - factory 可基于 manifest 创建组件实例。
  - 新增 `src/v2/domain/components/ComponentManifest.js`：
    - 提供 `COMPONENT_MANIFEST_V2`、`listComponentTypesV2`、`getComponentManifestV2`。
  - 新增 `src/v2/domain/components/createComponentV2.js`：
    - 提供 v2 组件工厂和独立 ID 计数器管理 API。

**Verification Commands**

```bash
npm test -- tests/components.manifestV2.spec.js
npm run check:v2:boundaries
npm run check:v2:runtime-safety
```

**Verification Summary**

1. `tests/components.manifestV2.spec.js` 通过（3 tests）。
2. `check:v2:boundaries` 通过（`[v2-architecture] ok`）。
3. `check:v2:runtime-safety` 通过（`[v2-runtime-safety] ok`）。

### Task 12: Split renderers by type-group

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/ui.rendererRegistryV2.spec.js`（fail-first），覆盖：
    - registry 按类型返回 renderer；
    - 未注册类型抛明确错误；
    - 保留待迁移类型 TODO 清单。
  - 新增 `src/v2/ui/renderers/base/SvgPrimitives.js`，抽象基础图元描述。
  - 新增分组渲染模块：
    - `src/v2/ui/renderers/electrical/PassiveRenderers.js`
    - `src/v2/ui/renderers/electrical/SourceRenderers.js`
    - `src/v2/ui/renderers/controls/SwitchRenderers.js`
  - 新增 `src/v2/ui/renderers/RendererRegistryV2.js`，迁移首批 6 个高频类型：
    - `PowerSource / Resistor / Switch / Capacitor / Inductor / Voltmeter`。

**Verification Commands**

```bash
npm test -- tests/ui.rendererRegistryV2.spec.js
npm run check:v2:boundaries
npm run check:v2:runtime-safety
```

**Verification Summary**

1. `tests/ui.rendererRegistryV2.spec.js` 通过（3 tests）。
2. `check:v2:boundaries` 通过（`[v2-architecture] ok`）。
3. `check:v2:runtime-safety` 通过（`[v2-runtime-safety] ok`）。

### Task 13: Add v2 composition root and runtime bootstrap

- Status: completed
- Started: 2026-03-03
- Completed: 2026-03-03
- Notes:
  - 新增 `tests/app.bootstrapV2.spec.js`（fail-first），覆盖：
    - `bootstrapV2` 可注册 app factory 并产出 runtime contract；
    - `main.js` 入口改为委派给 `bootstrapV2`；
    - `bootstrapV2` 不直接拼装 v1 monolith 依赖。
  - 新增 `src/v2/main/AppCompositionRootV2.js` 与 `src/v2/main/bootstrapV2.js`。
  - 修改 `src/main.js` 启动路径：由 `registerAppBootstrap` 直连切换为 `bootstrapV2`。

**Verification Commands**

```bash
npm test -- tests/app.bootstrapV2.spec.js tests/aiPanel.lazyLoad.spec.js
npm run check:v2:boundaries
npm run check:v2:runtime-safety
```

**Verification Summary**

1. `tests/app.bootstrapV2.spec.js` 与 `tests/aiPanel.lazyLoad.spec.js` 全通过（4 tests）。
2. `check:v2:boundaries` 通过（`[v2-architecture] ok`）。
3. `check:v2:runtime-safety` 通过（`[v2-runtime-safety] ok`）。
