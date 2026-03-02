# Batch B 预审计：Mode Fallback 可删性评估

日期：2026-03-02
目标：评估是否可删除 `UIStateController.getActiveInteractionMode` 中的 legacy flags fallback。
结论（预审计初版）：当前不可删，需先补齐初始化与调用链约束。

## 审计范围

- 候选代码：`src/ui/interaction/UIStateController.js:34-59`
- 相关初始化：`src/ui/interaction/InteractionStateInitializer.js:52-83`
- 相关 store 建立逻辑：`src/app/interaction/InteractionOrchestrator.js:100-131`
- 关键入口：`src/ui/interaction/ToolPlacementController.js:242-324`
- 现有测试契约：`tests/interaction.uiStateController.spec.js:80-105`

## 关键证据

1. fallback 仍有明确运行时语义
   - `getActiveInteractionMode` 先读 store，失败或不可用时回退到旧 flags（`pendingToolType`、`mobileInteractionMode`、`isWiring`、端点拖动 flags）。

2. `interactionModeStore` 不是启动即初始化
   - `initializeInteractionState` 仅初始化旧 flags，不创建 `interactionModeStore`。
   - store 仅在 `syncInteractionModeStore` -> `ensureInteractionModeStore` 路径下惰性创建。

3. 存在“可触发状态更新但未显式同步 store”的入口
   - `setMobileInteractionMode` 会直接 `updateStatus`，但函数体内无 `syncInteractionModeStore` 调用。
   - `setPendingToolType` 会直接 `updateStatus`，但函数体内无 `syncInteractionModeStore` 调用。
   - 这意味着在首个画布手势前，仍可能出现“status 更新发生时 store 未创建”的路径。

4. 现有测试把 fallback 视为契约
   - `tests/interaction.uiStateController.spec.js` 明确断言“store 不可用时回退 flags 并返回 `wire`”。
   - 直接删除 fallback 将导致行为契约变化，不是纯净“删冗余”。

## 风险判断

- 风险级别：中偏高（高于原 Batch B 预估）。
- 主要风险：
  - 手机端模式切换/工具选择的状态栏模式标签可能退化为默认值；
  - 在 store 读取异常场景下缺少降级路径；
  - 现有测试与行为契约直接破坏。

## 删除前置条件（升级版）

1. 强约束初始化：
   - 在 `InteractionManager` 初始化链路中保证 `interactionModeStore` 一定存在。

2. 强约束同步：
   - 对所有会影响交互模式的入口（尤其 ToolPlacement 系列）统一执行 mode store 同步。

3. 契约迁移测试先行：
   - 先改测试契约（删除 fallback 预期），新增“首个操作即有 store”的回归测试，再删实现。

4. 门禁通过：
   - `npm run lint`
   - `npm test`
   - `npm run test:e2e:wire`
   - `npm run test:e2e:responsive`
   - `npm run mode-conflict-matrix`

## 决策

- 预审计阶段状态（2026-03-02 初版）：阻塞（Not Removable Yet）。
- 行动建议（初版）：先做“store 启动即初始化 + 入口同步收敛”后，再回到本删除项。

## 执行更新（2026-03-02）

1. 前置条件达成证据
   - `InteractionManager` 启动初始化已覆盖 `interactionModeStore`（commit: `3315632`）。
   - ToolPlacement 关键入口已统一同步 mode store（commit: `3315632`）。
   - 测试契约已迁移为“store-required，缺省回落 select”（commit: `1ad7da4`）。

2. 删除执行
   - 已删除 `UIStateController.getActiveInteractionMode` 中的 legacy flags fallback（commit: `1ad7da4`）。
   - 保留 `interaction.mode.legacy-fallback` usage tracker 记录点，用于观测 store 缺失/非法状态。

3. 验证结果
   - `npm run check:legacy-prune-readiness`：PASS
   - `npm run lint`：PASS
   - `npm test`：PASS
   - `npm run test:e2e:wire`：PASS
   - `npm run test:e2e:responsive`：PASS
   - `npm run mode-conflict-matrix`：PASS

4. 最终状态
   - Batch B 当前状态：已删除（Removed）。
