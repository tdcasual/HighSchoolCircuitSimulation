# Project Audit Top 30

> 本表记录项目级高风险问题及其当前验证状态。闭环后既包含 `confirmed` 项，也包含已被自动化合同收口的 `covered` 项。

## Scoring

统一采用：`Score = Impact(1-5) × Frequency(1-5) × RecoverabilityCost(1-3)`

## Summary Table

| id | area | candidate_title | kind | conflict_class | status | suspected_severity | score | evidence_seed | target_audit_doc |
|---|---|---|---|---|---|---|---|---|---|
| PRJ-001 | Z0/Z4 | `wire` 与 `endpoint-edit` 可同时激活 | conflict | State Conflict | covered | P1 | TBD | `tests/interaction.modeMatrix.spec.js` | `docs/audits/wire-interaction/2026-03-08-z4-mode-store-followup.md` |
| PRJ-002 | Z0 | `bootstrapV2` 外层已切换但内部仍装配旧 monolith runtime | conflict | Boundary Leak | covered | P1 | TBD | `src/main.js`, `src/app/AppRuntimeV2.js` | `docs/audits/reliability/2026-03-08-z0-runtime-sot-followup.md` |
| PRJ-003 | Z0 | mode store 与 legacy runtime flags 存在双状态源风险 | conflict | State Conflict | covered | P1 | TBD | `src/app/interaction/*`, `tests/interaction.modeStore.spec.js` | `docs/audits/reliability/2026-03-08-z0-runtime-sot-followup.md` |
| PRJ-004 | Z0/Z6 | readonly / classroom / embed 运行时门控可能出现行为分叉 | conflict | Boundary Leak | covered | P1 | TBD | `tests/app.runtimeCapabilities.spec.js`, `tests/embedRuntimeBridge.spec.js`, `tests/app.bootstrapV2.spec.js` | `docs/audits/reliability/2026-03-08-z6-storage-readonly-snapshot-followup.md` |
| PRJ-005 | Z1 | `topologyVersion` 与 `solverCircuitDirty` 在批处理后可能漂移 | bug | Timing Bug | covered | P1 | TBD | `src/core/runtime/Circuit.js`, `tests/circuit.topologyBatch.spec.js` | `docs/audits/reliability/2026-03-08-z1-topology-transaction-followup.md` |
| PRJ-006 | Z1 | `WireCompactor` 与 `ConnectivityCache` 失效顺序可能不一致 | bug | Timing Bug | covered | P1 | TBD | `src/core/topology/*`, `tests/topology.connectivityCache.spec.js` | `docs/audits/reliability/2026-03-08-z1-topology-transaction-followup.md` |
| PRJ-007 | Z1/Z4 | 视觉上已连通但电气节点未并入 | bug | Feedback Gap | covered | P0 | TBD | `tests/circuit.topologyService.spec.js`, `tests/circuit.syncWireRefs.spec.js`, `tests/interaction.mouseLeaveHandlers.spec.js` | `docs/audits/reliability/2026-03-07-prj-007-visual-electrical-connectivity-followup.md` |
| PRJ-008 | Z1/Z2 | 短路诊断、拓扑重建、仿真刷新顺序可能不一致 | bug | Timing Bug | covered | P1 | TBD | `tests/circuit.runtimeDiagnostics.spec.js`, `tests/runtimeDiagnostics.pipeline.spec.js` | `docs/audits/reliability/2026-03-07-prj-008-batch-diagnostics-followup.md` |
| PRJ-009 | Z2 | v1/v2 求解链结果投影口径可能不同 | conflict | Boundary Leak | covered | P1 | TBD | `tests/solver.parity.spec.js`, `tests/solver.commonCases.spec.js`, `tests/solver.v2.commonCases.spec.js` | `docs/audits/reliability/2026-03-06-z2-solver-dynamics-audit.md` |
| PRJ-010 | Z2 | 暂停 / 恢复 / 重置后动态元件状态可能不一致 | bug | Timing Bug | covered | P1 | TBD | `tests/solver.dynamicState.spec.js`, `tests/solver.dynamicSteadyState.spec.js`, `tests/circuit.simulationState.spec.js` | `docs/audits/reliability/2026-03-06-z2-solver-dynamics-audit.md` |
| PRJ-011 | Z2 | AC 子步进与自适应步长切换可能导致行为跳变 | bug | Timing Bug | covered | P2 | TBD | `tests/circuit.acSubstep.spec.js`, `tests/circuit.adaptiveTimestep.spec.js`, `tests/solver.dynamicIntegration.spec.js` | `docs/audits/reliability/2026-03-08-z2-solver-transition-followup.md` |
| PRJ-012 | Z2/Z5 | 非线性/收敛失败虽被诊断识别但 UI 解释不足 | ux | Feedback Gap | covered | P1 | TBD | `tests/circuit.runtimeDiagnostics.spec.js`, `tests/runtimeDiagnostics.pipeline.spec.js`, `tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js` | `docs/audits/reliability/2026-03-07-prj-012-runtime-hints-followup.md` |
| PRJ-013 | Z3 | component manifest / registry / stamp 覆盖可能不一致 | conflict | Schema Drift | covered | P1 | TBD | `tests/componentDefinitionRegistry.spec.js`, `tests/component.catalog.spec.js`, `tests/components.manifestV2.spec.js`, `tests/simulation.componentRegistry.spec.js` | `docs/audits/reliability/2026-03-06-z3-component-schema-audit.md` |
| PRJ-014 | Z3 | serializer / deserializer 可能静默修正字段值 | bug | Schema Drift | covered | P1 | TBD | `tests/circuit.io.spec.js`, `tests/circuitSchema.spec.js` | `docs/audits/reliability/2026-03-08-z3-schema-contract-followup.md` |
| PRJ-015 | Z3 | legacy save 可读但行为语义已变化 | conflict | Schema Drift | covered | P1 | TBD | `src/core/io/*`, `src/v2/infra/io/*` | `docs/audits/reliability/2026-03-08-z3-schema-contract-followup.md` |
| PRJ-016 | Z3/Z5 | UI 可编辑字段与 schema 允许值可能不一致 | bug | Schema Drift | covered | P1 | TBD | `tests/interaction.propertyDialogActions.spec.js`, `tests/circuitSchema.v3.spec.js` | `docs/audits/reliability/2026-03-08-z3-schema-contract-followup.md` |
| PRJ-017 | Z4 | 工具栏显示模式与真实输入模式可能不一致 | ux | Interaction Ambiguity | covered | P1 | TBD | `tests/interaction.modeStateMachine.spec.js`, `tests/interaction.modeBridge.spec.js` | `docs/audits/wire-interaction/2026-03-07-z4-closure-followup-audit.md` |
| PRJ-018 | Z4/Z7 | 长按 / pinch / context menu 后 pointer session 可能卡住 | bug | Responsive Degradation | covered | P1 | TBD | `tests/interaction.pointerSessionManager.spec.js`, `tests/touchActionController.spec.js`, `tests/interaction.orchestrator.spec.js` | `docs/audits/mobile/2026-03-08-z7-gesture-arbitration-followup.md` |
| PRJ-019 | Z4 | 命中区和吸附阈值不一致导致“看起来能点到，实际连不上” | ux | Interaction Ambiguity | covered | P1 | TBD | `tests/interaction.snapController.spec.js`, `tests/component.touchTargets.spec.js`, `tests/e2e.responsiveTouchHitBudgetContract.spec.js` | `docs/audits/mobile/2026-03-07-prj-019-touch-hit-budget-followup.md` |
| PRJ-020 | Z4 | 端点落在线段上未正确分割建结点 | bug | Timing Bug | covered | P1 | TBD | `tests/interaction.wireSegmentSnap.spec.js` | `docs/audits/wire-interaction/2026-03-07-z4-closure-followup-audit.md` |
| PRJ-021 | Z4/Z5 | 拖拽取消、离开画布、撤销历史快照时机可能不一致 | bug | Timing Bug | covered | P2 | TBD | `tests/interaction.historyFacadeController.spec.js`, `tests/interaction.mouseLeaveHandlers.spec.js` | `docs/audits/wire-interaction/2026-03-07-z4-closure-followup-audit.md` |
| PRJ-022 | Z5 | 属性弹窗 / 属性侧栏 / 快捷栏可能给出不同校验或默认值 | conflict | State Conflict | covered | P1 | TBD | `tests/interaction.propertyDialogController.spec.js`, `tests/quickActionBarController.spec.js` | `docs/audits/observation-ui/2026-03-08-z5-property-selection-followup.md` |
| PRJ-023 | Z5 | 选择态变化后面板内容可能滞后或残留 | bug | Feedback Gap | covered | P1 | TBD | `tests/interaction.selectionPanelController.spec.js`, `tests/interaction.uiStateController.spec.js` | `docs/audits/observation-ui/2026-03-08-z5-property-selection-followup.md` |
| PRJ-024 | Z5/Z7 | 图表与观测交互在桌面和手机上体验不等价 | ux | Responsive Degradation | covered | P1 | TBD | `tests/observationChartInteraction.spec.js`, `tests/e2e.observationTouchContract.spec.js` | `docs/audits/observation-ui/2026-03-08-z5-observation-feedback-followup.md` |
| PRJ-025 | Z5 | 错误/完成反馈过度依赖状态栏，近场反馈不足 | ux | Feedback Gap | covered | P2 | TBD | `tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js`, `tests/runtimeUiBridge.spec.js` | `docs/audits/observation-ui/2026-03-08-z5-observation-feedback-followup.md` |
| PRJ-026 | Z6 | autosave / import / load 之间存在覆盖顺序风险 | bug | Timing Bug | covered | P0 | TBD | `tests/app.storage.spec.js`, `tests/app.storageOwnership.spec.js`, `tests/runtimeActionRouter.spec.js` | `docs/audits/reliability/2026-03-08-z6-storage-readonly-snapshot-followup.md` |
| PRJ-027 | Z6 | embed readonly 可能隐藏 UI 但未真正冻结修改入口 | conflict | Boundary Leak | covered | P0 | TBD | `tests/app.runtimeCapabilities.spec.js`, `tests/embedRuntimeBridge.spec.js` | `docs/audits/reliability/2026-03-08-z6-storage-readonly-snapshot-followup.md` |
| PRJ-028 | Z6 | AI / 诊断 / 导出可能读取到陈旧拓扑或观测状态 | bug | Feedback Gap | covered | P1 | TBD | `tests/aiClient.storage.spec.js`, `tests/observationExportService.spec.js`, `tests/runtimeDiagnostics.pipeline.spec.js` | `docs/audits/reliability/2026-03-08-z6-storage-readonly-snapshot-followup.md` |
| PRJ-029 | Z7 | 顶栏 / 更多菜单 / 侧栏 / 画布手势可能互相抢事件 | ux | Responsive Degradation | covered | P1 | TBD | `tests/responsiveLayoutController.spec.js`, `tests/topActionMenuController.spec.js`, `tests/interaction.pointerSessionManager.spec.js` | `docs/audits/mobile/2026-03-08-z7-gesture-arbitration-followup.md` |
| PRJ-030 | Z7/Z5 | 手机端面板折叠后恢复入口可能不明显或不一致 | ux | Interaction Ambiguity | covered | P1 | TBD | `tests/mobileRestoreBroker.spec.js`, `tests/mobileRestoreGuideFlow.spec.js`, `tests/mobileRestoreAiFlow.spec.js` | `docs/audits/mobile/2026-03-07-prj-030-mobile-restore-entry-followup.md` |

## Area Quota

| area | reserved_slots | notes |
|---|---:|---|
| `Z0` | 4 | 运行时边界、状态源冲突 |
| `Z1` | 4 | 拓扑、缓存、重建顺序 |
| `Z2` | 4 | 求解、动态状态、诊断解释 |
| `Z3` | 4 | 组件清单、schema、序列化 |
| `Z4` | 5 | 导线、模式、指针会话 |
| `Z5` | 4 | 面板与结果展示 UX |
| `Z6` | 3 | 存储、嵌入、AI 集成 |
| `Z7` | 2 | 响应式、移动端可用性 |

## Entry Expansion Template

当某条记录被确认后，建议在对应区域 audit 文档中使用以下字段展开：

1. `id`
2. `repro environment`
3. `steps`
4. `expected`
5. `actual`
6. `conflict_class`
7. `suspected_root_cause`
8. `fix_location`
9. `test_location`
10. `status`

## Promotion Rule

仅当满足以下条件时，`seed-hypothesis -> confirmed`：

1. 具备可稳定复现的最少步骤。
2. 至少有一个定位入口（模块、函数、测试或脚本）。
3. 已在对应区域 audit 文档中登记。
