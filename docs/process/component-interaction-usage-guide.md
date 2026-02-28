# 元器件交互使用说明

该文档用于记录高频元器件交互行为，避免“代码行为已变更但说明未更新”。

- Last Updated: `2026-04-06`
- Revision: `interaction-guide-r2-2026-04-06`

## 核心交互

| 行为 | 操作 | 说明 |
|---|---|---|
| 引脚伸缩 | `Ctrl/Cmd + 拖动端子` | 拉长或缩短元器件引脚长度（端子延长） |
| 导线分割 | `Ctrl/Cmd + 点击导线` | 在点击位置分割导线段，便于继续布线 |

## 同步规则

1. 任何涉及交互按键、手势、点击语义变化的改动，必须在同一 PR 更新本文件。
2. CI 会执行交互说明同步检查，说明缺失或关键行为未记录将直接失败。
3. 更新时优先保留“操作 + 效果 + 约束”，避免只写功能名。

## 参考来源

- `tests/interaction.orchestrator.spec.js`
- `tests/interaction.wireSegmentSnap.spec.js`
- `src/ui/interaction/DragBehaviors.js`
