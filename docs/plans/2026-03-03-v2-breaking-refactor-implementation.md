# V2 Breaking Refactor (No Compatibility Mode) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 8 周内完成 v2 破坏性重构，彻底移除兼容路径，落地纯 netlist/state 求解边界与分层架构门禁。  

**Architecture:** 采用“门禁先行 -> 数据边界重建 -> 组件系统拆分 -> 应用编排重构 -> AI 单协议收敛 -> 发布收口”的执行顺序。所有实现按 TDD 推进，先写失败测试，再做最小实现，再扩展。每个任务独立提交，保持可回滚粒度。  

**Tech Stack:** Vanilla JS (ESM), Vitest, Playwright, ESLint boundaries, Node CI scripts, existing `npm run check:full` + baseline commands.

---

## Pre-flight (Day 0)

### Task 0: Execution Workspace + Guardrails

**Files:**
- Modify: `docs/plans/2026-03-03-v2-breaking-refactor-design.md`
- Create: `docs/plans/2026-03-03-v2-breaking-refactor-execution-log.md`

**Step 1: Record execution assumptions**
- 在 execution log 中写明：v2 不兼容、无迁移器、拒绝旧存档。

**Step 2: Run baseline snapshot**
Run: `npm run lint && npm test && npm run check:full`  
Expected: PASS，输出作为 Day 0 基线证据。

**Step 3: Commit**
```bash
git add docs/plans/2026-03-03-v2-breaking-refactor-design.md docs/plans/2026-03-03-v2-breaking-refactor-execution-log.md
git commit -m "docs(v2): add execution log and baseline assumptions"
```

## Week 1-2: Architecture Gates First

### Task 1: Add v2 architecture boundary guard

**Files:**
- Create: `scripts/ci/assert-v2-architecture-boundaries.mjs`
- Create: `tests/ci.v2ArchitectureBoundaries.spec.js`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Step 1: Write failing guard test**
```js
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('v2 architecture boundary guard wiring', () => {
  it('registers check:v2:boundaries script', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts['check:v2:boundaries']).toBeDefined();
  });
});
```

**Step 2: Run test to verify fail**
Run: `npm test -- tests/ci.v2ArchitectureBoundaries.spec.js`  
Expected: FAIL (script/CI wiring missing).

**Step 3: Minimal implementation**
- 新建 guard 脚本，静态检查 v2 目录依赖方向：
  - `src/v2/ui` 只能依赖 `src/v2/app` 和 `src/v2/ui`。
  - `src/v2/simulation` 禁止依赖 `window/document/localStorage`。
- 在 `package.json` 增加 `check:v2:boundaries`。
- 在 CI quality job 增加该检查步骤。

**Step 4: Run verification**
Run: `npm test -- tests/ci.v2ArchitectureBoundaries.spec.js && npm run check:v2:boundaries`  
Expected: PASS.

**Step 5: Commit**
```bash
git add scripts/ci/assert-v2-architecture-boundaries.mjs tests/ci.v2ArchitectureBoundaries.spec.js package.json .github/workflows/ci.yml
git commit -m "build(ci): add v2 architecture boundary guard"
```

### Task 2: Introduce v2 core-size budgets (<= 800 lines)

**Files:**
- Modify: `scripts/ci/assert-core-file-size-budget.mjs`
- Create: `tests/ci.v2CoreSizeBudget.spec.js`

**Step 1: Write failing test**
```js
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('v2 core size budget', () => {
  it('contains v2 budget entries', () => {
    const content = readFileSync('scripts/ci/assert-core-file-size-budget.mjs', 'utf8');
    expect(content).toContain('src/v2');
    expect(content).toContain('800');
  });
});
```

**Step 2: Run fail-first**
Run: `npm test -- tests/ci.v2CoreSizeBudget.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 在预算脚本新增 v2 关键文件预算项（全部 `<= 800`）。
- 保留 v1 预算但标记为“legacy transitional”。

**Step 4: Verify**
Run: `npm test -- tests/ci.v2CoreSizeBudget.spec.js && npm run check:core-size`  
Expected: PASS（允许 warning，但不允许超预算）。

**Step 5: Commit**
```bash
git add scripts/ci/assert-core-file-size-budget.mjs tests/ci.v2CoreSizeBudget.spec.js
git commit -m "build(ci): add v2 core file size budgets"
```

### Task 3: Enforce no local safeInvokeMethod in v2 scope

**Files:**
- Modify: `scripts/ci/generate-debt-dashboard.mjs`
- Create: `scripts/ci/assert-v2-runtime-safety-dedupe.mjs`
- Create: `tests/ci.v2RuntimeSafetyDedupe.spec.js`
- Modify: `package.json`

**Step 1: Write failing test**
- 断言 `check:v2:runtime-safety` 脚本已定义。
- 断言 guard 脚本检查 `src/v2/**` 不允许本地 `function safeInvokeMethod(`。

**Step 2: Run fail-first**
Run: `npm test -- tests/ci.v2RuntimeSafetyDedupe.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 新增 guard 脚本扫描 `src/v2`。
- `package.json` 新增 `check:v2:runtime-safety`。
- `check` 链接入该脚本。

**Step 4: Verify**
Run: `npm test -- tests/ci.v2RuntimeSafetyDedupe.spec.js && npm run check:v2:runtime-safety`  
Expected: PASS.

**Step 5: Commit**
```bash
git add scripts/ci/assert-v2-runtime-safety-dedupe.mjs scripts/ci/generate-debt-dashboard.mjs tests/ci.v2RuntimeSafetyDedupe.spec.js package.json
git commit -m "build(ci): enforce v2 runtime safety dedupe guard"
```

## Week 2-3: Data Contracts And Pure DTO

### Task 4: Build pure NetlistDTO (remove source object references)

**Files:**
- Create: `src/v2/simulation/NetlistBuilderV2.js`
- Create: `tests/simulation.netlistBuilderV2.spec.js`
- Modify: `src/core/simulation/NetlistBuilder.js` (deprecate path comment only)

**Step 1: Write failing tests**
- DTO 仅包含 primitive/plain object。
- 不包含 `source` 字段和函数引用。

**Step 2: Run fail-first**
Run: `npm test -- tests/simulation.netlistBuilderV2.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
```js
// NetlistBuilderV2 output shape:
// { meta, nodes: [{id}], components: [{id,type,nodes,params}] }
```

**Step 4: Verify**
Run: `npm test -- tests/simulation.netlistBuilderV2.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/v2/simulation/NetlistBuilderV2.js tests/simulation.netlistBuilderV2.spec.js src/core/simulation/NetlistBuilder.js
git commit -m "feat(v2): add pure netlist DTO builder"
```

### Task 5: Introduce immutable CircuitModel APIs

**Files:**
- Create: `src/v2/domain/CircuitModel.js`
- Create: `src/v2/domain/CircuitModelCommands.js`
- Create: `tests/domain.circuitModelV2.spec.js`

**Step 1: Write failing tests**
- `addComponent/removeComponent/addWire/removeWire` 返回新模型或受控 mutation API。
- 禁止直接改写内部 `Map`。

**Step 2: Run fail-first**
Run: `npm test -- tests/domain.circuitModelV2.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 实现 model + commands。
- 为每次命令更新 `version`。

**Step 4: Verify**
Run: `npm test -- tests/domain.circuitModelV2.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/v2/domain/CircuitModel.js src/v2/domain/CircuitModelCommands.js tests/domain.circuitModelV2.spec.js
git commit -m "feat(v2): add circuit model and command APIs"
```

### Task 6: Add schema v3 strict validator (no legacy aliases)

**Files:**
- Create: `src/v2/infra/io/CircuitSchemaV3.js`
- Create: `src/v2/infra/io/CircuitDeserializerV3.js`
- Create: `tests/circuitSchema.v3.spec.js`

**Step 1: Write failing tests**
- 接受 schema v3。
- 拒绝 legacy 字段：`templateName`, `bindingMap`, `pendingToolType` 等。

**Step 2: Run fail-first**
Run: `npm test -- tests/circuitSchema.v3.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 实现严格校验入口 `validateCircuitV3(payload)`。
- deserializer 仅接受 canonical 字段。

**Step 4: Verify**
Run: `npm test -- tests/circuitSchema.v3.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/v2/infra/io/CircuitSchemaV3.js src/v2/infra/io/CircuitDeserializerV3.js tests/circuitSchema.v3.spec.js
git commit -m "feat(v2): add strict schema v3 validator/deserializer"
```

## Week 3-4: Solver Purity And Simulation Pipeline

### Task 7: Add SimulationStateV2 as sole runtime mutable state

**Files:**
- Create: `src/v2/simulation/SimulationStateV2.js`
- Create: `tests/simulation.stateV2.spec.js`

**Step 1: Write failing tests**
- `ensure/reset/applyPatch` 行为可预测。
- 无组件对象字段回写。

**Step 2: Run fail-first**
Run: `npm test -- tests/simulation.stateV2.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- Map-based state container keyed by component id。
- 提供组件类型级默认 state 初始化器。

**Step 4: Verify**
Run: `npm test -- tests/simulation.stateV2.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/v2/simulation/SimulationStateV2.js tests/simulation.stateV2.spec.js
git commit -m "feat(v2): add isolated simulation state container"
```

### Task 8: Implement pure solve entrypoint

**Files:**
- Create: `src/v2/simulation/SolveCircuitV2.js`
- Create: `src/v2/simulation/ResultPostprocessorV2.js`
- Create: `tests/solver.v2.purity.spec.js`
- Create: `tests/solver.v2.commonCases.spec.js`

**Step 1: Write failing tests**
- `solve` 仅接受 DTO + state + options。
- `solve` 不读取/写入 component source object。
- 典型电路 case 可通过。

**Step 2: Run fail-first**
Run: `npm test -- tests/solver.v2.purity.spec.js tests/solver.v2.commonCases.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 封装矩阵构建、stamp、求解、后处理为纯入口。
- 返回 `{valid, voltages, currents, nextState, diagnostics}`。

**Step 4: Verify**
Run: `npm test -- tests/solver.v2.purity.spec.js tests/solver.v2.commonCases.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/v2/simulation/SolveCircuitV2.js src/v2/simulation/ResultPostprocessorV2.js tests/solver.v2.purity.spec.js tests/solver.v2.commonCases.spec.js
git commit -m "feat(v2): add pure solver pipeline entrypoint"
```

### Task 9: Add ResultProjector (ViewModel-only display values)

**Files:**
- Create: `src/v2/app/ResultProjector.js`
- Create: `tests/app.resultProjectorV2.spec.js`

**Step 1: Write failing tests**
- 输入 solve result + circuit model，输出 display ViewModel。
- 不写回 component parameter object。

**Step 2: Run fail-first**
Run: `npm test -- tests/app.resultProjectorV2.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 统一投影电压/电流/功率/状态字段。
- 处理 disconnected/shorted 规则。

**Step 4: Verify**
Run: `npm test -- tests/app.resultProjectorV2.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/v2/app/ResultProjector.js tests/app.resultProjectorV2.spec.js
git commit -m "feat(v2): add result projector for view model"
```

### Task 10: Add v2 coordinators and one-step use case

**Files:**
- Create: `src/v2/app/coordinators/TopologyCoordinatorV2.js`
- Create: `src/v2/app/coordinators/SimulationCoordinatorV2.js`
- Create: `src/v2/app/usecases/RunSimulationStepV2.js`
- Create: `tests/app.runSimulationStepV2.spec.js`

**Step 1: Write failing integration test**
- 构造小电路，执行一次 run-step，拿到 projection + diagnostics。

**Step 2: Run fail-first**
Run: `npm test -- tests/app.runSimulationStepV2.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 串联 `CircuitModel -> NetlistBuilderV2 -> SolveCircuitV2 -> ResultProjector`。

**Step 4: Verify**
Run: `npm test -- tests/app.runSimulationStepV2.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/v2/app/coordinators/TopologyCoordinatorV2.js src/v2/app/coordinators/SimulationCoordinatorV2.js src/v2/app/usecases/RunSimulationStepV2.js tests/app.runSimulationStepV2.spec.js
git commit -m "feat(v2): add simulation run-step coordinators"
```

## Week 5: Component System Decomposition

### Task 11: Extract component manifest and factory v2

**Files:**
- Create: `src/v2/domain/components/ComponentManifest.js`
- Create: `src/v2/domain/components/createComponentV2.js`
- Create: `tests/components.manifestV2.spec.js`

**Step 1: Write failing tests**
- 所有类型均有 manifest 定义。
- terminal count/default params 可读。

**Step 2: Run fail-first**
Run: `npm test -- tests/components.manifestV2.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 将 defaults/names/terminalCount 从 monolith 提取为 manifest。

**Step 4: Verify**
Run: `npm test -- tests/components.manifestV2.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/v2/domain/components/ComponentManifest.js src/v2/domain/components/createComponentV2.js tests/components.manifestV2.spec.js
git commit -m "refactor(v2): extract component manifest and factory"
```

### Task 12: Split renderers by type-group

**Files:**
- Create: `src/v2/ui/renderers/base/SvgPrimitives.js`
- Create: `src/v2/ui/renderers/electrical/PassiveRenderers.js`
- Create: `src/v2/ui/renderers/electrical/SourceRenderers.js`
- Create: `src/v2/ui/renderers/controls/SwitchRenderers.js`
- Create: `src/v2/ui/renderers/RendererRegistryV2.js`
- Create: `tests/ui.rendererRegistryV2.spec.js`

**Step 1: Write failing tests**
- registry 能根据 type 返回 renderer。
- 未注册 type 返回明确错误。

**Step 2: Run fail-first**
Run: `npm test -- tests/ui.rendererRegistryV2.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 先迁移 6 个高频类型（PowerSource/Resistor/Switch/Capacitor/Inductor/Voltmeter）。
- 其余类型按 TODO 列表分批迁移。

**Step 4: Verify**
Run: `npm test -- tests/ui.rendererRegistryV2.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/v2/ui/renderers/base/SvgPrimitives.js src/v2/ui/renderers/electrical/PassiveRenderers.js src/v2/ui/renderers/electrical/SourceRenderers.js src/v2/ui/renderers/controls/SwitchRenderers.js src/v2/ui/renderers/RendererRegistryV2.js tests/ui.rendererRegistryV2.spec.js
git commit -m "refactor(v2): split svg renderers into registry modules"
```

## Week 6: App Composition Root Refactor

### Task 13: Add v2 composition root and runtime bootstrap

**Files:**
- Create: `src/v2/main/AppCompositionRootV2.js`
- Create: `src/v2/main/bootstrapV2.js`
- Modify: `src/main.js`
- Create: `tests/app.bootstrapV2.spec.js`

**Step 1: Write failing tests**
- `bootstrapV2` 创建 app 并暴露所需 runtime contract。
- 不再直接拼装 v1 monolith dependencies。

**Step 2: Run fail-first**
Run: `npm test -- tests/app.bootstrapV2.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- main 入口调用 v2 composition root。
- 保留调试入口但通过 app service 暴露。

**Step 4: Verify**
Run: `npm test -- tests/app.bootstrapV2.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/v2/main/AppCompositionRootV2.js src/v2/main/bootstrapV2.js src/main.js tests/app.bootstrapV2.spec.js
git commit -m "refactor(v2): introduce composition root bootstrap"
```

## Week 7: AI Single-Protocol Convergence

### Task 14: Responses-only OpenAI client

**Files:**
- Create: `src/ai/OpenAIClientV2.js`
- Modify: `src/ai/agent/CircuitAIAgent.js`
- Create: `tests/aiClient.v2.responsesOnly.spec.js`

**Step 1: Write failing tests**
- client 仅生成 `/v1/responses` 请求体。
- 不存在 fallback 到 chat/completions 的逻辑分支。

**Step 2: Run fail-first**
Run: `npm test -- tests/aiClient.v2.responsesOnly.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 实现简化 endpoint/headers/body/response parsing。
- 保留重试与超时，不保留多协议分支。

**Step 4: Verify**
Run: `npm test -- tests/aiClient.v2.responsesOnly.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/ai/OpenAIClientV2.js src/ai/agent/CircuitAIAgent.js tests/aiClient.v2.responsesOnly.spec.js
git commit -m "refactor(ai): add responses-only v2 client"
```

### Task 15: Remove legacy/fallback branches in v2 runtime paths

**Files:**
- Modify: `src/app/interaction/InteractionModeBridge.js`
- Modify: `src/ui/observation/ObservationState.js`
- Modify: `src/embed/EmbedRuntimeBridge.js`
- Create: `tests/runtime.v2NoLegacyFallback.spec.js`

**Step 1: Write failing tests**
- 禁止 v2 路径读取 legacy alias。
- 禁止 runtime fallback 读取 root mode fields。

**Step 2: Run fail-first**
Run: `npm test -- tests/runtime.v2NoLegacyFallback.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**
- 移除 v2 相关 fallback 分支。
- 明确抛出结构化错误而非 silent fallback。

**Step 4: Verify**
Run: `npm test -- tests/runtime.v2NoLegacyFallback.spec.js`  
Expected: PASS.

**Step 5: Commit**
```bash
git add src/app/interaction/InteractionModeBridge.js src/ui/observation/ObservationState.js src/embed/EmbedRuntimeBridge.js tests/runtime.v2NoLegacyFallback.spec.js
git commit -m "refactor(v2): remove legacy fallback branches from runtime paths"
```

## Week 8: Final Hardening, Verification, Release Readiness

### Task 16: Final verification + release evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/releases/v1.0-8day-readiness-gate.md`
- Create: `docs/reports/2026-03-03-v2-breaking-refactor-final-report.md`
- Modify: `docs/reports/debt-dashboard.md`

**Step 1: Run full quality matrix**
Run:
`npm run check`  
`npm run check:e2e`  
`npm run baseline:p0`  
`npm run baseline:circuitjs`  
`npm run baseline:ai`

Expected: 全部 PASS。

**Step 2: Run v2-specific guards**
Run:
`npm run check:v2:boundaries`  
`npm run check:v2:runtime-safety`  
`npm run check:core-size`

Expected: PASS，且无 v2 超预算。

**Step 3: Write final report**
- 固定评分卡结果。
- 记录移除的兼容路径清单。
- 记录残留风险与后续优化项（非兼容类）。

**Step 4: Commit**
```bash
git add README.md docs/releases/v1.0-8day-readiness-gate.md docs/reports/2026-03-03-v2-breaking-refactor-final-report.md docs/reports/debt-dashboard.md
git commit -m "docs(v2): publish final refactor report and release evidence"
```

---

## Weekly Acceptance Criteria

### Week 1 Exit
1. `check:v2:boundaries` 已接入 CI。
2. v2 预算规则已生效。
3. v2 作用域 no-safeInvoke duplication guard 生效。

### Week 2-3 Exit
1. NetlistDTO 纯化完成（无 source reference）。
2. schema v3 严格校验可用。
3. CircuitModel/SimulationState 基础契约稳定。

### Week 3-4 Exit
1. pure solve entrypoint 可通过核心仿真测试。
2. ResultProjector 完成并替代参数对象显示回写。
3. v2 run-step use case 可跑通。

### Week 5 Exit
1. component manifest/factory 拆分完成。
2. renderer registry 路径可扩展。

### Week 6 Exit
1. main 入口完成 composition root 收敛。
2. v2 bootstrap contract 稳定。

### Week 7 Exit
1. AI responses-only 路径稳定。
2. v2 runtime 路径无 legacy fallback。

### Week 8 Exit
1. 所有全局门禁和 baseline 通过。
2. 评分卡达到设计阈值（综合 >= 9.3）。
3. 最终报告和发布证据完备。

---

## Global Verification Commands

```bash
npm run lint
npm test
npm run check:v2:boundaries
npm run check:v2:runtime-safety
npm run check:core-size
npm run check:e2e
npm run baseline:p0
npm run baseline:circuitjs
npm run baseline:ai
npm run check:full
```

## Rollback Checklist

1. 每个 Task 单独 commit，不跨任务混改。
2. 任一门禁失败，优先 `git revert <task-commit>`。
3. 禁止在 release week 引入新特性修复，严格 YAGNI。
4. 若 solver purity 回归，回退到最近通过 `solver.v2.*` 的提交。
5. 若架构门禁冲突，先修边界再继续功能任务。

## Handoff Notes

1. 实施时默认使用 TDD（先失败测试）。
2. 每个 Task 完成后更新 `docs/plans/2026-03-03-v2-breaking-refactor-execution-log.md`。
3. 若任务执行跨天，先重跑上一个 task 的验证命令再继续。
