# Browser Compatibility Matrix

适用范围：课堂演示与学生端网页访问（最新版稳定版浏览器优先）。

## Execution Baseline

- 自动化 smoke 命令：`npm run test:e2e:compat`
- 产物目录：`output/e2e/browser-compat/`
- 必选门禁：`Chromium`（CI 与本地都要求 PASS）
- 可选观察：`Firefox` / `WebKit`（若本机未安装会标记 `skipped`，不阻塞）

## Support Matrix

| Browser Family | Engine | Tier | Automated Smoke | Current Status |
|---|---|---|---|---|
| Chrome / Edge (latest) | Chromium | P0 (required) | Yes (`test:e2e:compat`) | PASS required |
| Firefox (latest) | Gecko | P1 (recommended) | Best-effort (`test:e2e:compat`) | Optional |
| Safari 17+ (macOS/iPadOS) | WebKit | P1 (recommended) | Best-effort (`test:e2e:compat`) | Optional |
| Legacy / EOL browsers | Mixed | Out of scope | No | Unsupported |

## What Smoke Covers

- 页面可初始化到 `window.app.chartWorkspace` 契约
- 图表窗口新增动作可执行（窗口数 +1）
- 启停仿真调用不抛异常
- 浏览器级截图与 `smoke-summary.json` 产物可追溯

## Manual Follow-up (when needed)

- 若 Firefox/WebKit 出现 `fail`，需要补做一次手工回归：
  - 观察窗口新增/收起
  - 关键触控按钮响应
  - 仿真启动/停止
