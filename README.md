# 旁敲侧击 · Side Chat

让 DeepSeek Harness 的主对话保持完整，同时围绕一段选中文字或一条 AI 回复开展独立的侧聊。

**产品名称**：旁敲侧击 / Side Chat  
**按钮**：侧聊  
**npm 包名**：`dsh-sidechat`（无 scope）  
**GitHub**：https://github.com/NoName4Me/dsh-sidechat

> Developer preview `0.1.0-dev.6`，面向 DeepSeek Harness `0.2.2-rc.5`。正式 Desktop 多模型验收仍在进行，暂不视为稳定版。

## 直接在 DSH 界面安装

npmjs.org 公共包发布成功后，打开 **DSH Desktop → 插件 → 添加插件**，输入：

```text
dsh-sidechat@dev
```

也可以指定版本 `dsh-sidechat@0.1.0-dev.6`。使用 DSH 默认的 npm 安装源，无须配置 GitHub Packages 或个人 Token。安装完成后点击「立即启用」，必要时重启 Desktop。

**更名迁移**：请先卸载旧的 `dsh-sidenotes` 或 `@noname4me/dsh-sidenotes`，不要在一个 DSH Profile 中同时加载新旧身份。为了保留已有的侧聊记录，Host 暂继续读取历史的 `state/sidenotes.json`，并识别记录中已绑定的旧子 Session ID。先备份原 Profile 再升级。此兼容路径仅用于数据读取，不是新插件的名称。

## 主要功能

- 点击 AI 回复下方「侧聊」图标，或在原生「引用文本」胶囊中选择「侧聊」。
- 可在 Light / Fork 两种上下文方式中选择，侧聊由独立 DSH Agent Session 运行，不修改主对话。
- 侧聊目录集中在 DSH 原生右侧 Sidebar；主回复上方的锚点可直接打开对应侧聊。
- 支持多轮追问、复制回答、引用到主对话草稿、来源定位与局部高亮、归档/恢复/升格。

## 开发

要求 Node.js 24.9+、pnpm 11.28.5。

```sh
git clone https://github.com/NoName4Me/dsh-sidechat.git
cd dsh-sidechat
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
```

源码：`src/client`（UI）、`src/host`（Agent / RPC）、`src/domain`（数据与权限）、`src/shared`（通信协议）。

相关文档：[设计](docs/design.md) · [开发规范](docs/development.md) · [DSH 对接](docs/dsh-integration.md) · [路线图](docs/roadmap.md)。

## 手动发布到 npmjs.org

仓库的 **Actions → Publish to npmjs.org → Run workflow** 提供两个认证选项：

1. **npm-token**：首次发布新 npm 包时可选。先在 npmjs.com 获取有对应发布权限的 Token，并在 GitHub 仓库的 Actions secrets 中创建 `NPM_TOKEN`；在 npm 账户完成必要的 2FA / 发布许可设置。
2. **oidc**：首次发布后，登录 npmjs.com，在 `dsh-sidechat` 的 Settings → Trusted Publishing 中绑定 GitHub Actions，填写 owner `NoName4Me`、repository `dsh-sidechat`、workflow `publish-npm.yml`，授权 `npm publish`，随后使用 OIDC，无需长期写权限 Token。

也可以使用支持首次建包的 npm Trusted Publishing 初始化流程，再直接使用 OIDC。详细说明以 [npm Trusted Publishing 文档](https://docs.npmjs.com/trusted-publishers/) 为准。

工作流只支持手动触发，且限制在主仓库 `master`。所有提交仍需通过构建、测试和 npm pack 检查。预览版使用 `dev` dist-tag，正式版使用 `latest`。

**注意：GitHub Actions 工作流准备完成并不等于已发布到 npm。** 首次发布前还必须确认 `dsh-sidechat` 包名可用、完成 npm 认证或 OIDC 信任关系配置。不要向聊天或仓库提交 npm Token。

## 当前限制

- 侧聊对话目前主要支持文本历史，原生 Chat 的富媒体渲染尚未全部复用。
- 来源跳转要求相关主对话消息已加载。
- Side Agent 默认拒绝工具执行。
- 尚需 Desktop 真正的模型多轮、重启与升格验收。

MIT License.
