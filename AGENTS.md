# Coding agent instructions

This repository is the **Side Chat / 旁敲侧击** plugin for **DeepSeek Harness 0.2.2-rc.5**. Before implementation changes, read:

1. [产品与架构设计](docs/design.md)
2. [开发规范](docs/development.md)
3. [DSH 集成说明](docs/dsh-integration.md)
4. [开发进度](docs/roadmap.md)

## Product identity

- Product: **旁敲侧击 / Side Chat**.
- UI action: **侧聊**.
- GitHub and public npm package: **dsh-sidechat**, no npm scope.
- DSH plugin ID: `dsh-external/dsh-sidechat`; Cordis / Client loader ID: `dsh-sidechat`.
- RPC channel: `/sidechat`. Metadata store: `state/sidechat.json`. Child Sessions: `session-sidechat-<id>`.
- This project has **not** been formally released. Do not implement compatibility shims for unpublished experimental names or storage layouts.

## Non-negotiable behavior

- The parent Session must never be implicitly altered by side conversations.
- Light/Fork context creation and side-chat lifecycle belong to the Host; persist the source anchor.
- Authorization, owner checks and deny-all tool restrictions must be **enforced on the Host**; prompt-only restrictions are insufficient.
- Users explicitly choose when to bring content to the main conversation **draft**, and that action must never send a message automatically.
- Promotion to a regular Session is independent from bring-back.
- Never log tokens, raw selected content, private messages or workspace files.
- Use official DSH Cordis, Agent/Session and UI Slot APIs. Protect the authenticated RPC boundary; do not expose anonymous routes.

## UI constraints

- The right DSH Sidebar contains the **only side-chat directory**; no extra floating dot rail.
- The selection affordance shares DSH's Quote capsule and is shown after completed selection, not during `selectionchange`.
- A whole-reply source jump must target the assistant reply body, **not** the turn-tail toolbar.
- Use DSH `--dsw-*` theme tokens, native icons and Tooltips. Respect reduced motion and compact windows.
- Native-style composer: one autosizing textarea (maximum 180px), no drag resize, one circular send/stop control at bottom-right.
- Keep old code comments and docs accurate; avoid claims of Desktop manual verification when only CI has run.

## Engineering and release

- Host and Client runtime boundaries must remain separate. Client output must register via `window.__ModuleLoader__.load({ id: 'dsh-sidechat', factory })`, never bare ESM.
- Use pnpm frozen lockfile. Run `pnpm typecheck`, `pnpm build`, `pnpm test` and `pnpm check:manifest`. Run relevant integration tests and DSH Web smoke for Host/Client changes.
- Prefer cohesive Conventional Commits; avoid one commit per file.
- Public npm publishing is **manual only** through [publish-npm.yml](.github/workflows/publish-npm.yml). Never auto-dispatch a publication or introduce a GitHub Packages workflow.
- Build/CI success does not equal a completed real Desktop model and UX acceptance test.
