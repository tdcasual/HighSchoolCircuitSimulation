# Interaction Architecture Evaluation Design

Date: 2026-02-07  
Project: `HighSchoolCircuitSimulation`  
Type: Engineering Architecture Evaluation (Issue List + Scorecard)

## 1. Evaluation Scope

本次评估聚焦工程架构质量，不评审新功能价值。覆盖范围：

- UI 交互层拆分进度（重点：`src/ui/Interaction.js`）。
- 分层一致性（`ui -> app -> core`）。
- 动作层与编排层职责边界。
- 测试与回归护栏有效性。
- 可维护性与后续重构成本。

基准依据：

- 当前代码结构与最近重构提交（interaction 连续小步抽取）。
- 测试体系（`vitest` 单测 + `baseline:p0/circuitjs/ai`）。
- 已有架构与模块化设计文档。

## 2. Findings (Ordered by Risk)

### P1

1. `src/ui/Interaction.js` 仍是复杂度中心（当前约 2124 行）。  
风险：单点变更影响面大，回归成本高。

2. `ComponentActions` 仍混合业务动作与 UI 副作用（状态文案、面板刷新）。  
风险：动作逻辑复用性和可测试隔离度不足。

3. `Interaction` 中仍保留较多 DOM/手势分支，部分路径尚未进一步下沉。  
风险：可读性与维护效率仍受影响，修改易引入行为漂移。

### P2

4. Engine facade 体量仍大：`Circuit.js`、`Solver.js` 仍有较高复杂度。  
风险：中长期继续演化时仍有理解门槛。

5. 交互日志已接入 `Logger`，但与 AI 日志体系尚未统一。  
风险：跨域排障时 trace 链路割裂。

6. 工程输出存在噪声（部分动作路径 `console.log`）。  
风险：测试输出信噪比下降。

## 3. Scorecard

| Dimension | Score | Notes |
|---|---:|---|
| 模块化成熟度 | 8.5/10 | 菜单/探针/动作已拆分，主 facade 仍偏大 |
| 可测试性 | 9.2/10 | 单测 + baseline 护栏强，错误码与日志路径已可断言 |
| 可维护性 | 8.0/10 | 小步提交质量高，剩余复杂入口需继续压平 |
| 架构一致性 | 8.4/10 | `app` 分层与错误收口已落地，仍有 UI 副作用待迁移 |
| 稳定性保障 | 9.5/10 | 回归链路完整，重构安全性高 |
| 技术债压力 | 7.2/10 | 关键债务已下降，集中在 Interaction 与日志统一 |

综合评价：**A**。项目已进入“可持续重构 + 可观测”阶段，后续重点是继续压缩复杂入口与统一日志体系。

## 4. Recommended Execution Order

1. 继续压缩 `Interaction` 主类（优先 pointer/wire 重分支），向 `<= 1500` 目标推进。
2. 将 `ComponentActions` 的 UI 副作用进一步上移到 orchestrator。
3. 统一 `src/utils/Logger` 与 AI 日志链路，建立跨域 trace 查询。
4. 清理调试日志，提升测试输出信号质量。

## 5. Two-Week Delivery Plan

### Day 1-5

- 继续拆分 `Interaction` 重分支（pointer/wire/selection 组合路径）。
- 补充对应 orchestrator 单测与回归样例。

### Day 6-10

- `ComponentActions` 进一步去 UI 副作用，仅返回 DTO。
- 由 orchestrator 统一触发状态提示与面板刷新。

### Day 11-14

- 融合交互日志与 AI 日志 trace 策略。
- 收敛临时调试输出并保持 baseline 全绿。

## 6. Quantitative Exit Criteria

1. `src/ui/Interaction.js` 行数降至 `<= 1500`。  
2. 新增交互拆分相关测试 `>= 20` 条。  
3. 每次阶段提交必须通过：  
   - `npm test`  
   - `npm run baseline:p0`  
   - `npm run baseline:circuitjs`  
   - `npm run baseline:ai`
4. UI 层不得直接调用 core 细节，仅通过 facade/orchestrator。

## 7. Non-goals

- 不引入新教学功能。
- 不改动物理模型与求解策略。
- 不改 UI 视觉风格。

## 8. Decision

结论：保持当前“小步抽取 + 强回归验证”节奏不变，进入第二阶段“分层收口”执行。  
优先目标是把 `Interaction` 从“复杂入口”降为“轻量装配与事件转发入口”。
