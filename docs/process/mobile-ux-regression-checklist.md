# 手机端交互回归清单

适用范围：`layout-mode-phone` / `layout-mode-compact` 相关交互改动。

## A. 必测场景（当前高风险）

1. 选中元件后，元件库自动收起，画布可继续操作
2. 已选中状态下，运行按钮可触发（不被遮罩拦截）
3. 顶部更多菜单中的“清空电路”可触发确认并清空
4. 元件库“关闭”按钮可触发并关闭抽屉
5. 首开引导关闭后不再阻塞主交互

## B. 验收标准

每一项都应满足：

1. 有明确可观察状态变化（如 `layout-open` 从 `true` 到 `false`）
2. 操作链路无“点击无反应”现象
3. 不引入桌面端回归

## C. 手工验证步骤（推荐）

1. 手机视口打开页面（390x844 或同级）
2. 打开元件库，点击任一元件
3. 确认元件库关闭，且可点击运行/更多菜单
4. 从更多菜单点击“清空电路”，确认后检查组件数量归零
5. 再次打开元件库，点击“关闭”，确认抽屉收起

## D. 自动化验证

1. 响应式回归脚本  
`npm run test:e2e:responsive`

2. 相关单测（按改动范围选择）  
`tests/responsiveLayoutController.spec.js`  
`tests/interaction.toolPlacementController.spec.js`  
`tests/interaction.panelBindingsController.spec.js`  
`tests/quickActionBarController.spec.js`

## E. 常见失效模式

1. 抽屉打开后未及时关闭，`layout-backdrop` 持续拦截触摸
2. 头部滑动手势与按钮点击冲突，导致“关闭”偶发失效
3. 选中状态过度折叠控制区，用户误判为“按钮失踪/失效”
4. 首开引导或其它 overlay 未正确隐藏，吞掉点击事件
