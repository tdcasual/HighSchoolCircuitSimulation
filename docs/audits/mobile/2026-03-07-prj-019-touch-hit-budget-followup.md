# PRJ-019 Mobile Touch Hit Budget Follow-up

## 基本信息

- Date: 2026-03-07
- Owner: Codex
- Scope: `PRJ-019 命中区 / 吸附阈值 / 手机端偏心触点 follow-up`
- Related IDs: `PRJ-019`

## 审计目标

- 验证“看起来能点到，实际连不上”是否仍是开放风险。
- 用真实手机端 E2E 补一条比 unit test 更接近用户触摸命中的合同。
- 确认低缩放下，偏离端子中心的触点仍能完成起线与收线。

## 证据输入

- Script: `scripts/e2e/responsive-touch-regression.mjs`
- Contract test: `tests/e2e.responsiveTouchHitBudgetContract.spec.js`
- Existing unit guards:
  - `tests/interaction.snapController.spec.js`
  - `tests/component.touchTargets.spec.js`

## 新鲜验证

- `npm test -- tests/e2e.responsiveTouchHitBudgetContract.spec.js`
- `npm run test:e2e:responsive`

结果：两条命令均通过。

## 本轮新增场景

在 `responsive-touch-regression` 的手机触控流中新增一段 `PRJ-019` 专项验证：

1. 清空电路并切到手机端 `wire` 模式。
2. 将画布缩放设置到 `0.75`，模拟低缩放触控情境。
3. 放置两个电阻作为起线端与收线端。
4. 从端子命中区域的偏心位置计算触点，而不是只点击几何中心。
5. 通过 `document.elementFromPoint(...)` 解析真实命中元素，再发送 touch pointer tap。
6. 断言首次偏心触点仍会 arm wiring，第二次偏心触点仍能 finish wiring。

## 结果

`output/e2e/responsive-touch/mobile-flow-baseline.json` 中新增的 `diagnostics.phone.touchHitBudget` 为：

- `edgeBiasedTapStartArmsWiring = true`
- `edgeBiasedTapFinishCreatesWire = true`
- `edgeBiasedStartHitTag = terminal-hit-area`
- `edgeBiasedFinishHitTag = terminal-hit-area`

这说明在本轮验证覆盖下：

- 低缩放手机端，偏心触点仍能命中端子交互面。
- 起线与收线都没有因为命中预算和吸附阈值不一致而失效。
- `PRJ-019` 至少在“terminal tap -> wiring start/finish”这条主链路上已具备 E2E 级别防回归保护。

## 结论

- 本工作树内，`PRJ-019` 可从 `seed-hypothesis` 收口为 `covered`。
- 若要同步回主工作区，建议一并回填项目总表和闭环汇总，把剩余开放项从 `4` 条降到 `3` 条。
- 当前仍未覆盖的细分风险是：`wire endpoint drag` 在极密集元件和更低缩放下的误触率；这更适合作为下一条独立移动端 KPI 场景，而不是继续保留 `PRJ-019` 为开放候选。
