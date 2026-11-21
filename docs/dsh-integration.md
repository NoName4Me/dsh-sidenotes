# DSH 0.2.2-rc.5 集成说明

> 代码依赖 DeepSeek Harness 0.2.2-rc.5 的公开能力。本文说明**当前实现**，与完整 Desktop 实机验收有所区别。

## Host 生命周期与 Session

| 需求 | DSH 接入点 |
| --- | --- |
| 读取主子 Session 的历史和事件 | `ctx.sessionQuery.observeSession(SessionId(id))` |
| Fork 继承指定事件前缀 | `buildForkSeed` 与稳定的轮次边界 |
| 创建独立 Agent / Session | `ctx.agents.create(…)` |
| 恢复已创建的子 Agent | `ctx.agents.resume(…)` |
| 追问或停止 | `agent.followup(…)` / `agent.cancel(…)` |
| 隐藏与升格 | `ctx.workspaceRegistry.archiveSession(…)` / `unarchiveSession(…)` |
| 强制禁止工具 | Agent `setup` 内 `agentCtx.tools.guard(…)` |

### 侧聊创建

- 子 Session ID 由侧聊元数据 ID 决定：`session-sidechat-{id}`。同一侧聊的重复创建必须命中同一 Session。
- **Light**：创建不继承主 Session 事件的子 Agent，注入经过长度限制的来源上下文。
- **Fork**：找到锚点所在（或紧随其后）第一个已完成的轮次，继承此前的主 Session 事件前缀。不得将源点之后的整条对话带入。
- 两种模式均通过 DSH Agent 生命周期创建并持久化子 Session，不直接把单纯内存的 `ctx.sessions.fork()` 当作完整 Agent。
- 子 Session 在空闲时归档隐藏；执行侧聊追问前暂时解除归档，空闲后重新归档。升格则公开同一个 Session，而不是复制消息。
- 插件持有并释放其创建/恢复的 Agent Handle；Host 卸载时必须清理。

### 元数据

`src/host/index.ts` 通过 `dshHomePath('state', 'sidechat.json')` 指向 Side Chat 独立 JSON Repository。它维护来源与状态，不重复保存完整消息日志。`src/host/dsh-session-adapter.ts` 使用 `session-sidechat-` 前缀。

当前版本**不包含未正式发布的旧试验包兼容或历史迁移**。

## RPC 与授权

Client 的业务调用使用逻辑通道 `/sidechat`：

```ts
connection.rpc.call('/sidechat', 'list', { parentSessionId })
```

Host 通过 DSH WebServer 注册 `auth: 'required'` 的前缀路由；这是匹配 Connection 请求/响应 Envelope 的认证 Web RPC，不是公开、匿名的 HTTP API。

Host 处理链：

1. DSH WebServer/Connection 判断浏览器会话、请求源与 Peer；不接受未授权调用。
2. RPC Router 要求调用者为 `owner`，再验证操作和参数。
3. 检查请求的父 Session 与来源消息；必要时验证已绑定的侧聊关系。
4. 调用 Coordinator/Adapter 执行创建、列表、历史、追问、停止、归档、恢复或升格。
5. 历史接口只投影有上限的用户与助手文本，不直接返回内部注入上下文、完整原生事件或工具输出。

RPC 封装限制请求体大小，并返回结构化错误。注意不要把 CLI 入口 Token 或 Session Cookie 输出到 CI 构建日志。

## Client UI 集成

- `conversation.chat.assistant-actions`：消息下方「侧聊」图标。
- `shell.overlay`：文本选区胶囊扩展与消息右侧锚点。
- `sidebarRightTabs.register(…)`：注册「旁敲侧击」原生右侧标签页。
- `sidebar.right.pane.tab`：在标签页渲染目录及独立聊天 UI。
- 消息历史通过读取 Session 投影并定期刷新；并非完全复用 DSH 主 Chat 的流式/富媒体组件。
- 选区操作在 `pointerup` 后进入 DSH 原生引用胶囊。当前 DSH 的文本交互 Slot 是独占式，因此 Client 用 React Portal 附加一个操作，升级宿主时应重点回归此处。

### Client 打包格式

Host 为 Node ESM：`lib/index.mjs`。Client **必须**是普通 script 可执行的 DSH 模块工厂，且模块 ID 为 `dsh-sidechat`：

```js
window.__ModuleLoader__.load({ id: 'dsh-sidechat', factory: (require) => {
  // bundled code
  return module.exports
}})
```

不要将 Client 打包为裸 ESM。`scripts/check-build.mjs` 校验此格式。

## 已验证与未验证

已在 CI 通过：

- Node 24、DSH 0.2.2-rc.5 TypeScript 检查及 Host/Client 打包；
- 领域/接口桥接测试；
- DSH Web Profile 插件安装、Host 激活、浏览器 Cookie 认证、`/sidechat/list` RPC 可达。

**尚待人工验收**：Desktop 真正的引用胶囊显示与点击、模型多轮生成、长文本定位高亮、Agent 工具限制、重启恢复、正式会话升格后的可见性，以及深浅主题表现。通过 RPC 冒烟测试不代表这些功能已经实测。

## 上游参考

- [DSH Host 核心架构](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/core.md)
- [UI Slots](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/slots.md)
- [原生右侧 Sidebar](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/sidebar-right.zh.md)
- [客户端原生消息操作](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-chat/src/client/chat/MessageIconActions.tsx)
