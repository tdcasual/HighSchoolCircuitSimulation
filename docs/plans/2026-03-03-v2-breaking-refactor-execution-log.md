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
