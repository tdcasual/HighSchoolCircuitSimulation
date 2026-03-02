# Legacy Code Removal Checklist (Phase Plan)

更新时间：2026-03-02
目标：在不引入交互回归的前提下，分批删除已完成迁移后的旧路径/冗余入口。
Week5-10 执行轨道：`docs/plans/2026-03-02-architecture-de-risk-week5-10-implementation.md`

## 删除准入门槛（每一批都要满足）

1. 先给出“删除候选清单 + 风险级别 + 回滚点”。
2. 只删一类风险级别相同的内容（禁止一批混删多类高风险代码）。
3. 删除后必须通过：
   - `npm run lint`
   - `npm test`
   - `npm run test:e2e:wire`
   - `npm run test:e2e:responsive`
   - `npm run mode-conflict-matrix`
4. 如果任一门禁失败，本批回退，不继续下一批。

## 分批策略

### Batch A（低风险，先试删）

- 范围：无引用的冗余入口（script alias、重复命令别名）。
- 候选：
  - `package.json` 中 `test:interaction-mode`（仅在 `package.json` 自身出现，无工作流/文档/测试依赖）。
  - `src/ui/interaction/ToolboxBindingsController.js` 中 `addWireAt` 缺失时手工造导线 fallback（运行时委托链已覆盖）。
- 风险：低。
- 预期收益：减少维护噪音，避免“看起来还在使用”的误导。

### Batch B（中风险）

- 范围：ModeStore 迁移后的 legacy fallback 读取路径（仅限调用已被新路径覆盖者）。
- 候选：
  - `src/ui/interaction/UIStateController.js` 内“store 读取失败时回退旧 flags”路径。
- 风险：中。
- 前置条件：
  - 连续两轮主干回归全绿。
  - 确认运行期所有入口都初始化了 `interactionModeStore`。
- 2026-03-02 预审计结论：
  - 当前不满足删除前置条件，详见 `docs/plans/2026-03-02-batch-b-mode-fallback-audit.md`。
  - 结论：暂不删除，保持 fallback。

### Batch C（中高风险）

- 范围：历史存储兼容读路径（localStorage legacy key / old schema migration）。
- 候选：
  - `src/ui/ClassroomModeController.js` 中 legacy bool key 兼容读取。
  - Observation 历史模板字段迁移的兼容分支。
- 风险：中高。
- 前置条件：
  - 发布说明明确“兼容窗口结束”。
  - 提供一次性迁移脚本或迁移公告。

### Batch D（高风险）

- 范围：跨模块兼容镜像字段（为了旧调用者保留的字段回写）。
- 候选：
  - Interaction 各 controller 内旧 flags 同步写回路径。
- 风险：高。
- 前置条件：
  - Telemetry/日志证据表明旧调用路径为 0。
  - 先在预发布分支灰度一周。

## 回滚策略

1. 每批单独 commit，失败即 `git revert <batch-commit>`.
2. 严禁跨批次 squash 后再验证。
3. 回滚后必须重新跑全量门禁再继续。

## 当前状态

- Batch A：已完成第 1 轮（commit: `ec3ee3a`，删无引用 script alias）。
- Batch A：已完成第 2 轮（commit: `c89dbdb`，删 Toolbox wire legacy fallback）。
- Batch B：预审计已完成，结论为“暂缓删除（阻塞中）”。
- Batch C/D：未开始。

## Week5-10 落地状态（2026-03-02 起）

- Week 5：进行中（删前观测能力已落地：legacy path usage tracker）。
- Week 6：未开始（目标：mode store 初始化强约束 + ToolPlacement 同步收敛）。
- Week 7：未开始（目标：执行 Batch B 删除）。
- Week 8：未开始（目标：执行 Batch C Slice A）。
- Week 9：未开始（目标：执行 Batch C Slice B）。
- Week 10：未开始（目标：执行 Batch D 与大规模删除窗口）。
