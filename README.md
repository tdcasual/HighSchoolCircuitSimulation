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

- 元器件行为与扩展流程：[`AGENTS.md`](AGENTS.md)
- 架构重构设计：[`docs/plans/2026-02-07-full-architecture-refactor-design.md`](docs/plans/2026-02-07-full-architecture-refactor-design.md)
- 仿真解耦设计：[`docs/plans/2026-02-08-simulation-decoupling-design.md`](docs/plans/2026-02-08-simulation-decoupling-design.md)
- 测试目录：[`tests/`](tests)
- 基线脚本：[`scripts/benchmark/`](scripts/benchmark)
- 部署配置：[`Dockerfile`](Dockerfile) / [`vercel.json`](vercel.json)

## 🤝 参与贡献

欢迎提交 issue / PR。  
如果你要新增元器件，建议先看 `AGENTS.md`，再动手实现。
