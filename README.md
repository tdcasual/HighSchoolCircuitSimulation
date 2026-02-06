# High School Circuit Simulation

面向高中物理教学的电路仿真项目，支持在浏览器中搭建电路、实时计算电压/电流/功率，并结合 AI 辅助进行题目分析与解释。

## 1. 功能介绍

### 核心能力
- 可视化搭建电路：拖拽元器件、网格吸附、导线连接、参数编辑
- 实时仿真求解：基于 MNA（改进节点分析法）计算电路状态
- 观测与显示：在画布上显示电压/电流/功率，支持观察面板
- AI 辅助：支持题目理解、结果解释、JSON 电路结构辅助生成
- 数据读写：支持电路 JSON 导入导出，便于题库化与复用

### 当前支持的元器件
- 电源（PowerSource）
- 定值电阻（Resistor）
- 滑动变阻器（Rheostat）
- 灯泡（Bulb）
- 电容（Capacitor）
- 电动机（Motor）
- 开关（Switch）
- 电流表（Ammeter）
- 电压表（Voltmeter）

## 2. 运行环境

- 浏览器：Chrome / Edge / Safari 最新版
- Node.js：建议 `>= 18`（仅在运行测试脚本时需要）

## 3. 快速开始

### 方式 A：直接运行（最简单）
1. 克隆或下载项目
2. 直接用浏览器打开 `index.html`

> 说明：项目是前端静态应用，直接打开即可使用。

### 方式 B：本地 HTTP 服务（推荐）
```bash
python3 -m http.server 8080
```

浏览器访问：`http://localhost:8080`

### 方式 C：开发与测试
```bash
npm install
npm test
```

## 4. 部署方式

### Docker 部署
```bash
docker build -t high-school-circuit-simulation .
docker run -d --name circuit-sim -p 8080:80 high-school-circuit-simulation
```

访问：`http://localhost:8080`

### Vercel 部署
仓库已提供 `vercel.json`，可直接导入 Vercel 项目进行静态部署。

## 5. 回归测试命令

项目内置了数值回归与基线对比脚本，适合重构后验证精度一致性：

```bash
npm run baseline:p0
npm run baseline:p0:update
npm run baseline:circuitjs
npm run baseline:circuitjs:update
npm run baseline:ai
npm run baseline:ai:update
```

## 6. 项目优势

- 教学导向强：围绕高中物理常见电路场景设计
- 上手成本低：浏览器即可运行，无需复杂环境
- 可扩展性好：元器件与求解逻辑模块化，便于继续扩展
- 有回归体系：具备 P0/CircuitJS/AI 基线脚本，便于持续演进

## 7. 当前劣势与限制

- 目前以直流稳态/简化动态为主，交流与复杂暂态覆盖有限
- 非线性器件模型较少（如二极管、三极管尚不完整）
- 大规模电路下性能与交互流畅度仍有优化空间
- AI 能力依赖提示词与模型质量，稳定性和可解释性需持续加强

## 8. 目录结构

```text
.
├── index.html
├── src/
│   ├── engine/        # 求解引擎（Circuit/Solver/Matrix）
│   ├── ui/            # 交互、渲染、观察面板、AI 面板
│   ├── ai/            # Agent / Skill / Resource 相关实现
│   └── utils/         # 几何与物理等工具模块
├── tests/             # 单测与回归测试
├── scripts/benchmark/ # 基线回归脚本
├── Dockerfile
└── vercel.json
```

## 9. 贡献与许可证

- 欢迎提交 Issue / PR 改进功能与文档
- 许可证：MIT
