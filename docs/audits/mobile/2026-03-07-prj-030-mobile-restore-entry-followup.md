# PRJ-030 Mobile Restore Entry Follow-up

## 基本信息

- Date: 2026-03-07
- Owner: Codex
- Scope: `PRJ-030 手机端统一恢复入口 / guide reopen / AI return-to-edit follow-up`
- Related IDs: `PRJ-030`

## 审计目标

- 把已在工作树验证通过的手机端统一恢复入口实现正式回灌到主仓。
- 用自动化合同覆盖“稍后可找回、开始使用有真实落点、AI 打开后能一键回到编辑”三条主链路。
- 将 `PRJ-030` 从“实现已验证但未回灌”收口为主仓内可追踪的 `covered` 状态。

## 本轮实现的 contract

本轮将移动端恢复入口的实现与测试同步回主仓，形成以下最小合同：

1. `MobileRestoreBroker` 在内存中维护一个当前最高优先级的恢复候选；
2. `MobileRestoreEntryController` 将候选渲染为手机顶栏固定 `pill`，点击后统一走 `AppRuntimeV2.runMobileRestoreAction()`；
3. `FirstRunGuideController` 中：
   - 点击 `稍后` 且未 remember 时，会注册 `继续上手` 恢复候选；
   - 点击 `开始使用` 时，会清除 guide 候选并直接打开 `toolbox`，不再只停留在状态栏文案；
4. `PanelLayoutController` 中：手机态 AI 面板展开时会注册 `返回编辑 / 回到观察` 恢复候选，收起时清除；
5. `PanelBindingsController` 中：手机端进入布线/选择会标记 `build` 主任务，添加图表会标记 `observe` 主任务；
6. `ResponsiveLayoutController` 中：补充 `openDrawer()` 与 `focusCanvas()`，让恢复动作有统一落点；
7. `index.html` 与 `css/style.css` 中新增 `#mobile-restore-entry` 顶栏锚点及手机态最小命中尺寸约束。

## 测试映射

- `tests/mobileRestoreBroker.spec.js`
  - 验证候选优先级选择与 clear 后 fallback
- `tests/mobileRestoreEntryController.spec.js`
  - 验证手机态显示恢复入口并通过 runtime action 分发
- `tests/mobileRestoreGuideFlow.spec.js`
  - 验证 `稍后` 注册 `继续上手`，`开始使用` 直达真实入口
- `tests/mobileRestoreAiFlow.spec.js`
  - 验证 AI 面板展开/收起时恢复候选注册与清除
- `tests/mobileRestoreActionExecutor.spec.js`
  - 验证 runtime restore action 路由到 drawer / canvas
- `tests/mobileRestorePrimaryTask.spec.js`
  - 验证 build / observe 主任务追踪与标签文本
- `tests/mobileRestoreContract.spec.js`
  - 验证手机 E2E 脚本已检查恢复入口 DOM 与点击路径
- `tests/app.bootstrapV2.spec.js`
  - 验证 app runtime source 暴露 restore hooks
- `tests/responsiveLayoutController.spec.js`
  - 验证显式打开 toolbox 的布局动作
- `tests/e2e.aiMobileContract.spec.js`
  - 验证 AI 手机契约脚本已包含 restore anchor
- `tests/mobileCss.touchTargets.spec.js`
  - 验证手机 restore anchor 触控高度不少于 `40px`

## 新鲜验证

以下命令在工作树 `/Users/lvxiaoer/Documents/codeWork/HighSchoolCircuitSimulation-mobile-restore` 执行：

- `npm test -- tests/mobileRestoreBroker.spec.js tests/mobileRestoreEntryController.spec.js tests/mobileRestoreActionExecutor.spec.js tests/mobileRestoreAiFlow.spec.js tests/mobileRestoreContract.spec.js tests/mobileRestoreGuideFlow.spec.js tests/mobileRestorePrimaryTask.spec.js tests/app.bootstrapV2.spec.js tests/responsiveLayoutController.spec.js tests/e2e.aiMobileContract.spec.js tests/mobileCss.touchTargets.spec.js`

结果：`11 files / 41 tests` 通过。

## 结论

- `PRJ-030` 已不再只是“实现分支验证通过”，而是已回灌到主仓并有自动化合同保护。
- 因此该项可从 `confirmed` 收口为 `covered`。
- 后续若继续迭代移动端体验，重点应转向更细粒度的交互质量指标，而不是继续保留“恢复入口缺失”这一项目级开放项。
