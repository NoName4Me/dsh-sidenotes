# 开发规范

## 基线

- 目标宿主：**DeepSeek Harness 0.2.2-rc.5**。
- Node.js **≥24.9**、pnpm **11.28.5**、TypeScript strict。
- `pnpm-lock.yaml` 提交入库，CI 用 `pnpm install --frozen-lockfile`。
- 插件通过 Cordis `apply(ctx)` 和 `cordis.patch.yml` 安装，保持宿主扩展边界。

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
pnpm check:manifest
node --experimental-transform-types --test integration/*.test.ts
```

## 目录与运行时

| 位置 | 说明 |
| --- | --- |
| `src/domain/` | 数据结构、业务状态机、校验与 Repository |
| `src/host/` | Cordis 服务、认证 RPC、DSH Agent/Session 适配 |
| `src/client/` | React UI、原生 DSH UI Slots、右侧 Sidebar |
| `src/shared/` | 客户端与 Host 的通信常量 |
| `tests/`、`integration/` | 领域与真实 DSH API 的桥接验证 |

Host 与 Client 必须保持模块边界：Node.js 模块不进入浏览器 Bundle；跨边界仅共享可序列化协议和类型。避免在业务层使用 `any` 绕过权限或 Session 身份校验。

### DSH Client 产物要求

**不可输出裸 ESM。** DSH Web/Desktop 以普通 script 加载扩展。`tsdown.config.ts` 生成 CJS 产物 `lib/client.js`，以以下工厂包装：

```js
window.__ModuleLoader__.load({
  id: 'dsh-sidechat',
  factory: (require) => {
    // bundled client code
    return module.exports
  },
})
```

这是结构示意，具体构建由 tsdown 负责。`scripts/check-build.mjs` 必须核对这个 ID 和工厂格式；不能仅检查文件存在。

### 服务与数据

- 包名、`dsh.plugin.json`、`cordis.patch.yml`、Host/Client 标识统一使用 `dsh-sidechat`。
- RPC 通道为 `/sidechat`；应遵守 DSH 认证与权限模型。
- Host 持久化元数据位于 `state/sidechat.json`；新子 Session 前缀为 `session-sidechat-`。
- 项目未正式发布，无需为未发布的旧包名或存储路径引入迁移代码。
- 元数据 Repository 是单进程 JSON 实现，不要跨多个 DSH Host 进程同时写同一个文件。

## 交互与安全约定

- 原生右 Sidebar 是唯一目录；不要恢复额外的浮动圆点轨道。
- 选区入口应在鼠标释放后与原生「引用文本」胶囊共存，不能在 `selectionchange` 期间反复改写 DOM/selection。
- 回复全量定位到 `assistant-step` 内容，而不是底部 `turn-tail` 操作栏；选区只高亮匹配范围。
- 统一 DSH `--dsw-*` Token、原生 Tooltip 与图标；适配深浅主题、窄窗口与减少动效。
- **Host 侧**验证调用者、父子 Session、参数和工具权限；不能仅靠 UI 或提示词。
- 默认拒绝侧聊 Agent 的全部工具执行；不能向主会话静默发送、注入或修改消息。
- 不记录 Token、消息正文、选中敏感信息、工作区文件内容等到日志。

## 提交与合入

- 使用 Conventional Commits，按**功能模块**提交，一次包含实现、类型、必要测试与文档；避免琐碎提交。
- 改动 Host/Client 接口时运行编译、领域测试和相关集成测试，并检查 Web Profile 插件启动。
- 构建/集成验证不等于 Desktop 人工验收。未验证的功能必须明确标注。
- 禁止提交 `node_modules`、构建输出、Token、`.npmrc` 机密内容。

## npmjs.org 发布

唯一公开包名：**`dsh-sidechat`**，不带 scope。

工作流：[`publish-npm.yml`](../.github/workflows/publish-npm.yml)，**仅手动触发**、仅允许主仓库 `master`。它执行类型检查、构建、单元/桥接测试、Manifest 与 npm pack 检查，再发布公开包。

- 首次发布可使用仓库 Secret `NPM_TOKEN`，手动选择 `npm-token`；确保遵循 npm 账户的 2FA 和 token 要求。
- 完成 npm 包的 Trusted Publishing 配置后选择 `oidc`，使用 GitHub OIDC 替代长期发布 Token。
- `0.1.0-dev.6` 使用 `dev` 标签；正式版使用 `latest`。已发布的 npm `name@version` 不可覆盖。
- 不触发自动发布，也不再使用 GitHub Packages 发布脚本。

参见 [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)。
