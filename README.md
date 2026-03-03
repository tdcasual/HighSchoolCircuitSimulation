# ⚡ High School Circuit Simulation

一个面向高中物理课堂的电路模拟器。  
拖一拖、连一连，就能看到电压、电流、功率和波形变化。

## 🎯 这个项目适合谁

- 👩‍🏫 老师：做课堂演示、讲串并联、讲测量仪表
- 🧑‍🎓 学生：动手搭电路，边试边学
- 🧪 开发者：基于现有模型继续扩展元器件和交互

## ✨ 你可以做什么

- 🧩 拖拽搭电路：电源、电阻、开关、灯泡、电容、电感、电机、仪表等
- 📈 实时观察：节点电压、支路电流、功率、曲线图
- 🔍 探针测量：对导线和节点做可视化观测
- 🤖 AI 辅助：结合当前电路状态给出物理解释

## 🧭 观察运行时契约（2026-03-03）

- 运行时观察链路以 `ChartWorkspace` 为唯一真相（`window.app.chartWorkspace`）。
- `ObservationPanel` 仅作为迁移期代码资产，不作为当前运行时契约。
- 设计决策记录见：[`docs/adr/2026-03-03-observation-sot.md`](docs/adr/2026-03-03-observation-sot.md)。

## 📊 Observation v2（2026-02）

- 双模式：`基础` / `高级`，在手机端默认以低干扰观察流程为主
- 快速预设：`U-t` / `I-t` / `P-t` 一键加图，并优先绑定当前选择对象
- 图像交互：支持长按冻结读数、十字准星与读数覆盖层
- 状态迁移：`observation` 配置向后兼容，旧存档自动归一化到 v2 schema
- 渲染稳定性：观察面板采用 RAF 去重调度，减少批量更新抖动

## 📦 v0.9 RC 更新（2026-03）

- 移动端交互：误触防护、单手快捷操作、吸附容差与触控编辑流程优化
- 观察链路：模板保存/加载、联动准星、自动量程稳定、图像导出
- 教学场景：内置 6 个课堂预设（串联/并联/分压/RC/电机/测量）
- 首次引导：支持跳过与“记住选择”，减少回访用户干扰
- AI 教学：运行时故障诊断可映射为“发生了什么/为什么/如何修复”教学提示
- 质量门禁命令：`check:full` + P0/CircuitJS/AI baseline；请以当前 CI 运行结果为准。

## 🛡️ v0.10 稳定性门禁（2026-03）

- 稳定性清单：[`docs/releases/v0.10-stability-checklist.md`](docs/releases/v0.10-stability-checklist.md)
- 本轮报告：[`docs/reports/2026-03-02-architecture-derisk-report.md`](docs/reports/2026-03-02-architecture-derisk-report.md)
- 新增矩阵命令：`npm run mode-conflict-matrix`

## ✅ v1.0 8-Day 冲刺档案（目标日期：2026-04-06）

- 说明：以下内容为里程碑归档引用，不代表当前分支即时门禁状态。

- 发布门禁：[`docs/releases/v1.0-8day-readiness-gate.md`](docs/releases/v1.0-8day-readiness-gate.md)
- Go/No-Go 矩阵：[`docs/releases/v1.0-8day-go-no-go-matrix.md`](docs/releases/v1.0-8day-go-no-go-matrix.md)
- 收官审计：[`docs/audits/mobile/2026-04-06-sprint-closure-review.md`](docs/audits/mobile/2026-04-06-sprint-closure-review.md)

## 🔄 迁移说明（v0.9 RC）

- Observation 配置可直接沿用旧存档，加载时会自动归一化到 v2 schema。
- 场景包导入路径更新为：
  - `src/engine/scenarios/ClassroomScenarioPack.js`
- 嵌入打包脚本对 `examples/` 目录改为可选；缺失时不会阻塞 `build:frontend / package:embed / docker build`。

## 🚀 快速开始

1. 安装依赖

```bash
npm install
```

2. 启动本地静态服务

```bash
python3 -m http.server 8080
```

3. 打开浏览器访问  
   [http://localhost:8080](http://localhost:8080)

## 🧪 常用命令

```bash
npm test
npm run baseline:p0
npm run baseline:circuitjs
```

## 🔌 嵌入发布（类似 deployggb.js）

```bash
# 1) 生成前端静态构建目录 dist/
npm run build:frontend

# 2) 导出嵌入包 output/embed-package/
#    包含 viewer.html + embed.js + assets/
npm run package:embed

# 3) 生成 EdgeOne 目录 dist/embed/
npm run build:edgeone
```

宿主页最小接入：

```html
<script src="https://your-host/embed.js"></script>
<div id="sim"></div>
<script>
  const applet = new window.HSCSApplet({
    src: "https://your-host/viewer.html",
    targetOrigin: window.location.origin,
  });
  applet.inject("#sim");
</script>
```

## 📚 深入阅读（技术细节）

- 文档系统入口：[`docs/README.md`](docs/README.md)
- 观察链路清债闭环：[`docs/reports/2026-03-03-observation-tech-debt-closure-report.md`](docs/reports/2026-03-03-observation-tech-debt-closure-report.md)
- 改进闭环流程：[`docs/process/improvement-workflow.md`](docs/process/improvement-workflow.md)
- 手机端交互回归清单：[`docs/process/mobile-ux-regression-checklist.md`](docs/process/mobile-ux-regression-checklist.md)
- 元器件行为与扩展流程：[`AGENTS.md`](AGENTS.md)
- 架构重构设计：[`docs/plans/2026-02-07-full-architecture-refactor-design.md`](docs/plans/2026-02-07-full-architecture-refactor-design.md)
- 仿真解耦设计：[`docs/plans/2026-02-08-simulation-decoupling-design.md`](docs/plans/2026-02-08-simulation-decoupling-design.md)
- 测试目录：[`tests/`](tests)
- 基线脚本：[`scripts/benchmark/`](scripts/benchmark)
- 部署配置：[`Dockerfile`](Dockerfile) / [`vercel.json`](vercel.json)
- v0.9 发布说明：[`docs/releases/v0.9-rc1-release-notes.md`](docs/releases/v0.9-rc1-release-notes.md)
- v0.9 QA 清单：[`docs/releases/v0.9-qa-checklist.md`](docs/releases/v0.9-qa-checklist.md)

## 🤝 参与贡献

欢迎提交 issue / PR。  
如果你要新增元器件，建议先看 `AGENTS.md`，再动手实现。
