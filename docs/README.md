# 文档系统总览

本文档用于统一项目内的改进记录方式，避免后续优化出现“信息分散、过程不可追踪、回归无法复现”。

## 目录分工

| 目录 | 作用 | 典型内容 |
|---|---|---|
| `docs/plans/` | 设计与实施计划 | 方案对比、任务拆解、实施步骤 |
| `docs/audits/` | 质量审计与改进日志 | 移动端交互审计、问题复盘、日更记录 |
| `docs/releases/` | 发布与验收材料 | release notes、QA checklist、回滚方案 |
| `docs/process/` | 团队流程规范 | 改进闭环、回归检查清单 |
| `docs/templates/` | 标准模板 | 改进记录模板、后续可扩展模板 |

## 什么时候更新哪类文档

1. 新发现问题或体验缺陷  
写入 `docs/audits/...`（可从模板复制）。

2. 需要跨文件/跨模块改动  
先在 `docs/plans/...` 写实现计划，再动代码。

3. 修复完成并准备验收  
在对应 audit 文档补齐验证证据（命令、结果、artifact）。

4. 达到发布条件  
同步更新 `docs/releases/...` 的 QA 与 release note。

## 命名规范

1. 计划文档：`YYYY-MM-DD-<topic>-design.md` / `YYYY-MM-DD-<topic>-implementation.md`
2. 改进记录：`YYYY-MM-DD-<topic>.md`
3. 文件名使用小写英文和连字符，避免空格与中文文件名。

## 最小合格证据

每次“已修复/已优化”结论，至少包含：

1. 可复现步骤（含设备或视口条件）
2. 根因定位（具体到模块/函数）
3. 修复点清单（文件路径）
4. 验证命令与结果（单测/集成/E2E）
5. 残留风险与下一步

## 快速入口

- 改进闭环流程：[`docs/process/improvement-workflow.md`](./process/improvement-workflow.md)
- 手机端回归清单：[`docs/process/mobile-ux-regression-checklist.md`](./process/mobile-ux-regression-checklist.md)
- 改进记录模板：[`docs/templates/improvement-log-template.md`](./templates/improvement-log-template.md)
