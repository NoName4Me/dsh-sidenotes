# 旁敲侧击 · Side Chat

[简体中文](README.md) | [English](README.en.md)

**在 DeepSeek Harness 主对话旁，针对某段内容开启独立的多轮交流，不打断主线。**

- **产品名称**：旁敲侧击（Side Chat）
- **功能按钮**：侧聊
- **npm 包名**：`dsh-sidechat`（不带 scope）
- **目标 DSH 版本**：`0.2.2-rc.5`
- **当前版本**：`0.1.0-dev.6`（开发预览版，尚未完成 Desktop 端到端验收）

## 核心功能

- **两种入口**：AI 回复下方的「侧聊」图标；选中文字后，在 DSH 原生「引用文本」胶囊中选择「侧聊」。
- **独立上下文**：Light 模式围绕引用内容对话；Fork 模式继承源消息所在已完成轮次之前的主对话上下文。
- **侧边交流**：在 DSH 原生右侧 Sidebar 中提问和多轮追问，主对话不被插入或修改。
- **原文关联**：来源回复旁显示侧聊入口；点击「定位原消息」可滚动并高亮整条回复或指定选区。
- **管理与回流**：侧聊目录搜索、归档、恢复、升格为正式 Session；复制回答，或手动引用到主对话**草稿**（不自动发送）。
- **权限边界**：侧聊 Agent 默认禁止执行所有工具，包括只读工具；权限控制在 Host 侧强制执行。

## 安装

**公开 npm 包首次发布成功后**，在 DSH Desktop 打开「插件」→「添加插件」，使用默认 npm 安装源输入：

```text
dsh-sidechat@dev
```

也可以指定版本：`dsh-sidechat@0.1.0-dev.6`。安装启用后，按需重新启动 Desktop。

> 当前仓库**已配置 npmjs.org 手动发布流程**，但这不等于包已发布成功。发布状态请到 [npm 包页面](https://www.npmjs.com/package/dsh-sidechat) 核实。此包无需 GitHub Packages Token，也不使用 `@noname4me` 前缀。

## 从源码开发

环境：Node.js ≥ 24.9、pnpm 11.28.5、DSH 0.2.2-rc.5。

```bash
git clone https://github.com/NoName4Me/dsh-sidechat.git
cd dsh-sidechat
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
pnpm check:manifest
```

代码分层：

| 路径 | 责任 |
| --- | --- |
| `src/client/` | 消息与选区入口、右侧面板、历史展示、原文定位 |
| `src/host/` | 认证 RPC、DSH Agent/Session 生命周期、权限约束 |
| `src/domain/` | 侧聊元数据、生命周期、校验、存储 |
| `src/shared/` | Client/Host 通道常量 |

侧聊元数据使用独立的 `state/sidechat.json`；子会话 ID 以 `session-sidechat-` 开头。本项目尚未正式发布，不保留旧试验包的存储及安装身份兼容逻辑。

## 发布到 npmjs.org

[GitHub Actions：Publish to npmjs.org](https://github.com/NoName4Me/dsh-sidechat/actions/workflows/publish-npm.yml) 仅支持手动运行，发布目标固定为公开 npm Registry。

1. **首次发布**：在 npmjs.com 确保包名可用，并准备具有发布权限的 npm Token；将其配置为仓库 Actions Secret `NPM_TOKEN`，运行工作流时选择 `npm-token`。请遵守 npm 当前的 2FA / Token 发布限制。
2. **后续发布**：在 npm 包设置中为 `NoName4Me/dsh-sidechat` 的 `publish-npm.yml` 配置 [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)，再运行工作流并选择 `oidc`；不需要长期发布 Token。
3. 预发布版本自动使用 `dev` dist-tag，正式版本使用 `latest`；npm 同一个版本号不能重复发布。

以上步骤**不会自动触发发布**，需要仓库维护者主动执行。

## 当前限制

- Client 主要展示文字消息，尚未实现全部原生富媒体与工具消息 UI。
- 来源消息必须已在主对话中加载，才能定位和高亮。
- 实际 Desktop 中的选区、模型多轮、重启恢复与升格需要进一步人工验收。
- 当前只支持指定 DSH 版本区间，升级宿主前应重新验证。

## 文档

[设计与架构](docs/design.md) · [开发规范](docs/development.md) · [DSH 集成](docs/dsh-integration.md) · [进度与验收](docs/roadmap.md)

许可证：[MIT](LICENSE)。
