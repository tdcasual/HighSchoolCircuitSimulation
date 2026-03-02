# Legacy Prune Final Report (Week5-10)

日期：2026-03-02  
范围：`docs/plans/2026-03-02-architecture-de-risk-week5-10-implementation.md`

## 1. 目标与结论

目标：将 Week1-4 双轨兼容状态收敛到 mode-store 单轨，并按风险分批删除 legacy 兼容路径。  
结论：Week5-10 计划任务已按批次落地，核心兼容写回/回退路径完成收敛，主门禁与关键 E2E 全绿。

## 2. 分批执行摘要

### Batch A（低风险）

- `ec3ee3a`：删除无引用 script alias。
- `c89dbdb`：删除 Toolbox wire legacy fallback。

### Batch B（中风险）

- `3315632`：补齐 mode-store 启动初始化与入口同步约束（删除前置条件）。
- `1ad7da4`：删除 `UIStateController` legacy mode fallback。

### Batch C（中高风险）

- Slice A：`5db4799` 停写 classroom legacy bool key（保留只读兼容窗口）。
- Slice B：
  - `d005ed4` 形成 observation legacy schema 审计分类。
  - `2ec3aba` 删除可删 alias 分支（`title/presetName/bindingMap/plot/plotId/target/source/quantity`）。

### Batch D（高风险）

- `e12654d`：删除 interaction 层 `store -> legacy flags` 镜像回写；保留 `interactionMode` 作为轻量状态投影。

## 3. 关键设计收敛点

1. mode-store 权威化
- `sync/initialize` 不再把 store context 反向写回 legacy runtime flags。
- 旧 flags 仅作为运行态字段逐步收敛，不再由 store 自动“喂回”。

2. 触控会话耦合降低
- pinch 悬挂连线会话优先从 `interactionModeStore.context` 捕获 wire-tool 元数据，降低旧字段分歧风险。

3. schema 兼容边界收紧
- observation template 只保留高价值 legacy 入口：`templateName + plotBindings + 顶层 legacy UI 字段`。

## 4. 测试与门禁结果

本轮执行通过：

- `npm run check:legacy-prune-readiness`
- `npm run check:registry-guard`
- `npm run check:ci-workflow`
- `npm run lint`
- `npm test`
- `npm run test:e2e:wire`
- `npm run test:e2e:responsive`
- `npm run mode-conflict-matrix`

补充定向回归：

- `tests/interaction.modeStore.spec.js`
- `tests/interaction.pointerSessionManager.spec.js`
- `tests/interaction.orchestrator.spec.js`
- `tests/observationState.spec.js`
- `tests/observationPanel.quickBind.spec.js`

## 5. 剩余风险与后续建议

1. 仍存在 runtime flags 的本地写读
- 这些字段已不再由 store 统一回写；后续若继续收敛，可逐步让交互分支直接读取 mode-store state/context。

2. 极老 observation 模板降级行为
- 仅使用已移除 alias 的历史模板会回落到默认值/忽略绑定项；已通过测试固定当前降级语义。

3. 回滚策略
- 维持“单任务单 commit”可回滚粒度：任意回归可 `git revert <commit>` 到前一稳定点。
