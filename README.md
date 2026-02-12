# High School Circuit Simulation

面向高中物理教学的浏览器电路仿真项目。支持拖拽搭建电路、实时求解电压/电流/功率、图像化观察，以及 AI 物理解释辅助。

## 项目定位

- 教学导向：覆盖高中常见电学场景（串并联、动态过程、测量、电路分析）。
- 前端静态应用：无构建步骤，直接在浏览器运行。
- 可验证：内置单元测试 + 多套回归基线（P0 / CircuitJS / AI 评估）。

## 当前能力（按代码现状）

### 1. 电路编辑与交互

- 工具箱拖拽放置元器件、网格吸附、连线吸附（端子/导线端点/导线中段）。
- 导线编辑：拖动端点、整线平移、`Ctrl/Cmd + 点击`分割导线。
- 元器件编辑：旋转、属性编辑、端子延长（沿端子方向直线伸缩）。
- 画布导航：滚轮缩放、触控双指缩放、画布平移、视图重置。
- 操作历史：Undo / Redo（快照式历史）。

### 2. 仿真与求解

- 基于 MNA（改进节点分析法）求解。
- 同时支持稳态与简化瞬态（含电容/电感/电机动态项）。
- 动态积分支持 `auto / trapezoidal / backward-euler`。
- 交流电源支持频率、相位，并带自适应子步进采样。
- 短路检测与高阻/低阻边界处理（提升数值稳定性）。

### 3. 观察与教学辅助

- 右侧属性面板：按元器件类型动态编辑参数。
- 观察面板：可配置多张 `y(x)` 曲线或 `y(t)` 波形。
- 支持导线探针（节点电压探针/支路电流探针）加入图像。
- 支持电流表/电压表“自主读数”表盘显示。
- 习题板：Markdown + LaTeX，支持编辑/预览、拖拽、缩放、排版设置。

### 4. AI 助手

- 物理解释对话：结合当前电路拓扑进行教学式解释。
- AI 面板：支持悬浮拖拽、自由缩放、折叠为悬浮按钮、空闲自动降透明度。
- AI 设置：模型选择、连接测试、模型列表拉取、日志导出/清空。
- 知识源：本地规则库或 MCP 知识服务二选一。
- 图片转电路：已下线（识别质量不满足教学稳定性要求）。

## 支持元器件

| 类别         | 元器件                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 电源/参考    | 接地（Ground）、直流电源（PowerSource）、交流电源（ACVoltageSource）                                                                |
| 电阻与半导体 | 定值电阻（Resistor）、滑动变阻器（Rheostat）、灯泡（Bulb）、二极管（Diode）、LED、热敏电阻（Thermistor）、光敏电阻（Photoresistor） |
| 储能与机电   | 电容（Capacitor）、平行板电容（ParallelPlateCapacitor）、电感（Inductor）、电动机（Motor）                                          |
| 开关与保护   | 开关（Switch）、单刀双掷开关（SPDTSwitch）、继电器（Relay）、保险丝（Fuse）                                                         |
| 仪表与容器   | 电流表（Ammeter）、电压表（Voltmeter）、黑箱（BlackBox）                                                                            |
| 连接         | 导线（Wire）                                                                                                                        |

说明：多端器件已支持（如 Rheostat/Relay/SPDTSwitch），并在节点重建与求解中按端子数处理。

## 快速开始

### 运行环境

- 浏览器：Chrome / Edge / Safari 最新版
- Node.js：`>= 18`（运行测试时需要）

### 本地运行（推荐）

```bash
python3 -m http.server 8080
```

访问 [http://localhost:8080](http://localhost:8080)

说明：项目是原生前端模块，建议通过 HTTP 服务访问，避免部分浏览器的 `file://` 模块限制。

### 安装依赖与测试

```bash
npm install
npm test
```

监听模式：

```bash
npm run test:watch
```

工程检查（lint + 格式检查 + 单测）：

```bash
npm run check
```

完整门禁（含三套回归基线）：

```bash
npm run check:full
```

架构边界说明（ESLint `boundaries`）：

- 采用“默认禁止、按层放行”策略，限制 `src` 目录跨层依赖。
- 当前层次：`entry`（`src/main.js`）/ `ui` / `app` / `ai` / `engine` / `core` / `components` / `utils`。
- 已收紧：`utils` 仅允许依赖 `utils`，不再允许 `utils -> core` 的反向依赖。
- 新增模块时请优先放在对应层内，若确需跨层依赖，先更新 `.eslintrc.cjs` 中 `boundaries/element-types` 规则并说明理由。

可选：运行时日志级别可通过 `localStorage` 控制（`silent/error/warn/info/debug`）：

```js
localStorage.setItem("app_log_level", "debug");
```

### 部署

#### Docker

```bash
docker build -t high-school-circuit-simulation .
docker run -d --name circuit-sim -p 8080:80 high-school-circuit-simulation
```

访问 [http://localhost:8080](http://localhost:8080)

#### Vercel

仓库已提供 `vercel.json`，可直接作为静态站点部署。

## 回归与基线命令

```bash
npm run benchmark:p0
npm run baseline:p0
npm run baseline:p0:update
npm run baseline:circuitjs
npm run baseline:circuitjs:update
npm run baseline:ai
npm run baseline:ai:update
```

适用场景：求解器重构、元器件模型调整、AI 流程改动后的回归验证。

## 常用快捷键

- `Ctrl/Cmd + Z`：撤销
- `Ctrl/Cmd + Shift + Z` 或 `Ctrl/Cmd + Y`：重做
- `Delete / Backspace`：删除选中对象
- `R`：旋转选中元器件
- `Esc`：取消连线/清空临时选择
- `H`：重置视图（也可点击状态栏缩放百分比）

## AI 配置说明

- 入口：AI 面板右上角“设置”。
- 默认端点：`https://api.openai.com/v1/chat/completions`。
- `API Key` 仅保存在当前会话（`sessionStorage`），关闭页面后失效。
- 其他 AI 配置（端点、模型、知识源等）保存在 `localStorage`。
- 聊天历史、AI 面板布局、电路缓存也会本地持久化。

## 目录结构

```text
.
├── index.html
├── css/
├── src/
│   ├── app/             # 交互编排层（orchestrator 等）
│   ├── components/      # 元器件定义、默认参数、SVG渲染
│   ├── core/            # 拓扑、仿真、IO 内核服务
│   │   ├── errors/
│   │   ├── topology/
│   │   ├── simulation/
│   │   └── io/
│   ├── engine/          # facade: Circuit / Solver / Matrix
│   ├── ui/              # 交互、渲染、观察面板、AI面板、习题板
│   ├── ai/              # AI客户端、Agent、Skills、知识资源、日志
│   └── utils/           # 坐标、物理计算、JSON校验等工具
├── tests/               # 单测与回归测试
├── scripts/benchmark/   # 基线脚本与数据
├── examples/
├── Dockerfile
└── vercel.json
```

## 数据与兼容说明

- 电路可导入/导出 JSON。
- 导线采用显式端点结构（`a/b` + 可选 `aRef/bRef`）。
- 为兼容历史数据，项目包含部分旧导线结构迁移逻辑与测试。
- 当前保存/加载与 schema 校验经 `core/io` 网关统一处理，`Circuit` 保留兼容 facade API（`toJSON/fromJSON`）。

## 架构分层（重构后）

- facade 层：`AIPanel`、`Circuit`、`Solver`（对外 API 保持稳定）。
- `src/app/interaction`：交互编排入口（`InteractionOrchestrator`）。
- `src/core/topology`：节点重建、导线压缩、连通缓存。
- `src/core/simulation`：印记分发、动态积分、结果后处理。
- `src/core/io`：JSON 序列化/反序列化与 schema 校验网关。
- `src/core/errors`：统一错误码与 `AppError`。
- `src/ui/ai`：聊天、设置、面板布局控制器拆分。
- `src/ui/interaction/ComponentActions`：动作层返回统一 DTO（`{ ok, type, payload?, message?, error?, code?, traceId? }`），由编排层消费与记录日志。

## 当前边界（非缺陷，属建模取舍）

- 以高中教学可解释性为优先，器件模型是“教学近似模型”，非工业级 SPICE 全量模型。
- 非线性/复杂机电耦合已覆盖基础行为，但仍是简化实现（强调可视化和课堂可用性）。
- 大规模复杂电路下，性能和收敛性仍受浏览器单线程与简化模型限制。

## 相关文档

- 代理与元器件说明：`AGENTS.md`
- 使用说明：`使用说明.md`
- 测试说明：`测试说明.md`
- 若要扩展元器件，请优先阅读 `AGENTS.md` 中的扩展流程。
