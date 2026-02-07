# Interaction Modularization Design

Date: 2026-02-07  
Project: `HighSchoolCircuitSimulation`  
Goal: 在不改变对外行为的前提下，同时提升可维护性（A）与可测试性（B）。

## 1. Context

当前重构已完成 `core/topology`、`core/simulation`、`core/io` 抽取，但 `src/ui/Interaction.js` 仍是主要复杂度热点（>3000 行），并承担事件状态、业务编排、命令执行和渲染触发等多重职责。该结构导致：

- 变更扩散范围大，回归风险高。
- 单元测试难以隔离，需大量端到端场景兜底。
- UI 层与业务操作耦合，难以并行开发。

## 2. Approaches Considered

1. 结构优先（先拆文件）  
优点：短期可读性改善快。  
缺点：测试边界滞后，行为漂移风险高。

2. 测试优先（先做依赖注入）  
优点：安全性高。  
缺点：短期结构收益小，推进节奏偏慢。

3. 交替推进（推荐）  
每轮固定为“提取一个子模块 + 建立最小接口 + facade 委托 + 补测试”。  
优点：每轮都同时交付维护性和可测试性收益，且风险可控。

## 3. Target Architecture

分三层并保持单向依赖：

- `ui/*`: DOM 事件绑定、临时视图态、用户手势转换。
- `app/*`: 交互编排与命令执行（可 mock，可单测）。
- `core/*`: 电路拓扑/仿真/IO 纯逻辑服务（已建立）。

建议新增模块：

- `src/ui/interaction/PointerSessionManager.js`
- `src/ui/interaction/WireEditController.js`
- `src/ui/interaction/SelectionController.js`
- `src/ui/interaction/ViewportController.js`
- `src/app/interaction/InteractionOrchestrator.js`
- `src/app/commands/*`（按用例分命令）

`src/ui/Interaction.js` 保留为 facade/composition root，只负责装配依赖与生命周期，不承载复杂业务分支。

## 4. Data Flow

统一交互链路：

`DOM Event -> InteractionOrchestrator -> Command -> Circuit facade -> core services -> Result DTO -> Renderer`

约束：

- UI 不直接调用 `core/*` 细节，只经过 `Circuit` 或 orchestrator。
- Command 输入/输出采用显式 DTO，避免隐式共享状态。
- 渲染刷新由 orchestrator 统一调度，避免重复重绘触发。

## 5. Error Handling

统一错误分层并保留降级策略：

- `UI_ERR_*`: 会话级错误（如拖拽目标失效），终止当前手势。
- `APP_ERR_*`: 编排/命令错误，执行局部回滚并保留交互上下文。
- `CORE_ERR_*`: 求解与拓扑错误，沿用“保留 last valid result”的显示策略。

所有错误经 orchestrator 归一化为可观察事件，供日志与面板提示消费。

## 6. Iteration Plan

每轮只拆一个责任块，控制 blast radius：

1. Pointer 会话管理抽取（鼠标/触摸状态机）
2. Selection 逻辑抽取（选中、框选、hover）
3. Wire 编辑逻辑抽取（连线、分段、吸附）
4. Viewport 控制抽取（平移、缩放、坐标变换）
5. Orchestrator + Command 引入并统一编排

完成标准（每轮）：

- facade API 不变。
- 新模块具备单测。
- 目标回归集 + 全量 `npm test` + baseline 三件套通过。

## 7. Testing Strategy

测试分四层：

1. 模块单测：纯逻辑（无 DOM）。
2. 编排单测：orchestrator + mocked `Circuit`/`Renderer`。
3. 关键行为回归：`wire*`, `currentDirection*`, `solver*`。
4. 基线回归：`baseline:p0`, `baseline:circuitjs`, `baseline:ai`。

## 8. Non-Goals

- 不引入新功能。
- 不更改元器件物理模型。
- 不重做 UI 视觉层。

## 9. Exit Criteria

- `Interaction.js` 仅保留装配职责，复杂业务迁移完成。
- 交互编排逻辑可在无浏览器环境下被高覆盖率测试。
- 新增模块边界在 README/设计文档中有清晰说明。
