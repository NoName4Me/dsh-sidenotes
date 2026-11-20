# 开发规范

本项目为 DSH 扩展，不是 DSH 的 Fork。严格以目标 DSH 版本和公开 API 为准；存在差异时先落兼容性记录再调整。

## 技术栈与边界

- Node.js 24.9+；TypeScript strict，独立 Host/Client 入口。
- DSH 插件采用官方 Cordis `apply(ctx)` 生命周期及 `dsh.bundle.patch` 加载机制。
- tsdown 负责打包；领域/Host 协调层使用 Node 内置 node:test；静态校验使用 TypeScript strict、Prettier（后续增加 ESLint 视实际集成需要）。
- 使用 pnpm 管理依赖并提交 lockfile。不得在不同环境随意浮动 DSH 开发依赖版本。
- Host/Client 通过明确的协议类型通信。DOM 代码不得进入 Host，Node.js 模块不得进入 Client。
- 源码目录建议 `src/domain/`、`src/host/`、`src/client/`、`src/shared/`；实现中以职责边界为准。

## 代码约定

1. 每个模块有清晰的导出与单一职责；不使用 `any` 绕过宿主类型。
2. 保持 DSH 自带的注册/撤销机制；界面只通过安全的 UI Slot 扩展，不覆盖核心 Session 组件。
3. 业务状态保存在 Host 与元数据存储，Client 仅保存页面状态。
4. 用户输入、消息选区和外部响应在入口处校验；所有创建/升格操作支持幂等或明确冲突错误。
5. 不记录 API Key、消息全文或工作区敏感内容到日志。
6. 关键逻辑需有测试：SideNote 生命周期、锚点、索引、重复创建与权限回流。
7. 新增配置、RPC 或 Host API 要同步修改文档和测试。

## 提交规范

使用 Conventional Commits，例如：
- `docs: define side-thread context policy`
- `chore: configure plugin build and quality gates`
- `feat(domain): add note lifecycle repository`
- `feat(host): implement side-session persistence`
- `feat(client): add anchored note rail`
- `test: cover promotion conflict cases`

**按里程碑或模块提交**：一次提交应包含该能力必要的实现、类型和测试；不要按单个文件提交。拆分过大变更时以可审查、尽量可运行的垂直切片为界。严禁提交密钥、node_modules、构建产物。

## 合入门槛

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- 触及 Host/Client 集成时在目标 DSH Web Profile 中手工验证创建、追问、收起、刷新及卸载。
- 如果环境无法安装依赖或无法运行 DSH，必须明确标记“未验证”，不得声称构建/集成通过。

## 版本策略

早期标记为 `0.1.0-dev` 系列，**不发布**尚未完成实际对话链路的 npm 包。优先采用 DSH 官方/示例仓库的 peer 依赖上下限、manifest 与 Slots 检测方案，并在依赖升级时回归验证。

## 参考

- https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/slots.md
- https://github.com/heartmove/dsh-side-chat

## 当前验证边界（2026-11-20）

- 已以 Node.js 22.16 `--experimental-strip-types` 执行 15 项领域、持久化与 Host Coordinator 测试，全部通过；GitHub Actions 最新提交亦已通过。
- 纯领域层通过本地 TypeScript strict 检查；文件持久化因本地未安装 `@types/node`，未完成完整项目 typecheck。
- 当前工作环境无法访问包管理仓库，尚不能生成可验证的 pnpm lockfile，也未完成 DSH 加载/打包验证。
- JSON 文件仓储为**单进程**实现，不能被多个 DSH 进程并发写；Host 集成必须确定私有数据目录，并避免跨进程共享该文件。

## Host Coordinator 边界（M2 进行中）

`src/host/coordinator.ts` 已实现受控操作流程，`src/host/runtime.ts` 提供 File Repository 与端口的组合工厂。测试模拟 `SideSessionPort` 和 `SideNoteAccess`；这些模拟不能替代真实 DSH Agent/Session、Host 身份验证或工具权限验证。

官方 `ctx.sessions.fork()` 会创建内存 Session，但**不会自动完成持久化 Agent 生命周期**。实际宿主适配必须使用已验证的 `ctx.agents.create({ seed, inheritedEventCount, parentSource, ... })` 或等效官方 Session Controller，设置 Agent Handle 所有权并在宿主端强制只读策略。

参见：https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/core.md 及 https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/session/src/index.ts。

## Host RPC integration (M2)

SideNotes exposes only an authenticated DSH Connection logical channel:
`ctx.connection.rpc.handle('/sidenotes', handler)`. Calls from the Web Client
use `ctx.connection.rpc.call('/sidenotes', operation, payload)`.

The handler explicitly denies `peer.principal.kind !== 'owner'`, then validates
payload shape and delegates to `SideNoteCoordinator`. An independent parent
access helper reads DSH Session events to verify the source message; no
untrusted request can supply its own Agent object or host credentials.
The transcript read endpoint returns only bounded user/assistant text, never
internal injected context, tool results or full event objects.

This is **not** a standalone HTTP route; Connection's transport handles
authentication, origin/trust and client request correlation. It is not yet
validated through a full running DSH Web Profile.

## DSH version baseline

Pinned development dependencies and peer range: `0.2.2-rc.5` to before `0.2.3`; Node.js `>=24.9`; pnpm `11.28.5`, matching the upstream monorepo's Node/pnpm versions. GitHub Actions now runs a second build workflow with `pnpm typecheck`, `pnpm build`, and unit tests. Until lockfile is reviewed and checked in, the build workflow uses `--no-frozen-lockfile` and retains its generated lockfile as an artifact; release remains blocked.

## 构建产物校验

Host entry 为 `./lib/index.mjs`，Client entry 为 `./lib/client.js`（tsdown rc.5 实际产物）。`pnpm build` 包含 `scripts/check-build.mjs`，在任何 Manifest 和 Package exports 不指向真实文件时直接失败，避免“构建成功但插件无法加载”。

## 2026-11-20 构建验证更新

已通过 GitHub Actions 进行 Node 24 + DSH 0.2.2-rc.5 Host/Client TypeScript 类型检查、tsdown 构建和 Node tests。`pnpm-lock.yaml` 已由 CI 生成并提交，构建统一执行 `pnpm install --frozen-lockfile`。注意：通过编译和模拟端口测试不代表已经在 DSH Web Profile 真正加载成功。
