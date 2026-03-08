# Confirmed Audit Remediation Checklist

Date: 2026-03-08
Source: `docs/audits/project/top30.md`
Plan: `docs/plans/2026-03-08-confirmed-audit-remediation-implementation.md`

## Usage

- 每完成一条 `PRJ`，立即更新本清单与 `Top30`。
- 每周末先跑该周门禁，再决定是否进入下一周。
- 未跑测试前，禁止把 `confirmed` 改成 `covered` 或 `fixed`。

## Week 0 - Audit Asset Alignment

- [x] `AUDIT-GOV-01` 校正 `top30` / closure review / README 中失效的 audit 路径引用。
- [x] 为每个 `confirmed` 项补真实区域文档路径或明确新建目标。
- [x] 记录“项目级排期以本清单与实施计划为准”。

## Week 1 - Storage, Readonly and Snapshot Consistency

### P0 / High Risk

- [x] `PRJ-026` 统一 `autosave / import / load` ownership 与写入顺序。
- [x] `PRJ-027` 将 `embed readonly` 升级为命令层硬冻结。
- [x] `PRJ-028` 统一 AI / diagnostics / export 的 snapshot 读取口径。
- [x] `PRJ-004` 统一 `readonly / classroom / embed` capability gate。

### Week 1 verification

- [x] 运行 `npm test -- tests/app.storage.spec.js tests/app.storageOwnership.spec.js tests/embedRuntimeBridge.spec.js tests/app.bootstrapV2.spec.js tests/aiClient.storage.spec.js tests/observationExportService.spec.js tests/runtimeDiagnostics.pipeline.spec.js`
- [x] 更新 `docs/audits/project/top30.md` 中对应状态。
- [x] 更新相关区域审计稿。
- [ ] 运行一次 `git log --oneline -n 4`，确认一问题一提交。

## Week 2 - Runtime Source of Truth and Topology Ordering

### P1 / Architectural Root Cause

- [x] `PRJ-002` 清理 `bootstrapV2` 混装旧 runtime。
- [x] `PRJ-003` 去除 mode store 与 legacy flags 双状态源。
- [x] `PRJ-001` 建立 `wire` 与 `endpoint-edit` 严格互斥。
- [x] `PRJ-005` 事务化 `topologyVersion` 与 `solverCircuitDirty` 提交时机。
- [x] `PRJ-006` 固定 `WireCompactor` 与 `ConnectivityCache` 失效顺序。

### Week 2 verification

- [x] 运行 `npm test -- tests/interaction.modeStore.spec.js tests/interaction.modeBridge.spec.js tests/interaction.modeMatrix.spec.js tests/circuit.topologyBatch.spec.js tests/topology.connectivityCache.spec.js`
- [x] 回填 `Top30` 与区域审计说明。
- [ ] 复核没有跨问题面的大杂烩提交。

## Week 3 - Schema and Property Editing Consistency

### P1 / Data Semantics

- [x] `PRJ-014` 删除 serializer / deserializer 静默修正字段行为。
- [x] `PRJ-015` 明确 legacy save 的 migration / warning / rejection 规则。
- [x] `PRJ-016` 让 UI editable fields 从 schema 单源派生。
- [x] `PRJ-022` 统一属性弹窗 / 侧栏 / 快捷栏的校验与默认值。
- [x] `PRJ-023` 修复选择态变化后的面板滞后与残留。

### Week 3 verification

- [x] 运行 `npm test -- tests/circuit.io.spec.js tests/circuitSchema.spec.js tests/circuitSchema.v3.spec.js tests/interaction.propertyDialogActions.spec.js tests/interaction.propertyDialogController.spec.js tests/quickActionBarController.spec.js tests/interaction.selectionPanelController.spec.js tests/interaction.uiStateController.spec.js`
- [x] 更新 `Top30` 状态。
- [x] 记录 schema / UI contract 是否已经单源化。

## Week 4 - Mobile Interaction, Observation UX and Solver Smoothing

### P1 / UX and Interaction Reliability

- [x] `PRJ-018` 清理长按 / pinch / context menu 后 pointer session 卡死。
- [x] `PRJ-029` 统一顶栏 / 更多菜单 / 侧栏 / 画布手势仲裁。
- [x] `PRJ-024` 使图表与观测交互在手机/桌面上能力等价。
- [x] `PRJ-025` 将错误/完成反馈补到近场 UI。
- [x] `PRJ-011` 平滑 AC 子步进与自适应步长切换。

### Week 4 verification

- [x] 运行 `npm test -- tests/interaction.pointerSessionManager.spec.js tests/touchActionController.spec.js tests/responsiveLayoutController.spec.js tests/topActionMenuController.spec.js tests/observationChartInteraction.spec.js tests/e2e.observationTouchContract.spec.js tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js tests/circuit.acSubstep.spec.js tests/circuit.adaptiveTimestep.spec.js`
- [x] 回填移动端与观测专项审计稿。
- [x] 确认 `PRJ-011` 不与其他体验项混提。

## Promotion Rules

- [x] `confirmed -> covered` 前必须有自动化测试或 E2E 合同保护。
- [ ] `confirmed -> fixed` 前必须至少有 targeted tests 通过，并在区域审计稿中说明证据。
- [x] 任意 `P0/P1` 未过 targeted tests，不允许更新主表状态。

## Final Exit Gate

- [x] 运行 `npm test`
- [x] 复核 `docs/audits/project/top30.md` 已无需继续推进的遗漏项。
- [x] 复核每条已完成项都有对应 commit 和测试证据。
- [x] 形成最终整改总结或下一轮 backlog。
