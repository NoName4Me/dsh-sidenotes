# Side Chat · 旁敲侧击

[简体中文](README.md) | [English](README.en.md)

**Start a focused, independent conversation beside a DeepSeek Harness reply without interrupting the main thread.**

- **Product:** Side Chat (旁敲侧击)
- **UI action:** 侧聊 ("Side Chat")
- **npm package:** `dsh-sidechat` (unscoped)
- **Supported DSH target:** `0.2.2-rc.5`
- **Current version:** `0.1.0-dev.6` — developer preview, not yet fully validated in Desktop.

## Features

- **Two entry points:** the action under a completed assistant reply, or the option beside DSH's built-in quote action after selecting text.
- **Two context modes:** Light supplies focused source context; Fork inherits parent events up to the source's completed turn.
- **Independent conversations:** ask and follow up in DSH's native right Sidebar without appending messages to the parent Session.
- **Source anchors:** reopen a side chat from its source reply; jump back and highlight either the selected fragment or the entire reply.
- **Explicit management and return:** search, archive, restore, promote to a regular Session, copy an answer, or insert a quote into the main conversation **draft** without sending it.
- **Host-enforced restrictions:** Side Chat agents are denied *all* tool execution by default, including read-only tools.

## Install through DSH Desktop

**Once the public npm package has been published**, open DSH Desktop → Plugins → Add plugin, choose the default npm registry, and enter:

```text
dsh-sidechat@dev
```

You can pin `dsh-sidechat@0.1.0-dev.6` instead. Enable the plugin and restart Desktop if needed.

> A publishing workflow exists, but that does **not** confirm a public package has been released. Check the [npm package page](https://www.npmjs.com/package/dsh-sidechat) for its actual status. No GitHub Packages token or `@noname4me` scope is needed.

## Develop from source

Requirements: Node.js ≥ 24.9, pnpm 11.28.5, DSH 0.2.2-rc.5.

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

| Path | Responsibility |
| --- | --- |
| `src/client/` | Selection/message actions, right Sidebar, transcript, source navigation |
| `src/host/` | Authenticated RPC, DSH Agent/Session integration, tool guard |
| `src/domain/` | Side Chat records, lifecycle, validation, persistence |
| `src/shared/` | Host–Client channel identifiers |

Metadata is stored in `state/sidechat.json`; new child Sessions use the `session-sidechat-` prefix. No compatibility layer is maintained for unpublished experimental package names.

## Publish to npmjs.org

The [Publish to npmjs.org workflow](https://github.com/NoName4Me/dsh-sidechat/actions/workflows/publish-npm.yml) runs **only on manual dispatch**.

1. **First publish:** verify the package name is available on npmjs.com, configure a publish-capable npm token as the GitHub Actions secret `NPM_TOKEN`, and choose `npm-token`. Follow npm's current two-factor authentication and token requirements.
2. **Later releases:** configure [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) for GitHub repository `NoName4Me/dsh-sidechat` and workflow `publish-npm.yml`. Choose `oidc` to avoid storing a long-lived publish token.
3. Prereleases publish with the `dev` dist-tag; stable versions use `latest`. Published npm versions are immutable.

Neither method is triggered automatically by a code push.

## Known limitations

- The side panel currently prioritizes text messages; it does not replicate all native rich-media/tool rendering.
- Source navigation requires the original parent message to be loaded.
- Desktop end-to-end acceptance (selection, model follow-ups, restarts, promotion) is still pending.
- Host upgrades outside the target DSH version range require integration validation.

## Documentation

[Design and architecture (中文)](docs/design.md) · [Development conventions (中文)](docs/development.md) · [DSH integration (中文)](docs/dsh-integration.md) · [Milestones (中文)](docs/roadmap.md)

License: [MIT](LICENSE).
