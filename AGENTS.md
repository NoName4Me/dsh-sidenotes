# Instructions for coding agents

This repository implements **SideNotes**, a DeepSeek Harness Web plugin. Read these files before changing implementation:

1. [docs/design.md](docs/design.md) — product contract, context isolation and safety boundaries
2. [docs/development.md](docs/development.md) — engineering conventions and commit rules
3. [docs/roadmap.md](docs/roadmap.md) — milestone definitions and known unverified pieces

## Non-negotiable behavior

- Never let side-thread activity implicitly modify the parent Session's messages, context, files or tools.
- Promotion to a visible Session and bringing content back into the parent are independent user actions.
- Side threads are anchored to a source message; persist that anchor on the Host side.
- Read-only policy must be implemented in Host tool permissions. Prompt-only safeguards do not count.
- Use DSH's published Cordis plugin lifecycle, Session/Agent API and UI Slots; do not monkey-patch the host Chat UI or reach into private APIs without a documented compatibility adapter.
- Do not add a plain HTTP API unless its authentication and origin protections match the host's actual trust boundary.
- Never log credentials, model output, selected source text or workspace file contents.
- Do not claim a feature is implemented or a build verified before testing it.

## Development workflow

- Implement changes as **cohesive modules**: tests, types, docs and implementation of one behavior in the same commit.
- Conventional Commit headings, e.g. `feat(host): persist side-session lineage`. Avoid one-file-per-commit.
- TypeScript strict, separate Host/Client runtime boundaries; import cross-runtime types only.
- Preserve domain idempotency, parent isolation, revision checks and storage compatibility.
- Use the existing test runner for domain tests. A change to Host/Client integration also requires a real DSH Web Profile smoke test.
- Keep `package.json`, `dsh.plugin.json` and `cordis.patch.yml` aligned. Run `node scripts/check-manifest.mjs`.
- Dependency install and full build need a pinned DSH development version and a committed `pnpm-lock.yaml` before release.

## Current caveat

Host/Client plugin entry points are **stubs**. The Host Coordinator and injectable file-backed runtime exist and are tested against a fake Session port, but the official DSH Agent bridge and owner-only Connection RPC are now coded, but they have not passed a full DSH package build or mounted runtime integration. There is still no Web UI or streaming client; the read-only guard is implemented but not yet exercised against real tools. Do not expose the Coordinator to a browser until real Host authorization and tool restrictions are implemented.

## Side Chat UI rules (dev.3)

- The product is **Side Chat · 旁敲侧击**, and the visible action is **侧聊**. Do not regress to the user-visible “旁注”.
- Follow DSH design tokens (`--dsw-*`), native UI-primitives icons and Tooltip. Avoid hard-coded color palettes and competing fixed right-edge panels.
- DSH's Quote selection action owns selection timing. Never watch `selectionchange` to continuously mount/move Side Chat controls during a drag.
- Keep the Side Chat companion dot rail beside the original Turn Navigator and the conversation itself in the native right Sidebar tab.
- Source markers must not change chat messages, clone markdown, or silently modify the main Session. Jump highlighting is temporary and scope-specific.

## Dev.4 interaction refinements

Do not re-add the left dot rail; the right Sidebar directory is the only index. Source highlighting must resolve an assistant-step response, never the turn-tail footer. Message-edge tooltips show source quote and first user question. Do not add redundant success notices on source jump or quote insertion. The send/stop control occupies one dark 29px circular button in the composer card. Export plugin icon and en/zh locale metadata, and keep packed resources in sync.
