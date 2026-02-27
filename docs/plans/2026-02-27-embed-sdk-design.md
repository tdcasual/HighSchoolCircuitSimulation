# 高中电路模拟器嵌入 SDK 设计（deployggb.js 风格）

## 目标

- 提供一个可在第三方页面直接接入的 SDK（`deploycircuit.js`）。
- 使用 iframe 进行运行时隔离，宿主页与运行时通过 `postMessage` 通信。
- 支持课堂场景常见能力：加载电路、运行/停止、导出、只读与课堂模式切换。

## 架构

1. `deploycircuit.js`（宿主侧加载器）
   - 异步加载 `src/embed/EmbedClient.js`。
   - 暴露 `window.HSCSAppletReady` 与 `window.HSCSApplet`。

2. `EmbedClient`（宿主侧 API）
   - 负责 iframe 注入、握手、请求-响应关联、事件订阅。
   - 提供 `run/stop/loadCircuit/exportCircuit/getState/setOptions`。

3. `EmbedRuntimeBridge`（iframe 运行时）
   - 运行在模拟器应用内部，接收并处理宿主请求。
   - 将协议方法映射到现有 `app` 能力（`startSimulation`、`clearCircuit`、`buildSaveData`、`loadCircuitData` 等）。

4. `embed.html`
   - 稳定入口，重定向到 `index.html?embed=1...`，避免直接暴露主入口细节。

## 协议

- `channel`: `HSCS_EMBED_V1`
- `apiVersion`: `1`
- 消息类型：
  - `request`: `method + id + payload`
  - `response`: `ok + id + payload/error`
  - `event`: `method + payload`（例如 `ready`、`status`）

## 运行时模式

- `edit`: 编辑模式（默认）。
- `classroom`: 课堂模式（可设置 `standard/enhanced`）。
- `readonly`: 只读模式（禁用画布交互，默认隐藏编辑性面板）。

支持 feature flags：
- `toolbox`
- `sidePanel`
- `observation`
- `ai`
- `exerciseBoard`
- `statusBar`

## 设计要点

- 嵌入模式默认禁用本地缓存恢复与自动保存，避免宿主环境污染。
- 新增 `loadCircuitData`，统一文件导入、缓存恢复、嵌入加载三条路径。
- `ClassroomModeController` 新增按级别设置接口，供嵌入协议直接调用。
- 错误码最小集合：`FORBIDDEN`、`INVALID_PAYLOAD`、`UNSUPPORTED_METHOD`、`INTERNAL_ERROR`。
