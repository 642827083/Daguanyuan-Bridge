# Daguanyuan Bridge 开发规范（AI 必读）

## 总则

- 本目录是 MarginNote 插件项目。除 `web/` 目录外，运行环境与前端 / Node 不同，不要按浏览器假设实现。
- 将每次输出视为尝试，先验证再扩展；优先小步改动和可回滚方案。

## 版本与打包

- 正式版本以 `package.json`、`package-lock.json` 和 `src/mnaddon.json` 为准，三处必须一致。
- 开发、修复、测试及生成测试包时不得自动增加版本号，保持当前版本。
- 测试安装包固定为 `Daguanyuan Bridge Test.mnaddon`；只可替换该文件，不得生成或覆盖正式版本安装包。
- 默认构建命令只能生成测试包。正式构建必须使用独立命令，并在同名正式包已经存在时停止，禁止覆盖。
- 用户明确表示测试“成功了”后，先询问本次正式版本号。得到版本号后，才能更新三处版本、生成正式包及处理社区介绍文档。
- 未获用户“成功了”确认前，不得修改社区介绍 Markdown、增加正式更新记录或提交本地 Git。
- 用户明确说“成功了”后，将本次确认的修改提交至当前 Git 分支；只提交本地，不推送远程。

## Git 提交

- 所有分支的 Git 提交信息统一使用中文，准确概括本次修改内容。

## 讨论与实施

- 新功能、界面调整、修复、构建和打包均须先说明方案、影响范围和验证方式。
- 用户明确说“就按这个修改”或等价确认前，不得改动源码、版本、安装包或社区介绍 Markdown。
- 需求存在多种合理实现、可能有实现风险、输入不完整，或查阅文档后仍无法确定行为时，先澄清触发入口、作用场景、数据来源与期望输出。

## 文档优先

- 改动前优先使用 `mn-docs-mcp` 的 `mndocs` 检索，并以文档为准，不凭记忆猜测 API 或副作用。
- MCP 不可用时，阅读 <https://mn-docs.museday.top>；仍不明确则停止实现并索取官方文档片段、可运行示例、最小复现与期望行为。
- 开始修改 `src/` 前，必须查阅：
  - <https://mn-docs.museday.top/reference/js-runtime/>
  - <https://mn-docs.museday.top/reference/global/global-variables/>

## MarginNote 运行时

- `src/` 在 JavaScriptCore 中运行，不存在浏览器的 `window`、`document`、`fetch`、`localStorage`、`setTimeout` 和 `setInterval`。
- 网络请求不得使用 `fetch`；严格按文档使用系统网络 API 与回调。涉及 `NSData`、文本或 JSON 转换时，按文档实现。
- `main.js` 只做入口和导入：仅允许调用 `JSB.require(...)`，不得定义业务函数，也不得使用 `require` 或 `import`。
- 只有 `main.js` 可调用 `JSB.require(...)`。其他脚本不得调用，避免污染共享全局上下文。
- 业务实现放在独立文件，保持职责单一；全局标识符需使用插件前缀或 IIFE 闭包隔离。
- `self` 仅在插件实例方法中可用，不得在模块顶层假设其存在。
- 日志统一使用 `console.log`，不得使用 `JSB.log`。
- 修改后至少重新阅读改动代码，并运行相应测试与语法检查；构建本身不提供语法校验。

## WebView 与 Bridge

- `web/` 在浏览器 WebView 中运行，可使用 React、DOM、`window` 和 `document`；不得与 `src/` 的 JavaScriptCore API 混用。
- 修改 Web 页面时，保持现有标题层级、外框、分栏、间距、卡片、按钮与响应式设计的一致性。
- 前端统一从 `web/src/lib/mnBridge.js` 引入 `MNBridge`，通过 `MNBridge.send(command, payload)` 与插件层通信。
- 新增 bridge 命令时，前端只发送命令；在 `src/WebBridgeCommands.js` 添加同名处理函数。
- `web/` 不得直接访问 `Application`、`Database`、`Note` 或 `JSB` 等 MarginNote 原生对象。
- 不修改 `src/web-dist/`，应修改 `web/` 源文件。

## Web 持久化

- WebView 不是业务数据真源。用户数据、配置、映射、任务、收藏、预设和密钥必须通过 bridge 交由 `src/` 持久化。
- 禁止将业务数据写入 `localStorage`、`sessionStorage`、`indexedDB`、`CacheStorage` 或 Service Worker 缓存；它们最多保存可丢失的 UI 状态。
- 小型开关、面板状态、窗口 frame、最近模式优先使用带插件前缀 key 的 `NSUserDefaults`。
- 结构化持久数据优先保存至 `Application.sharedInstance().documentPath + "/<AddonId>/"` 下的 JSON；临时文件使用 `tempPath` 并在完成后校验、移动。
- JSON 读写优先使用 `NSJSONSerialization` 与 `NSData.writeToFileAtomically(path, true)`，并处理空文件、非法 JSON、schema 迁移和默认值。
- 历史 `localStorage` 数据仅可做一次 allowlist 迁移：成功写入 Native 后删除旧值，不得长期双写。

## 注释

- 源代码的所有注释使用中文；英文字符串、接口路径、变量名和测试数据不属于注释，无需翻译。
