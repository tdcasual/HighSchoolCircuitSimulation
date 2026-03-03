# Observation/ChartWorkspace 技术债闭环报告（2026-03-03）

## 1. 背景与根因

本轮清债聚焦一个核心问题：运行时观察链路已迁移到 `ChartWorkspace`，但 E2E 与部分文档仍引用 `ObservationPanel` 历史契约，导致“单元测试通过但发布门禁失败”。

## 2. 变更范围

### P0：契约断裂修复（阻塞门禁）

- `scripts/e2e/responsive-touch-regression.mjs`
  - 探针自动加图断言由 `app.observationPanel?.plots` 迁移到 `app.chartWorkspace?.windows`（保留 legacy 兜底计数）。
- `scripts/e2e/observation-touch-regression.mjs`
  - 启动等待条件迁移为 `window.app?.chartWorkspace`。
  - 场景断言重写为当前工作区行为：默认窗口、新增窗口、折叠切换、采样间隔变更。
- `tests/e2e.observationTouchContract.spec.js`
  - 新增脚本契约防回归测试，阻止重新引入 `window.app.observationPanel` 依赖。

### P1：文档可信度与治理基线

- `src/app/AppBootstrapRuntime.js` + `tests/app.bootstrapRuntime.spec.js`
  - 仅当 `createApp()` 返回对象含 `chartWorkspace` 契约时才暴露 `window.app`。
- `docs/adr/2026-03-03-observation-sot.md`
  - 固化观察运行时唯一真相为 `ChartWorkspace`。
- `README.md`、`docs/releases/v1.0-8day-*.md`、`docs/audits/mobile/2026-04-06-sprint-closure-review.md`
  - 修正“静态全绿/未来完成态”语义，改为里程碑归档说明。
- `docs/reports/2026-03-02-legacy-prune-final-report.md` + `tests/release.docsIntegrity.spec.js`
  - 移除已下线命令 `npm run check:legacy-prune-readiness` 的通过声明。

### P1/P2：体积预算与重复安全封装

- `scripts/ci/assert-core-file-size-budget.mjs`
  - 新增 `ObservationPanel.js <= 1650`。
  - 下调 `InteractionOrchestrator.js <= 400`，与已拆分现状对齐。
- `docs/plans/2026-03-02-core-file-decomposition-plan.md`
  - 更新真实行数与拆分优先级。
- `src/ui/charts/ChartWorkspaceController.js`
- `src/ui/TopActionMenuController.js`
- `src/ui/ResponsiveLayoutController.js`
  - 本地 `safeInvokeMethod` 逻辑改为委托 `src/utils/RuntimeSafety.js`，降低重复 try/catch 实现。

## 3. 验证结果（本地）

已执行并通过：

- `npm run test:e2e:responsive`
- `npm run test:e2e:observation`
- `npm run check:e2e`
- `npm run check:full`

关键结果：

- `check:e2e`：wire/responsive/observation/ai-mobile 全部 PASS。
- `check:full`：PASS（含 lint/format/test + 全部 E2E + P0/CircuitJS/AI baseline）。
- `check:core-size`：PASS with warnings
  - `Circuit.js: 1962/2000 (98%)`
  - `Component.js: 1650/1700 (97%)`
  - `ObservationPanel.js: 1588/1650 (96%)`
  - `InteractionOrchestrator.js: 187/400 (47%)`

## 4. 前后对比

- Before:
  - `test:e2e:responsive` 因 `probe_plot_auto_add_failed` 失败。
  - `test:e2e:observation` 因等待 `window.app?.observationPanel` 超时失败。
  - `check:full` 被 E2E 链路阻塞。
- After:
  - 观察链路 E2E 完全转向 `chartWorkspace` 契约。
  - `check:e2e` 与 `check:full` 全绿。

## 5. 剩余风险与下一步

- `ObservationPanel.js` 仍为大文件且未完全下线，建议下一轮继续向 `ChartWorkspace` 收敛并评估删减策略。
- 仍有部分 UI 模块保留本地安全调用封装，可分批迁移到 `RuntimeSafety` 工具集。
