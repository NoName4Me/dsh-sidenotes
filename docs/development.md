# 开发规范

本项目为 DSH 扩展，不是 DSH 的 Fork。严格以目标 DSH 版本和公开 API 为准；存在差异时先落兼容性记录再调整。

## 技术栈与边界

- Node.js 20+；TypeScript strict，独立 Host/Client 入口。
- DSH 插件采用官方 Cordis `apply(ctx)` 生命周期及 `dsh.bundle.patch` 加载机制。
- tsdown 负责打包；测试使用 Vitest；静态校验使用 TypeScript、ESLint/Prettier（后续按实际依赖锁定）。
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

- 已以 Node.js 22.16 `--experimental-strip-types` 执行 8 个领域测试，全部通过。
- 纯领域层通过本地 TypeScript strict 检查；文件持久化因本地未安装 `@types/node`，未完成完整项目 typecheck。
- 当前工作环境无法访问包管理仓库，尚不能生成可验证的 pnpm lockfile，也未完成 DSH 加载/打包验证。
- JSON 文件仓储为**单进程**实现，不能被多个 DSH 进程并发写；Host 集成必须确定私有数据目录，并避免跨进程共享该文件。
