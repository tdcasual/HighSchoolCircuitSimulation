# Observation/ChartWorkspace Debt Burn-down Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 7 天内消除 `ObservationPanel` 与 `ChartWorkspace` 的契约分裂，恢复 `check:full` 为可持续绿灯，并把文档与门禁重新对齐到当前真实状态。

**Architecture:** 以 `ChartWorkspace` 为唯一运行时真相，先修复阻塞发布的 E2E 契约，再清理历史文档与治理基线，最后降低文本型守卫和重复安全封装造成的维护噪音。执行顺序遵循 P0 -> P1 -> P2，避免“边修边扩散”。

**Tech Stack:** Node.js, Vitest, Playwright, GitHub Actions, plain JS modules.

---

## Scope and Non-Goals

- In scope:
  - 修复 `scripts/e2e/*` 对 `app.observationPanel` 的过时依赖。
  - 更新发布/迁移文档中的过期与未来时间断言。
  - 重设核心文件规模预算，使其匹配当前热点文件。
  - 降低明显重复的 `safeInvokeMethod` 定义。
- Out of scope:
  - 不在本轮引入新的观察功能。
  - 不重写全部 CI 守卫脚本，只做高收益去脆弱化。

## Day 1 - Freeze Single Source of Truth (SoT)

### Task 1: 固化 SoT 决策与运行时契约

**Files:**
- Create: `docs/adr/2026-03-03-observation-sot.md`
- Modify: `README.md`
- Test: `tests/app.bootstrapRuntime.spec.js`

**Step 1: Write the failing test**

- 在 `tests/app.bootstrapRuntime.spec.js` 增加契约断言：`window.app` 初始化后必须存在 `chartWorkspace`，且默认不要求 `observationPanel`。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app.bootstrapRuntime.spec.js -t "exposes chartWorkspace runtime contract"`  
Expected: FAIL（新断言未满足）

**Step 3: Write minimal implementation/docs update**

- 明确 README 的运行时观察链路说明：使用 `ChartWorkspace`。
- 在 ADR 中记录弃用策略：`ObservationPanel` 仅可作为过渡资产，不再作为运行时依赖契约。

**Step 4: Run tests to verify it passes**

Run: `npm test -- tests/app.bootstrapRuntime.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add docs/adr/2026-03-03-observation-sot.md README.md tests/app.bootstrapRuntime.spec.js
git commit -m "docs(adr): freeze chart workspace as observation source of truth"
```

---

## Day 2 - Repair Responsive E2E Contract (P0)

### Task 2: 迁移 `responsive-touch` 脚本到 `chartWorkspace`

**Files:**
- Modify: `scripts/e2e/responsive-touch-regression.mjs`
- Test: `scripts/e2e/responsive-touch-regression.mjs` (runtime script)
- Test: `tests/interaction.probeActions.spec.js`

**Step 1: Write the failing test/check**

- 在脚本内新增断言：`probe-measurement` 成功标准改为 `app.chartWorkspace.windows.length` 在 auto-add 后增加。

**Step 2: Run test to verify it fails on old logic**

Run: `npm run test:e2e:responsive`  
Expected: FAIL with `probe_plot_auto_add_failed`（当前已复现）

**Step 3: Write minimal implementation**

- 将 `beforePlotCount/afterPlotCount` 从 `app.observationPanel?.plots` 迁移为 `app.chartWorkspace?.windows`。
- 增加兼容 helper（脚本内部）统一读取 plot/window 计数，避免未来再次绑定旧 API。

**Step 4: Run tests to verify it passes**

Run: `npm run test:e2e:responsive`  
Expected: PASS

Run: `npm test -- tests/interaction.probeActions.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/e2e/responsive-touch-regression.mjs tests/interaction.probeActions.spec.js
git commit -m "test(e2e): align responsive probe measurement with chart workspace"
```

---

## Day 3 - Rewrite Observation Touch E2E to Current UX (P0)

### Task 3: 用 `ChartWorkspace` 行为替换 `ObservationPanel` 触控回归

**Files:**
- Modify: `scripts/e2e/observation-touch-regression.mjs`
- Create: `tests/e2e.observationTouchContract.spec.js`

**Step 1: Write the failing test**

- 新增 `tests/e2e.observationTouchContract.spec.js`，校验脚本不再等待 `window.app?.observationPanel`，而是等待 `window.app?.chartWorkspace`。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/e2e.observationTouchContract.spec.js`  
Expected: FAIL（旧脚本仍含 `observationPanel`）

**Step 3: Write minimal implementation**

- `waitForFunction` 改为 `window.app?.chartWorkspace && window.app?.interaction`。
- 场景改写为当前可观测行为：
  - 默认窗口存在（`windows.length >= 1`）
  - 点击 `[data-chart-action="add"]` 后窗口 +1
  - 手机布局下窗口可折叠状态可变更（`uiState.collapsed`）
  - 截图产物继续输出到 `output/e2e/observation-touch`
- 删除仅 `ObservationPanel` 具备的断言（preset/export/freeze-readout）或迁移为等价窗口行为断言。

**Step 4: Run tests to verify it passes**

Run: `npm run test:e2e:observation`  
Expected: PASS

Run: `npm test -- tests/e2e.observationTouchContract.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/e2e/observation-touch-regression.mjs tests/e2e.observationTouchContract.spec.js
git commit -m "test(e2e): migrate observation touch regression to chart workspace contract"
```

---

## Day 4 - Repair Docs Credibility and Time Consistency (P1)

### Task 4: 纠正文档中的未来时间与过时通过声明

**Files:**
- Modify: `README.md`
- Modify: `docs/releases/v1.0-8day-readiness-gate.md`
- Modify: `docs/releases/v1.0-8day-go-no-go-matrix.md`
- Modify: `docs/audits/mobile/2026-04-06-sprint-closure-review.md`
- Modify: `docs/reports/2026-03-02-legacy-prune-final-report.md`

**Step 1: Write failing integrity test**

- 增加或更新 `tests/release.docsIntegrity.spec.js`：禁止 README/release 文档出现“未来日期完成态”与不存在命令（如 `check:legacy-prune-readiness`）的通过声明。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/release.docsIntegrity.spec.js`  
Expected: FAIL（当前文档含未来日期与过时命令引用）

**Step 3: Write minimal implementation**

- 将 `2026-04-06` 的“已完成 GO”改为“计划里程碑/历史归档”并注明证据日期。
- 删除或替换 `check:legacy-prune-readiness` 的通过叙述。
- 在 README 中把“`check:full` 已通过”改为“请以最新 CI 运行为准”。

**Step 4: Run tests to verify it passes**

Run: `npm run check:docs-integrity`  
Expected: PASS

Run: `npm test -- tests/release.docsIntegrity.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add README.md docs/releases/v1.0-8day-readiness-gate.md docs/releases/v1.0-8day-go-no-go-matrix.md docs/audits/mobile/2026-04-06-sprint-closure-review.md docs/reports/2026-03-02-legacy-prune-final-report.md tests/release.docsIntegrity.spec.js
git commit -m "docs: align release and debt reports with current verifiable status"
```

---

## Day 5 - Rebaseline Governance Budgets (P1)

### Task 5: 让文件体积预算匹配当前风险热点

**Files:**
- Modify: `scripts/ci/assert-core-file-size-budget.mjs`
- Modify: `docs/plans/2026-03-02-core-file-decomposition-plan.md`
- Test: `tests/ci.workflow.spec.js` (if workflow/scripts assertions changed)

**Step 1: Write failing test/check**

- 在预算脚本中新增高风险文件预算（至少 `src/ui/ObservationPanel.js` 或其替代目标），并为已拆分文件更新阈值。

**Step 2: Run check to verify baseline behavior**

Run: `npm run check:core-size`  
Expected: 当前状态应产生可解释输出（warning 或 fail，取决于阈值策略）

**Step 3: Write minimal implementation**

- 把 `InteractionOrchestrator.js` 预算下调到贴近现状（避免“13% 仍占预算位”）。
- 将 `ObservationPanel.js` 纳入预算，或在 ADR 指定迁移完成后删除并切换预算到 `ChartWindowController.js`。
- 更新拆分计划中的真实行数与拆分优先级。

**Step 4: Run tests/checks to verify**

Run: `npm run check:core-size`  
Expected: PASS with meaningful warning/fail semantics

Run: `npm test -- tests/ci.workflow.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/ci/assert-core-file-size-budget.mjs docs/plans/2026-03-02-core-file-decomposition-plan.md tests/ci.workflow.spec.js
git commit -m "chore(ci): rebaseline core file size budgets to current hotspots"
```

---

## Day 6 - Reduce Guardrail Fragility and Safety Helper Duplication (P2)

### Task 6: 收敛 `safeInvokeMethod` 与文本型守卫脆弱点

**Files:**
- Modify: `src/ui/interaction/PanelBindingsController.js`
- Modify: `src/ui/TopActionMenuController.js`
- Modify: `src/ui/ResponsiveLayoutController.js`
- Modify: `src/ui/charts/ChartWorkspaceController.js`
- Modify: `scripts/ci/assert-interaction-guide-sync.mjs` (only if replacing brittle snippet logic)
- Modify: `tests/interaction.guideSync.spec.js`

**Step 1: Write failing test**

- 新增/更新测试，要求目标模块优先使用 `src/utils/RuntimeSafety.js` 导出函数，而不是重复定义本地 `safeInvokeMethod`。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/interaction.guideSync.spec.js`  
Expected: FAIL（若新增了防回归约束）

**Step 3: Write minimal implementation**

- 优先改 3-5 个高频模块，导入 `safeInvoke/safeAddEventListener/safeClassListToggle`。
- 对 `assert-interaction-guide-sync.mjs` 增加更稳健的容错（例如多文件来源 + 更明确失败信息），不扩大职责。

**Step 4: Run tests/checks to verify**

Run: `npm test -- tests/interaction.guideSync.spec.js`  
Expected: PASS

Run: `npm run check:interaction-guide`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/ui/interaction/PanelBindingsController.js src/ui/TopActionMenuController.js src/ui/ResponsiveLayoutController.js src/ui/charts/ChartWorkspaceController.js scripts/ci/assert-interaction-guide-sync.mjs tests/interaction.guideSync.spec.js
git commit -m "refactor(runtime-safety): deduplicate safe invocation helpers in core ui paths"
```

---

## Day 7 - Final Gate and Debt Closure Report

### Task 7: 全量回归、证据归档、风险清单收口

**Files:**
- Create: `docs/reports/2026-03-09-observation-tech-debt-closure-report.md`
- Modify: `README.md` (link closure report)

**Step 1: Run full verification matrix**

Run:

```bash
npm run check
npm run check:e2e
npm run check:full
```

Expected:
- `check` PASS
- `check:e2e` PASS（含 responsive/observation）
- `check:full` PASS

**Step 2: Collect before/after metrics**

- 记录:
  - E2E fail -> pass 变化
  - `core-size` 热点文件占比变化
  - 文档断言一致性变化

**Step 3: Publish closure report**

- 报告包含:
  - 问题根因链路
  - 本轮变更列表
  - 仍存风险（若 `ObservationPanel` 保留）
  - 下一轮建议（是否删除 `ObservationPanel` 代码资产）

**Step 4: Commit**

```bash
git add docs/reports/2026-03-09-observation-tech-debt-closure-report.md README.md
git commit -m "docs(report): close observation/chart workspace debt burndown with evidence"
```

---

## Daily Quality Gate (Run at End of Each Day)

```bash
npm test
npm run test:e2e:responsive
npm run test:e2e:observation
npm run check:core-size
```

## Rollback Strategy

- 每天保持单主题 commit（可 `git revert <commit>` 粒度回滚）。
- P0 修复期禁止夹带重构；E2E 变绿后再做 P2 优化。
- 若 Day 3 后 `check:e2e` 仍不稳定，暂停 Day 5/6，优先完成契约收敛。

## Exit Criteria

- `app.observationPanel` 不再出现在 E2E 脚本。
- `npm run check:full` 在本地和 CI 均稳定通过。
- README/Release 文档不再使用未来日期宣告已完成状态。
- 规模预算覆盖当前前 3 风险热点文件并具备解释力。
