# Confirmed Audit Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 4 周内按风险优先级推进 `Top30` 中剩余 `19` 条 `confirmed` 项，把高风险项优先收敛为 `covered` 或 `fixed`，并保持主分支持续可回归。

**Architecture:** 执行顺序遵循“数据安全与权限阻断 → 运行时状态源收敛 → 拓扑/序列化一致性 → 面板与移动端体验 → 求解器平滑收尾”。每个整改单元必须满足 `1 PRJ = 1 commit = 1 rollback target`，先补 fail-first 测试，再做最小实现，再补区域审计回填。

**Tech Stack:** Vanilla JS (ESM), Vitest, Node CI scripts, existing responsive/mobile E2E contracts, docs-based audit tracking.

---

## Scope and Success Criteria

### Confirmed Backlog In Scope

- `PRJ-001` `wire` 与 `endpoint-edit` 模式互斥缺失。
- `PRJ-002` `bootstrapV2` 外层切换后仍装配旧 runtime。
- `PRJ-003` mode store 与 legacy flags 双状态源。
- `PRJ-004` readonly / classroom / embed 门控分叉。
- `PRJ-005` `topologyVersion` 与 `solverCircuitDirty` 批处理后漂移。
- `PRJ-006` `WireCompactor` 与 `ConnectivityCache` 失效顺序不一致。
- `PRJ-011` AC 子步进与自适应步长切换跳变。
- `PRJ-014` serializer / deserializer 静默修正字段值。
- `PRJ-015` legacy save 可读但语义已变化。
- `PRJ-016` UI 可编辑字段与 schema 允许值不一致。
- `PRJ-018` 长按 / pinch / context menu 后 pointer session 卡住。
- `PRJ-022` 属性弹窗 / 侧栏 / 快捷栏校验与默认值不一致。
- `PRJ-023` 选择态变化后面板内容滞后或残留。
- `PRJ-024` 图表与观测交互桌面/手机体验不等价。
- `PRJ-025` 错误/完成反馈过度依赖状态栏，近场反馈不足。
- `PRJ-026` autosave / import / load 覆盖顺序风险。
- `PRJ-027` embed readonly 可能隐藏 UI 但未真正冻结修改入口。
- `PRJ-028` AI / 诊断 / 导出可能读取到陈旧拓扑或观测状态。
- `PRJ-029` 顶栏 / 更多菜单 / 侧栏 / 画布手势抢事件。

### Definition of Done

每个任务只有在以下条件全部满足时才能从 `confirmed` 升级：

1. 对应问题具备至少一条 fail-first 或强化后的回归测试。
2. 改动只触达计划中列出的单一问题面，不混入其他风险层级。
3. 目标测试命令通过，且周末执行一次 `npm test` 全量回归。
4. `docs/audits/project/top30.md` 与对应区域审计稿完成状态回填。
5. 合并前明确回滚点：单任务单 commit。

## Week 0 - Audit Asset Alignment

### Task 0: 统一审计资产路径与执行口径

**Files:**
- Modify: `docs/audits/project/top30.md`
- Modify: `docs/audits/project/2026-03-07-top30-closure-review.md`
- Modify: `docs/audits/project/README.md`

**Step 1: Write failing documentation check**
- 列出 `top30` 中不存在的 `target_audit_doc` 路径。
- 为后续每个 `confirmed` 项补真实区域文档落点或明确“待新建”。

**Step 2: Verify fail state**
Run:
`rg -n "2026-03-06-z[0-7]|2026-03-07-z[0-7]" docs/audits/project`
Expected: 可发现项目总表引用的若干路径与仓库现有文件名不一致。

**Step 3: Minimal implementation**
- 将不存在的审计文档路径改成仓库内真实可点击路径。
- 在闭环文档中补一句说明：整改执行以本计划为准，不再依赖旧占位文件名。

**Step 4: Verify**
Run:
`rg -n "target_audit_doc|closed-for-audit|confirmed|covered" docs/audits/project`
Expected: 所有项目级路径均能在仓库中定位到真实文件或明确新建目标。

**Step 5: Commit**
`git commit -m "docs(audit): normalize confirmed backlog references"`

## Week 1 - Storage, Readonly and Snapshot Consistency

### Task 1: PRJ-026 storage ownership and write-order contract

**Files:**
- Modify: `src/core/runtime/CircuitPersistenceAdapter.js`
- Modify: `src/app/AppStorage.js`
- Modify: `tests/app.storage.spec.js`
- Modify: `tests/app.storageOwnership.spec.js`

**Step 1: Write failing tests**
- autosave 不能覆盖刚导入但尚未确认接管 ownership 的数据。
- load / import / autosave 冲突时必须有确定优先级。

**Step 2: Run fail-first**
Run:
`npm test -- tests/app.storage.spec.js tests/app.storageOwnership.spec.js`
Expected: FAIL until explicit ownership / precedence is enforced.

**Step 3: Minimal implementation**
- 在持久化适配层引入明确的 ownership token 或 source tag。
- 将 `autosave`、`import`、`load` 统一经过一个仲裁入口。

**Step 4: Verify**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "fix(storage): enforce autosave import load precedence"`

### Task 2: PRJ-027 and PRJ-004 runtime capability hard-gating

**Files:**
- Modify: `src/embed/EmbedRuntimeBridge.js`
- Modify: `src/app/AppRuntimeV2.js`
- Modify: `src/app/RuntimeUiBridge.js`
- Modify: `src/ui/ClassroomModeController.js`
- Modify: `tests/embedRuntimeBridge.spec.js`
- Modify: `tests/app.bootstrapV2.spec.js`

**Step 1: Write failing tests**
- readonly 环境下所有变更入口都必须被硬阻断，而不是只隐藏 UI。
- classroom / embed / readonly 的 capability 读取必须走单一门控口径。

**Step 2: Run fail-first**
Run:
`npm test -- tests/embedRuntimeBridge.spec.js tests/app.bootstrapV2.spec.js`
Expected: FAIL until hidden-but-still-mutable paths are blocked.

**Step 3: Minimal implementation**
- 抽出统一 capability guard，并在命令入口执行。
- 确保 `readonly`、`classroom`、`embed` 只有一个最终判断源。

**Step 4: Verify**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "refactor(runtime): unify capability gates for readonly classroom embed"`

### Task 3: PRJ-028 stale snapshot prevention for AI, diagnostics and export

**Files:**
- Modify: `src/ai/OpenAIClientV2.js`
- Modify: `src/app/RuntimeDiagnosticsPipeline.js`
- Modify: `src/ui/observation/ObservationExportService.js`
- Modify: `src/core/runtime/Circuit.js`
- Modify: `tests/aiClient.storage.spec.js`
- Modify: `tests/observationExportService.spec.js`
- Modify: `tests/runtimeDiagnostics.pipeline.spec.js`

**Step 1: Write failing tests**
- AI、导出、诊断都必须读取同一份已提交的 topology / observation snapshot。
- 在 pending rebuild 阶段不允许泄漏陈旧拓扑结论。

**Step 2: Run fail-first**
Run:
`npm test -- tests/aiClient.storage.spec.js tests/observationExportService.spec.js tests/runtimeDiagnostics.pipeline.spec.js`
Expected: FAIL until stale snapshot reads are normalized.

**Step 3: Minimal implementation**
- 引入统一 snapshot provider。
- 把 AI / diagnostics / export 的读取入口对齐到同一提交点。

**Step 4: Verify**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "fix(runtime): unify snapshot reads for ai diagnostics export"`

## Week 2 - Runtime Source of Truth and Topology Ordering

### Task 4: PRJ-002, PRJ-003 and PRJ-001 mode/runtime source convergence

**Files:**
- Modify: `src/main.js`
- Modify: `src/app/AppRuntimeV2.js`
- Modify: `src/app/interaction/InteractionModeStore.js`
- Modify: `src/app/interaction/InteractionModeStateMachine.js`
- Modify: `src/app/interaction/InteractionModeBridge.js`
- Modify: `src/ui/Interaction.js`
- Modify: `tests/interaction.modeStore.spec.js`
- Modify: `tests/interaction.modeBridge.spec.js`
- Modify: `tests/interaction.modeMatrix.spec.js`

**Step 1: Write failing tests**
- `bootstrapV2` 不能再偷偷装配 legacy runtime 分支。
- mode store 必须是唯一可写真相源。
- `wire` 与 `endpoint-edit` 必须严格互斥。

**Step 2: Run fail-first**
Run:
`npm test -- tests/interaction.modeStore.spec.js tests/interaction.modeBridge.spec.js tests/interaction.modeMatrix.spec.js tests/app.bootstrapV2.spec.js`
Expected: FAIL until dual-source writes and mixed bootstrap are removed.

**Step 3: Minimal implementation**
- 清除 bootstrap 里的旧 runtime 装配分支。
- 禁止 legacy flags 参与写入，仅保留只读投影或删除。
- 用单状态机控制 mode 互斥切换。

**Step 4: Verify**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "refactor(interaction): converge runtime and mode source of truth"`

### Task 5: PRJ-005 and PRJ-006 topology batch transaction ordering

**Files:**
- Modify: `src/core/runtime/Circuit.js`
- Modify: `src/core/topology/ConnectivityCache.js`
- Modify: `src/core/topology/WireCompactor.js`
- Modify: `tests/circuit.topologyBatch.spec.js`
- Modify: `tests/topology.connectivityCache.spec.js`

**Step 1: Write failing tests**
- 批处理结束前 `topologyVersion` 不能先行提交。
- compaction 与 cache invalidation 顺序必须固定。

**Step 2: Run fail-first**
Run:
`npm test -- tests/circuit.topologyBatch.spec.js tests/topology.connectivityCache.spec.js`
Expected: FAIL until transaction order is deterministic.

**Step 3: Minimal implementation**
- 将 topology rebuild / compaction / dirty flag / version publish 事务化。
- 只允许在 batch commit 点更新对外可见状态。

**Step 4: Verify**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "fix(topology): serialize compaction cache invalidation and publish"`

## Week 3 - Schema, Serialization and Property Editing Consistency

### Task 6: PRJ-014 and PRJ-015 serialization contract hardening

**Files:**
- Modify: `src/core/io/CircuitSerializer.js`
- Modify: `src/core/io/CircuitDeserializer.js`
- Modify: `src/v2/infra/io/CircuitDeserializerV3.js`
- Modify: `src/v2/infra/io/CircuitSchemaV3.js`
- Modify: `tests/circuit.io.spec.js`
- Modify: `tests/circuitSchema.spec.js`
- Modify: `tests/circuitSchema.v3.spec.js`

**Step 1: Write failing tests**
- 非法字段不得静默修正为其他值。
- legacy save 进入新 schema 时必须显式记录 migration / warning / rejection 行为。

**Step 2: Run fail-first**
Run:
`npm test -- tests/circuit.io.spec.js tests/circuitSchema.spec.js tests/circuitSchema.v3.spec.js`
Expected: FAIL until silent coercion is removed.

**Step 3: Minimal implementation**
- 把“静默修正”改成显式 validation 结果。
- 为 legacy save 增加版本化迁移说明与兼容窗口策略。

**Step 4: Verify**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "fix(schema): remove silent coercion in serialization pipeline"`

### Task 7: PRJ-016, PRJ-022 and PRJ-023 property editing unification

**Files:**
- Modify: `src/ui/interaction/PropertyDialogController.js`
- Modify: `src/ui/interaction/QuickActionBarController.js`
- Modify: `src/ui/interaction/SelectionPanelController.js`
- Modify: `src/ui/interaction/UIStateController.js`
- Modify: `src/v2/infra/io/CircuitSchemaV3.js`
- Modify: `tests/interaction.propertyDialogActions.spec.js`
- Modify: `tests/interaction.propertyDialogController.spec.js`
- Modify: `tests/quickActionBarController.spec.js`
- Modify: `tests/interaction.selectionPanelController.spec.js`
- Modify: `tests/interaction.uiStateController.spec.js`

**Step 1: Write failing tests**
- 属性弹窗、侧栏、快捷栏必须共用一套校验规则与默认值来源。
- 选择态变化后旧面板内容必须立即失效。

**Step 2: Run fail-first**
Run:
`npm test -- tests/interaction.propertyDialogActions.spec.js tests/interaction.propertyDialogController.spec.js tests/quickActionBarController.spec.js tests/interaction.selectionPanelController.spec.js tests/interaction.uiStateController.spec.js`
Expected: FAIL until all editors share the same contract.

**Step 3: Minimal implementation**
- 提取 property editing contract service。
- 用 schema 驱动 editable fields / default values / validation。
- 在 selection change 时统一触发 panel invalidation。

**Step 4: Verify**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "refactor(ui): unify property editing contracts and panel invalidation"`

## Week 4 - Mobile Interaction, Observation UX and Solver Smoothing

### Task 8: PRJ-018 and PRJ-029 pointer session and gesture arbitration

**Files:**
- Modify: `src/ui/interaction/PointerSessionManager.js`
- Modify: `src/ui/interaction/TouchActionController.js`
- Modify: `src/ui/ResponsiveLayoutController.js`
- Modify: `src/ui/TopActionMenuController.js`
- Modify: `tests/interaction.pointerSessionManager.spec.js`
- Modify: `tests/touchActionController.spec.js`
- Modify: `tests/responsiveLayoutController.spec.js`
- Modify: `tests/topActionMenuController.spec.js`

**Step 1: Write failing tests**
- long press / pinch / context menu 后 pointer session 必须稳定结束或重建。
- 顶栏 / 更多菜单 / 侧栏 / 画布手势必须有显式优先级仲裁。

**Step 2: Run fail-first**
Run:
`npm test -- tests/interaction.pointerSessionManager.spec.js tests/touchActionController.spec.js tests/responsiveLayoutController.spec.js tests/topActionMenuController.spec.js`
Expected: FAIL until gesture arbitration is deterministic.

**Step 3: Minimal implementation**
- 给 pointer session 增加统一 cancel / suspend / resume 语义。
- 将菜单与画布手势纳入单一仲裁表。

**Step 4: Verify**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "fix(mobile): stabilize pointer session and gesture arbitration"`

### Task 9: PRJ-024 and PRJ-025 observation interaction parity and near-field feedback

**Files:**
- Modify: `src/ui/observation/ObservationChartInteraction.js`
- Modify: `src/ui/observation/ObservationInteractionController.js`
- Modify: `src/app/SimulationUiState.js`
- Modify: `src/ui/AIPanel.js`
- Modify: `tests/observationChartInteraction.spec.js`
- Modify: `tests/e2e.observationTouchContract.spec.js`
- Modify: `tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js`

**Step 1: Write failing tests**
- 手机端观测交互必须保留与桌面等价的核心能力。
- 错误/完成反馈必须在近场 UI 可见，而非只写状态栏。

**Step 2: Run fail-first**
Run:
`npm test -- tests/observationChartInteraction.spec.js tests/e2e.observationTouchContract.spec.js tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js`
Expected: FAIL until mobile observation parity and near-field hint delivery are enforced.

**Step 3: Minimal implementation**
- 给 observation chart 触控交互定义明确的手机降级策略。
- 把关键错误/完成反馈投递到卡片、面板或局部操作区。

**Step 4: Verify**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "feat(observation): align mobile interaction parity and local feedback"`

### Task 10: PRJ-011 solver transition smoothing

**Files:**
- Modify: `src/core/runtime/Circuit.js`
- Modify: `tests/circuit.acSubstep.spec.js`
- Modify: `tests/circuit.adaptiveTimestep.spec.js`

**Step 1: Write failing tests**
- AC 子步进与自适应步长切换边界不能出现可见跳变。

**Step 2: Run fail-first**
Run:
`npm test -- tests/circuit.acSubstep.spec.js tests/circuit.adaptiveTimestep.spec.js`
Expected: FAIL until timestep transition policy is explicit.

**Step 3: Minimal implementation**
- 明确一个周期内的步长策略冻结规则，或在切换点重采样/重置积分边界。

**Step 4: Verify**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "fix(simulation): smooth ac substep and adaptive timestep transitions"`

## Weekly Acceptance Gates

### End of Week 1

Run:
`npm test -- tests/app.storage.spec.js tests/app.storageOwnership.spec.js tests/embedRuntimeBridge.spec.js tests/app.bootstrapV2.spec.js tests/aiClient.storage.spec.js tests/observationExportService.spec.js tests/runtimeDiagnostics.pipeline.spec.js`

### End of Week 2

Run:
`npm test -- tests/interaction.modeStore.spec.js tests/interaction.modeBridge.spec.js tests/interaction.modeMatrix.spec.js tests/circuit.topologyBatch.spec.js tests/topology.connectivityCache.spec.js`

### End of Week 3

Run:
`npm test -- tests/circuit.io.spec.js tests/circuitSchema.spec.js tests/circuitSchema.v3.spec.js tests/interaction.propertyDialogActions.spec.js tests/interaction.propertyDialogController.spec.js tests/quickActionBarController.spec.js tests/interaction.selectionPanelController.spec.js tests/interaction.uiStateController.spec.js`

### End of Week 4

Run:
`npm test -- tests/interaction.pointerSessionManager.spec.js tests/touchActionController.spec.js tests/responsiveLayoutController.spec.js tests/topActionMenuController.spec.js tests/observationChartInteraction.spec.js tests/e2e.observationTouchContract.spec.js tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js tests/circuit.acSubstep.spec.js tests/circuit.adaptiveTimestep.spec.js`

### Final Gate

Run:
`npm test`

Expected: 全量通过，且 `docs/audits/project/top30.md` 中对应 `PRJ` 状态已回填。

## Backout Strategy

1. 严格执行 `1 PRJ = 1 commit = 1 rollback target`。
2. 任一批次 targeted tests 失败：先回滚当前任务，不跨批次修补。
3. 任一周末全量回归失败：暂停进入下一周，先补回归缺口。
4. 文档状态只在测试通过后更新，禁止提前将 `confirmed` 写成 `covered`。
