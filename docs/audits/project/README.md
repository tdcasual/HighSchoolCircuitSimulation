# Project Audit Workspace

## Purpose

该目录用于承接“跨区域、跨模块、跨用户链路”的项目总审计资产，避免问题只分散在专项 audit 中，无法形成统一排期视图。

本目录建议只保存两类内容：

1. 项目级主表（如 `Top 30`）
2. 跨区域汇总文档（例如阶段复盘、排期建议、风险雷达）

单区域深挖问题仍建议回填到原有专项目录：

1. `docs/audits/reliability/`
2. `docs/audits/wire-interaction/`
3. `docs/audits/observation-ui/`
4. `docs/audits/mobile/`

## Main Files

- `docs/audits/project/top30.md`：项目总问题池与优先级总表。
- `docs/audits/project/2026-03-07-top30-closure-review.md`：本轮 Top30 全量闭环结论与剩余开放项。

## Template Map

| 区域 | 模板 | 建议输出目录 |
|---|---|---|
| `Z0` 架构边界与运行时契约 | `docs/templates/project-audit/z0-runtime-boundary-audit-template.md` | `docs/audits/reliability/` |
| `Z1` 电路拓扑与连接正确性 | `docs/templates/project-audit/z1-topology-connectivity-audit-template.md` | `docs/audits/reliability/` |
| `Z2` 求解器与动态元件行为 | `docs/templates/project-audit/z2-solver-dynamics-audit-template.md` | `docs/audits/reliability/` |
| `Z3` 元件模型、注册表与序列化 | `docs/templates/project-audit/z3-component-schema-audit-template.md` | `docs/audits/reliability/` |
| `Z4` 画布交互、输入模式与导线编辑 | `docs/templates/project-audit/z4-interaction-mode-audit-template.md` | `docs/audits/wire-interaction/` |
| `Z5` 面板系统与结果展示 UX | `docs/templates/project-audit/z5-panel-ux-audit-template.md` | `docs/audits/observation-ui/` 或 `docs/audits/reliability/` |
| `Z6` 存储、嵌入、AI 与跨域集成 | `docs/templates/project-audit/z6-integration-runtime-audit-template.md` | `docs/audits/reliability/` |
| `Z7` 响应式、移动端与可用性 | `docs/templates/project-audit/z7-responsive-mobile-audit-template.md` | `docs/audits/mobile/` |

## Recommended Workflow

1. 先在 `docs/audits/project/top30.md` 录入候选问题或假设项。
2. 选择对应区域模板，新建区域 audit 文档并填入复现、根因和证据。
3. 如果问题被确认，再把 `top30.md` 中对应条目标记为 `confirmed`。
4. 如果问题已修复，补齐测试/脚本映射，并把状态更新为 `fixed` 或 `covered`。

## Status Legend

- `seed-hypothesis`：基于代码或历史信号推导出的候选项，尚未完成复现。
- `confirmed`：已复现并进入区域台账。
- `planned`：已纳入修复排期。
- `fixed`：已修复，待回归或已回归。
- `covered`：已有自动化防回归映射。
