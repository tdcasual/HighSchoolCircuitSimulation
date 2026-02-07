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

1. `src/ui/Interaction.js` 仍是复杂度中心（当前约 2376 行）。  
风险：单点变更影响面大，回归成本高。

2. 目标分层与实现存在偏差：`InteractionOrchestrator` 仍位于 `src/ui/interaction`。  
风险：UI 层继续承载业务编排，边界不硬。

3. `ComponentActions` 仍混合业务动作与 UI 副作用（状态文案、面板刷新）。  
风险：动作逻辑复用性和可测试隔离度不足。

4. 菜单/探针等 DOM 命令式逻辑仍集中在 `Interaction`。  
风险：可读性与维护效率下降，修改易引入行为漂移。

### P2

5. Engine facade 体量仍大：`Circuit.js`、`Solver.js` 仍有较高复杂度。  
风险：中长期继续演化时仍有理解门槛。

6. 错误模型尚未统一为分层错误码（`TOPO_/SIM_/IO_/UI_/APP_`）。  
风险：排障路径分散，可观测性不足。

7. 工程输出存在噪声（部分动作路径 `console.log`）。  
风险：测试输出信噪比下降。

## 3. Scorecard

| Dimension | Score | Notes |
|---|---:|---|
| 模块化成熟度 | 8.0/10 | 交互子模块已成型，主 facade 仍偏大 |
| 可测试性 | 9.0/10 | 单测 + baseline 护栏强，UI-heavy 部分仍有隔离成本 |
| 可维护性 | 7.5/10 | 小步提交质量高，但复杂入口尚未压平 |
| 架构一致性 | 7.0/10 | 方向正确，`app` 分层尚未完全落地 |
| 稳定性保障 | 9.5/10 | 回归链路完整，重构安全性高 |
| 技术债压力 | 6.5/10 | 债务集中在 Interaction 与 UI imperative 逻辑 |

综合评价：**A-**。项目已进入“可持续重构”状态，剩余关键任务是清理最后一批高复杂职责块并完成分层收口。

## 4. Recommended Execution Order

1. 拆 `Interaction` 剩余重块（context menu / probe / dialog 交互）。
2. 将 orchestrator 迁移到 `src/app/interaction`。
3. 将动作层改造为“结果 DTO + 上层统一 UI 刷新”。
4. 落地统一错误码与日志出口。
5. 清理调试日志，提升测试输出信号质量。

## 5. Two-Week Delivery Plan

### Day 1-3

- 新建 `ContextMenuController`，迁移元件/导线/探针菜单逻辑。
- 新增对应单测。

### Day 4-6

- 新建 `ProbeActions`，迁移探针重命名/删除/加入观察图像/新增探针。
- 保持现有外部行为不变。

### Day 7-9

- `InteractionOrchestrator` 迁移至 `src/app/interaction`。
- `Interaction` 仅保留事件转发。

### Day 10-12

- `ComponentActions` 去 UI 副作用，改为返回结果对象（DTO）。
- 由编排层统一触发状态提示与面板刷新。

### Day 13-14

- 统一错误码分层（`TOPO_/SIM_/IO_/UI_/APP_`）。
- 收敛日志策略并去除临时调试输出。

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
